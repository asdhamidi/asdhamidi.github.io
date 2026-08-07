---
title: "The Same Wall, Twice: What Two Unrelated Pipelines Taught Me About Scale"
date: "2025-07-08"
slug: "the-same-wall-twice"
description: "A deep dive into hitting an upload limit on SharePoint, hitting a JVM limit on Databricks a year later, and realizing they were the same problem wearing different clothes."
---

# The Same Wall, Twice: What Two Unrelated Data Pipelines Taught Me About Scale

![The Same Wall Twice Infographic](/the-same-wall-twice-infographic.svg)
_A deep dive into hitting an upload limit on SharePoint, hitting a JVM limit on Databricks a year later, and realizing they were the same problem wearing different clothes._

---

## TL;DR

Over roughly a year, I built two completely unrelated data pipelines on two completely unrelated stacks - one moving data from Snowflake to SharePoint in native Python, one moving data from Salesforce to S3 on Databricks. Both hit a wall once objects got large enough. Both walls turned out to be the _same_ wall: something in the pipeline assumed it could hold an entire unbounded object in memory or in a single request, and that assumption quietly held right up until it didn't.

The fixes were architecturally identical, even though the code, the APIs, and the failure messages had nothing in common: stop treating the payload as one atomic unit, and instead **chunk it, stream it, and process it incrementally**. This post is a technical walkthrough of both systems, why each one broke, why the fix worked, and the general pattern I now watch for before it bites me a third time.

---

## Part 1: The Setup - Two Very Different Pipelines

Before getting into the failures, it's worth laying out what each system actually did, because the surface-level differences are what made the underlying similarity so easy to miss at the time.

### System A: Snowflake → File Generation → SharePoint (a couple of years ago)

This was, in effect, a homegrown artifact delivery system. The requirements were simple on paper:

- Pull data out of Snowflake tables on a schedule.
- Transform it into deliverable files (reports, extracts - whatever the downstream consumer needed).
- Package a batch of these files - sometimes 100 to 150 at a time - into a single zip archive.
- Upload that archive to a SharePoint site.
- Send stakeholders a link.

The deliberate choice here was SharePoint over something like S3 or GCS. That's not the "correct" engineering answer if you're optimizing for API ergonomics or cost, but it was the right answer for the actual constraint: the consumers were business stakeholders, not engineers, and they needed to open a link in a browser and see files, not configure a bucket policy or install a CLI. Storage choice was driven by the audience, not by developer convenience - a trade-off worth naming explicitly, because it's the kind of decision that looks "wrong" in a pure systems-design review and is obviously right once you know who's on the other end of that link.

The pipeline itself was orchestrated in Airflow, running native Python.

### System B: Salesforce → Databricks → S3 (present day)

The new system is structurally similar in _intent_ - pull data from a source system, land it somewhere durable, make it usable downstream - but almost nothing else about the implementation overlaps:

