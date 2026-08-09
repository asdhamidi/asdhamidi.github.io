---
title: "One Cell at a Time: What Building an Artifact Delivery Pipeline Actually Taught Me"
date: "2025-06-15"
slug: "one-cell-at-a-time"
description: "Three quiet breaking points in one pipeline, and the pattern that connects a silent upload hang, a slow formatting library, and a missing folder."
---

# One Cell at a Time: What Building an Artifact Delivery Pipeline Actually Taught Me

_A framework that quietly stopped scaling in three different places - one upload that hung without ever failing, one library that got slower with every cell, and one file that reads its own edits back - and what tying them together revealed about designing for size instead of hoping it never comes up._

---

## TL;DR

I built an internal pipeline that pulls report data out of Snowflake, formats it, and gets it in front of business stakeholders - either landed in SharePoint or zipped up and emailed directly, depending on the report. It worked great, until three separate parts of it quietly stopped scaling: large SharePoint uploads that didn't fail so much as vanish into a hang, an Excel formatting library that got exponentially slower with every row, and a target folder structure that occasionally just... wasn't there yet. Fixing all three taught me the same lesson three times: the parts of a pipeline that work fine in testing are usually the parts nobody's stress-tested at the actual size production throws at them.

## Part 1: What This Thing Actually Does

The requirements, on paper, were simple:

- Pull data out of Snowflake on a schedule.
- Turn it into a file a human can open - CSV, XLSX, or TXT.
- If it's Excel, make it _look_ like someone cared: formatted columns, locked cells, dropdown validation.
- Get it to the stakeholder, one of two ways depending on the report.
- Keep enough history around that nobody's ever staring at last week's numbers by accident.

This is internal-only tooling - no public repo, no external users, just a couple dozen recurring reports that used to require someone on the data team to manually run a query and email a CSV. The audience is business stakeholders, not engineers, which shapes almost every decision downstream, starting with the fact that "delivery" here doesn't mean one thing. More on that later - first, the part of the system that actually eats most of the CPU time.

## Part 2: A Formatting Engine That's Just JSON (and the Library Bill That Comes With It)

Generating "nice" Excel files programmatically usually means cell-by-cell formatting calls tangled up with business logic. This pipeline sidesteps that with a small JSON DSL that describes formatting declaratively - keys are column names, values are formatting rules:

```json
{
  "Revenue": { "format": "currency", "locked": true },
  "Report_Date": { "format": "date", "date_format": "MM/DD/YYYY" },
  "Status": { "validation": ["Open", "Closed", "Pending Review"] }
}
```

A single conversion function takes the raw data plus this blob and produces a styled `.xlsx`. Formatting becomes data instead of code - want to change a column's style, edit a row in the config table, no deploy needed. Genuinely one of my favorite parts of the system.

It's also, quietly, the slowest. The engine underneath is `openpyxl`, and `openpyxl` is easy to work with for exactly the reason it's expensive at scale: every single cell is its own Python object. Applying the DSL to a report means walking those objects one at a time - set this cell's number format, lock that one, attach a validation rule to this range - and for a report with tens of thousands of rows and a couple dozen styled columns, that's a genuinely enormous number of individual object mutations. For the biggest reports, this step ends up slower than the Snowflake extraction _and_ the upload combined, which is not what you expect from "apply some formatting." `openpyxl` does have a write-only mode that's dramatically faster, but it doesn't play nicely with cell locking or data validation added after the fact - both of which the DSL depends on - so for now that trade-off just sits there as the accepted cost of a library that's otherwise pleasant to use. Worth knowing about before you reach for it on something row-heavy.

One more detail about that `"locked": true` field, because it's not just cosmetic - it's setup for something that happens much later in this post.

## Part 3: The Wall

Small files uploaded fine. Every time, no drama. The trouble started once files got large - and "large" here isn't some clean number I can hand you, because that's exactly what made it maddening.