- Source is Salesforce instead of Snowflake.
- Salesforce, notably, only exports data as CSV. There's no native option to pull it as Parquet or anything columnar.
- The processing layer is Databricks, not native Python - meaning the JVM (via Spark and Databricks' own utilities, like `dbutils`) is sitting underneath a lot of what looks like "just Python" in a notebook.
- The destination is S3, not SharePoint.
- Once landed, the CSVs get converted to Parquet for downstream consumption.

Different vendor, different orchestration substrate, different storage target, different serialization format at the destination. On paper, these two systems share almost no surface area.

---

## Part 2: The First Wall - SharePoint Upload Failures

### The symptom

Small files uploaded fine, every time, no exceptions. Larger files - well into the 100–200MB range - mostly uploaded fine too, which is what made this failure mode sneaky. It wasn't a hard size ceiling that failed consistently above some clean threshold. Some files in the 150–200MB range would fail, and it wasn't always obvious in advance which ones.

That inconsistency is a classic signature of a **single-request payload problem**, as opposed to a hard API rejection. If SharePoint were simply rejecting anything over a fixed size, every large file would fail identically and predictably. Instead, what was actually happening was that a single, large, synchronous HTTP PUT was becoming increasingly fragile as size grew - more time in flight, more exposure to transient network interruption, more exposure to timeout thresholds on either end of the connection, more memory pressure while the payload sat in a buffer waiting to be sent. None of that shows up as a clean "file too big" error. It shows up as flaky, size-correlated failures that are maddening to reproduce on demand.

### The fix: chunked (resumable) upload

The fix was to stop treating "upload a file" as one atomic operation once the file crossed a size threshold - in this case, 50MB was the cutoff I settled on. Below that, a single-shot upload stayed simple and fast. Above it, the pipeline switched to a chunked upload strategy instead.

Conceptually, chunked upload works like this:

1. **Open a session.** Instead of sending the whole file in one request, you first tell the destination "I'm about to send you a file of size X, in pieces." This gives you back a session identifier or upload URL to use for every subsequent piece.
2. **Send fixed-size byte ranges sequentially.** The file gets sliced into chunks (a few megabytes each, typically), and each chunk gets sent as its own request, tagged with the byte range it represents.
3. **The receiving side reassembles.** SharePoint's upload session mechanism tracks how much of the file it has received and where the gaps are.
4. **Finalize.** Once every byte range has been received, a final call closes the session and the file materializes as a single object on the SharePoint side.

The reason this is more resilient isn't just "smaller requests are less likely to time out," although that's part of it. It's that **failure becomes recoverable at the chunk level instead of the file level.** If chunk 14 of 40 fails, you retry chunk 14 - you don't re-upload the first 13 chunks' worth of bytes, and you definitely don't re-upload the whole 200MB file from scratch. That's the real unlock: it converts an all-or-nothing operation into a resumable one, with a natural retry boundary that's small enough to be cheap and large enough to still be efficient.

This is a well-established pattern, not something unique to SharePoint - the same shape shows up as "multipart upload" in S3, "resumable upload" in the Google APIs, and "upload sessions" in Microsoft Graph. Any API that expects large binary payloads tends to converge on the same solution independently, which is itself a hint that this isn't an API-specific workaround but a general property of moving large objects over a network reliably.

### Scaling it out: Airflow dynamic task mapping

Fixing the chunking problem solved _reliability_. It didn't solve _throughput_ - and with 100–150 files needing to move through this pipeline per run, throughput mattered.

This is where Airflow's dynamic task mapping came in. Rather than writing a fixed DAG with a hardcoded number of upload tasks, dynamic task mapping lets you generate task instances at runtime based on the actual list of files to process. Conceptually: the DAG has one "upload a file" task defined once, and at execution time, Airflow expands that single task definition into N independent task instances - one per file - based on whatever list is produced upstream (in this case, the list of files waiting to be pushed to SharePoint).

Two properties of this matter a lot here:

- **Each task instance is independent.** If file 87 out of 150 fails (even after chunk-level retries are exhausted), it doesn't take down the other 149. Airflow can retry that one task instance in isolation.
- **They run in parallel, bounded by your worker pool.** Instead of uploading 150 files serially - which, at even a modest per-file duration, adds up fast - the scheduler fans them out across available workers.

Combined, chunked upload plus dynamic task mapping turned "upload N files, however large, without falling over" into a property of the system rather than something that needed to be re-verified for every new batch. That's the real marker of having actually solved a scaling problem, as opposed to having patched around a specific failure: the fix generalizes to inputs you haven't seen yet.

---

## Part 3: The Second Wall - a JVM Character Limit on Databricks

### The symptom

Fast forward roughly a year. New source, new destination, new runtime. Ingesting Salesforce objects into Databricks, most objects behaved fine: pull the CSV, hold it in memory briefly, write it out via `dbutils` onto S3, then convert to Parquet downstream. Straightforward, and fast enough not to think twice about it.

Then some Salesforce objects turned out to be large enough that this approach failed outright - not flaky, not intermittent, but a hard failure tied to a specific ceiling: roughly 2.1 billion characters, which lines up closely with the JVM's signed 32-bit integer boundary (2³¹ − 1, or about 2.147 billion). That's not a coincidence. Java strings, arrays, and a number of other core structures are indexed by a signed 32-bit int under the hood, which means any single Java `String`, byte array, or similarly-indexed structure has a hard ceiling around 2.1 billion elements - full stop, regardless of how much heap memory is actually available. You can have terabytes of RAM free and still hit this wall, because it isn't a memory problem. It's a data-structure indexing limit.

This is a subtle trap in a Databricks/Spark context specifically, because so much of what looks like "just calling a Python function" is actually routed through JVM-backed utilities underneath - `dbutils` in particular. When an object being written or manipulated through those utilities gets large enough, you can end up needing to represent it as a single string or array on the JVM side, even if your code is nominally written in Python. The JVM doesn't care that your notebook is in Python; if a `dbutils` call underneath materializes the payload as a Java string, that payload is bound by Java string limits.

### Why this echoes the SharePoint failure

Structurally, this is the exact same category of bug as the SharePoint one, even though the failure mode looks totally different on the surface (an HTTP upload timing out vs. a JVM index overflow). In both cases:

- The system implicitly assumed an object would fit inside **a single unit of work** - one HTTP request, one in-memory string.
- That assumption was quietly true for most inputs and silently false for the largest ones.
- The failure only appeared once a size threshold was crossed, and the threshold was invisible until you hit it.

Small and medium objects never surfaced this, in either system, because they never got large enough to violate the hidden assumption. That's what makes this class of bug particularly dangerous in production: it isn't caught by normal testing, because normal testing tends to use normal-sized inputs. It shows up later, in production, attached to whichever record happened to be the first one large enough to break the assumption - and by then it looks like a one-off, not a design flaw.

### The fix: paginate, stream, and stay off the JVM

The fix mirrored the SharePoint fix almost exactly in spirit, even though none of the tooling overlapped:

1. **Paginate the fetch.** Instead of pulling an entire Salesforce object's result set in one request, the ingestion was changed to fetch results in bounded pages - N records per page - using the API's native pagination support.
2. **Stream to disk instead of buffering in memory.** Each page gets written out incrementally using Python's native file I/O, rather than being accumulated into one large in-memory object first.
3. **Bypass the JVM path for this step.** Critically, this meant writing directly through Python's I/O rather than through `dbutils`, which sidesteps the JVM string/array indexing ceiling entirely, because the object never needs to exist as a single JVM-backed structure at any point in the pipeline.
4. **Append, don't hold.** Each page gets appended to the output file and then discarded from memory, so the process's memory footprint stays roughly constant regardless of how large the underlying object ultimately is.

The result: object size stopped being a variable that mattered. A small Salesforce object and a massive one now go through the identical code path, just with a different number of pagination loops - which is exactly the property you want from something you're calling "infinitely scalable." The CSV-to-Parquet conversion downstream was unaffected by any of this, since it now always operates on a file that was written incrementally rather than materialized as one blob.

---

## Part 4: The Actual Pattern (This Is the Point)

Strip away the vendor names and here's what's left, side by side:

|                                      | System A (SharePoint)                       | System B (Databricks/Salesforce)                 |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------------ |
| **Unbounded thing**                  | File size                                   | Object/result-set size                           |
| **Hidden assumption**                | "One HTTP request can carry the whole file" | "One JVM string/array can hold the whole object" |
| **Where it broke**                   | ~150–200 MB, intermittently                 | ~2.1B characters, deterministically              |
| **Fix**                              | Chunked upload sessions                     | Paginated fetch                                  |
| **Scale-out mechanism**              | Airflow dynamic task mapping                | Streaming append via native Python I/O           |
| **What stopped mattering afterward** | File size                                   | Object size                                      |

Once you line them up like this, the two "different" bugs collapse into one bug, filed under two different vendors. And I don't think that's a coincidence specific to my own work—I think it's close to a general law of systems that move data:

> **Any component that implicitly assumes bounded input will eventually receive unbounded input, and it will fail exactly once that assumption becomes false—not gracefully, and usually not obviously.**

This shows up constantly, well beyond these two examples. It's the same underlying issue as:

- A message queue with a max message size, and a producer that assumes messages will always be small.
- A database column or row-size limit, hit only once someone stores an unusually rich record.
- An API gateway payload limit, hit only by the one client sending batched requests instead of single ones.
- A UI table component that renders fine for hundreds of rows and locks the browser tab at tens of thousands.

Different domain, same species of bug. The fix is almost always some variant of "stop assuming atomicity; introduce a bounded unit of work and iterate.

---

## Part 5: What I'd Tell Past Me (and Anyone Building Pipelines Now)

A few concrete, transferable takeaways from having now hit this twice:

**1. Treat "it works for every input I've tested" as a hypothesis, not a guarantee, whenever input size is unbounded.**
If a pipeline's input size is determined by something you don't control - user-generated content, an upstream system's growth, a source API you don't own - assume there is _some_ size at which your current approach breaks, even if you haven't seen it yet. The question isn't whether that size exists; it's whether you find out about it in a code review or in a 2am page.

**2. Look for implicit "single unit of work" assumptions early, especially at system boundaries.**
Any place where data crosses a boundary - leaves your process over HTTP, gets handed to a runtime you don't fully control (like the JVM underneath a nominally-Python Databricks notebook), gets written to a file - is a place where someone, somewhere, decided how large a single unit of work is allowed to be. That decision is often undocumented and defaults to "however big it happens to be in dev and test," which is a silent trap.

**3. Chunking and pagination are really the same idea, and it generalizes past "files."**
Whether it's bytes in a file upload or rows in a result set, the underlying move is identical: replace "fetch/send everything, then process" with "fetch/send a bounded piece, process it, repeat." This is worth internalizing as a pattern name, not a one-off fix, because it means the next time you see a size-correlated failure, you already know the shape of the fix before you've even looked at the specific API.

**4. Pair chunking with parallelism deliberately, not accidentally.**
Chunking alone gets you reliability. It doesn't get you throughput unless you also parallelize the chunks or the units of work - which is what Airflow's dynamic task mapping did on the SharePoint side. It's worth treating these as two separate, composable decisions: _can this fail safely in pieces_ (chunking) and _can these pieces run concurrently_ (parallelism), rather than solving them as one tangled fix.

**5. When you hit a hard numeric ceiling, go find out what it actually is.**
"2.1 billion characters" isn't an arbitrary number - it's `Int.MAX_VALUE`, and recognizing that told me immediately that this was a JVM indexing limit, not a memory limit, which pointed straight at "stop routing this through JVM-backed utilities" as the fix. A lot of debugging time gets saved by asking "is this number suspiciously close to a known constant?" before assuming a failure is bespoke to your data.

**6. Keep a personal (or team) log of these patterns.**
The single biggest reason I recognized the second failure quickly was that I'd already paid the tuition for the first one. If your organization doesn't have anywhere these lessons get written down - a wiki page, an internal playbook, even just a tagged set of postmortems - that's worth fixing independently of any specific incident. The tools you're using in two years will almost certainly not be the tools you're using today. The failure modes probably will be.

---

## Closing Thought

What strikes me most about this pair of incidents isn't that I solved a hard problem twice - chunking and pagination aren't novel techniques, and I don't think either fix is particularly clever in isolation. What strikes me is _how little the specific stack mattered_ to either the failure or the fix. Snowflake and Salesforce, SharePoint and S3, native Python and Databricks-on-the-JVM - none of that surface variation changed the underlying shape of the problem or the solution.

That's a useful thing to internalize as an engineer: the tools are the part of your job that will keep changing. The patterns underneath them - bounded vs. unbounded work, atomic vs. incremental operations, single-shot vs. resumable I/O - are much more durable, and they're worth learning explicitly rather than re-discovering by accident every time they show up wearing a new API.