Here's the actual symptom: the upload call would either succeed, or it would just... hang. No exception thrown. No HTTP error code. No timeout firing. Airflow would show the task as still running, minutes past when it should've finished, and there was nothing in the logs to act on because _nothing had happened yet_ - the request was just sitting there, waiting on a socket that may or may not ever resolve. And it wasn't consistent. The exact same file, re-run, might sail through the second time. Sometimes it failed with something you could actually catch. Sometimes it failed silently. Sometimes it didn't fail at all, it just froze.

If SharePoint had a hard size cutoff and rejected everything past it, that would almost be a relief - you'd get a clean error, write a clean `except`, move on with your life. What was actually happening was messier: a single, large, synchronous `POST` gets more fragile the bigger it gets. More time in flight, more exposure to a flaky connection, more exposure to whatever timeout thresholds exist on either end, more memory sitting in a buffer waiting to go out the door. None of that produces a tidy "file too big" message. It produces exactly the kind of size-correlated, non-deterministic misery that's almost impossible to reproduce on demand - which meant almost impossible to debug with normal tools. You can't set a breakpoint on "the network decided not to tell you anything."

## Part 4: The Fix - Stop Treating a File (or a Folder) as a Given

Two things changed here, and it's worth separating them because they fix different failure classes.

**First: never assume the destination exists.** Before any upload attempt, a helper function walks the target SharePoint path and creates every missing level of it - drive, folder, subfolder, archive directory, whatever's absent. It costs a handful of cheap API calls up front, and in exchange an entire category of failure (upload to a path that doesn't exist yet) is eliminated before it can ever happen. Boring, unglamorous, and it means a brand-new report added to the `config_table` just works the first time, without anyone pre-creating folders by hand.

**Second: stop sending large files as a single request.** A size-assessment function inspects the payload before upload and automatically routes it down one of two paths:

- **≤ 100 MB** → one request, one payload, done.
- **> 100 MB** → split into chunks and streamed up incrementally.

Nobody has to decide this manually per report - the function checks the byte size of what it's about to send and picks the strategy itself. Chunk size, when chunking kicks in, isn't fixed either - it's computed per file:

```
Chunk Size = min(10 MB, 5% of Total Payload Size)
```

That formula caps chunks at a sane ceiling while scaling down for files that are big-but-not-huge, so you're not sending weirdly oversized pieces relative to the whole. And wrapped around every single API call - chunked or not - is a `try/except` with exponential backoff and retry logic covering HTTP status codes 401 through 503. The 401s are token expiry (go refresh and retry), the 5xxs are "the service had a bad moment, wait and try again." This is also, not coincidentally, what finally turned the _silent_ freeze into something visible: instead of one enormous request hanging indefinitely with no timeout to trip, each chunk is small enough that a stuck request actually hits its timeout in a reasonable window, fails loudly, and gets retried. Chunking didn't just fix throughput - it's what gave the failure mode a voice.

## Part 5: Scaling Out With Dynamic Task Mapping

Fixing reliability didn't fix throughput. With 400+ files needing to move per run, processing them one after another in a single task was a non-starter - one slow file drags the whole run down, and a failure three-quarters through means starting over.

The fix here was Airflow's Dynamic Task Mapping. A lightweight upstream task queries the `config_table` and produces a list of file parameters - one entry per report. That list gets fanned out at runtime into up to 400+ independent parallel task instances, each responsible for one file end to end: extract, format, style, upload.

Two things matter about this:

- Each task instance is independent, so one file failing doesn't take the other 399 down with it.
- They run in parallel, bounded by the worker pool, instead of serially.

Chunked upload solved _can this fail safely_. Dynamic Task Mapping solved _can these run at the same time_. Worth treating those as two separate decisions - I tangled them together at first and it made debugging harder than it needed to be, because a "failure" could mean either the chunk logic or the parallelism, and I had no way to tell which without staring at logs for way too long.

## Part 6: Archival, the Boring Way (On Purpose)

Retention is deliberately unclever: it's a number in an Airflow Variable. Keep the last N versions of a file in the archive subfolder, where N is whatever the variable says. No migration script, no config file to redeploy - someone decides they want 10 versions instead of 5, they change a number in the Airflow UI. Same instinct as the JSON DSL: push the things that change often out of code and into config, so "policy changed" doesn't mean "open a PR."

## Part 7: Two Ways Out the Door

Not every report is a "browse to a folder in SharePoint" kind of report. Some of them are a "this needs to land directly in one specific person's inbox" kind of report, and for those, the pipeline skips SharePoint entirely: the generated files get bundled into a single zip archive and emailed straight to the stakeholder listed against that report in the `config_table`.

Which path a given report takes isn't a technical decision, it's an audience one - the same instinct that put SharePoint ahead of raw cloud storage in the first place. A report that a team returns to repeatedly benefits from living somewhere persistent with a version history behind it - that's SharePoint. A report that's a one-off, or that's only ever relevant to a single recipient who just wants it in front of them without hunting down a link, doesn't need any of that ceremony - zip it, attach it, send it. Trading away archival history is a real cost, but it's the right cost for that shape of report, and letting the config table decide per-report means nobody has to make that call by hand every time a new one gets added.

## Part 8: Closing the Loop - Reading the File Back

Most of this pipeline is one-directional: data leaves Snowflake, a file gets built, it lands somewhere, done. One pipeline breaks that pattern, and it's the reason the `"locked": true` field from the DSL earlier isn't just about keeping a stakeholder from fat-fingering a formula.

For that pipeline, the delivered Excel file has a deliberate mix of locked and unlocked cells - locked for anything computed or authoritative, unlocked (often paired with a dropdown validation list, like the `Status` example from earlier) for whatever the stakeholder is actually meant to fill in. Once they've made their edits and saved the file back to SharePoint, a separate downstream task fetches that same file - now stakeholder-modified - straight off SharePoint via the Graph API, reads back just the columns that were left editable, and feeds those values back into the pipeline.

It turns what looks like a one-way delivery system into something closer to a lightweight approval workflow, without needing a second application to build or maintain: the same styling engine that made cells editable in the first place is what makes them identifiable and safe to read back later. It's a small feature, but it's the one that gets the most surprised reaction when I describe this system to people - nobody expects "report generator" to also mean "and then it reads its own homework back."

## Part 9: What I'd Tell Past Me

- **A hang is worse than an error, and you should design for it.** An exception gives you a stack trace. A frozen socket gives you nothing - no signal to alert on, no message to search for. If a component _can_ fail silently, assume it eventually will, and build in something (a timeout, a chunk boundary, anything) that forces silence into a signal.
- **Inconsistent failures are a sizing problem in disguise.** If the same input sometimes works and sometimes doesn't, the first question isn't "what's flaky about the network" - it's "what assumption about size or duration is quietly getting violated."
- **"Easy to use" and "efficient at scale" are different axes, and libraries don't advertise which one they optimized for.** `openpyxl`'s object-per-cell model is exactly why it's pleasant for small scripts and exactly why it's brutal on large reports. Worth checking which trade a library made before it's load-bearing in production.
- **Eliminate whole categories of failure where you can, not just individual failures.** Recursively creating the destination path didn't make uploads more resilient - it made an entire class of upload failure impossible. That's a better return on effort than almost any retry logic.
- **Push policy into config, not code.** Retention counts, formatting rules, even delivery method - anything a non-engineer might reasonably want to change, or that varies report-to-report, shouldn't require a deploy.
- **Don't assume delivery is the end of the pipeline.** The most interesting feature in this system exists because someone asked "can it also read the file back after they've edited it," and the answer was yes, almost for free, because the formatting layer already knew which cells were meant to be touched.

## Closing Thought

None of the individual fixes here are clever. Chunked uploads, parallel task execution, idempotent folder creation - all well-worn patterns. What made this pipeline worth writing up is how many different-looking problems turned out to be the same problem: something assumed a unit of work was small, or that a resource already existed, or that delivery only ever moved in one direction. Every fix was some version of "stop assuming, go check" - which is a less satisfying lesson than a clever trick, but a much more durable one.
