---
title: "A Case for Plugin-Style Code Architecture"
date: "2026-08-29"
slug: "a-case-for-plugin-style-code"
description: "A case for building one interface over many backends and an honest look at where clean structure alone doesn't hold."
---

# A Case for Plugin-Style Code Architecture
![A Case for Plugin-Style Code Architecture](/a-case-for-plugin-arch.png)

_A case for building one interface over many backends and an honest look at where clean structure alone doesn't hold._

---

## TL;DR 
Plugin-style architecture simplifies scaling backend integrations by replacing scattered backend classes with a single, config-driven facade. Grouping implementations by structural similarity maximizes shared logic, while explicit mechanisms such as surfaced behavioral guarantees, strict schema enforcement, and segregated interfaces, directly prevent leaky abstractions and config sprawl. Rather than aiming for an ideal taxonomy, this approach establishes a practical, maintainable baseline that makes future extensions predictable and low-risk.

## The problem that starts it all

Picture this: your team needs to upload files to a NAS. Someone writes an `NASUploader` class: connects, authenticates, writes the file, handles retries. Six months later, a new project needs S3 instead. Someone copies the NAS class, swaps out the internals, calls it `S3Uploader`. Then SharePoint. Then ADLS. Then GCS.

Now you have five classes that are 80% identical boilerplate and 20% backend-specific logic, scattered across the codebase, each with slightly different method names, slightly different error handling, slightly different assumptions about what "done" means. Someone calling any of them has to know, upfront, which one they're calling and how it behaves.

Then a sixth backend shows up. And whoever picks up that ticket has to touch code that has nothing to do with the new backend, just to figure out where the pattern lives and how to extend it.

This is the moment that plugin-style architecture exists to prevent.

## The core idea

The philosophy is simple to state and harder to execute well: **every piece of functionality should be an isolated, swappable unit with a well-defined input/output contract, configured rather than hardcoded, and composed behind a single point of access.**

Concretely, for the upload example: instead of five classes a caller has to choose between, there's one `Uploader` - configured upfront with which backend to target - behaving identically from the outside no matter what's running underneath. The caller sets parameters, calls `upload()`, and doesn't need to know or care whether the plumbing underneath is NAS, S3, or SharePoint.

```python
uploader = Uploader(backend="s3", bucket="my-data", region="us-east-1")
uploader.upload(local_path, remote_key)
```

Swap `backend="s3"` for `backend="sharepoint"` and nothing else in the calling code changes. That's the whole point.

## This isn't a new idea - and that's a feature

This pattern has names, and it's worth using them, because it means you're not inventing architecture from scratch, you're applying something proven.

- **Strategy pattern**: the behavior (which backend logic runs) is selected and injected rather than hardcoded.
- **Factory pattern**: a registry or factory function maps a config value (`"s3"`) to a concrete implementation, so adding a new backend never touches the facade.
- **Ports and Adapters (Hexagonal Architecture)**: the "port" is the interface contract; each backend is an "adapter" implementing it.

Structurally, this settles into three tiers:

1. **The interface** - the contract every backend must honor (`upload()`, `set_params()`, whatever the common surface is).
2. **The facade** - the single class the caller actually touches, config-driven, backend-agnostic.
3. **The concrete implementations** - where all the backend-specific eccentricity actually lives.

## This isn't academic either

This pattern is already running in production in tools most data engineers use daily:

- **dbt's adapter architecture**: a common `BaseAdapter` interface, with Snowflake, BigQuery, Databricks, and others implementing it. Writing a dbt model doesn't require knowing which warehouse you're targeting - the adapter absorbs that.
- **Airflow's providers**: hooks and operators are grouped into provider packages - all AWS-related hooks live together, all GCP-related hooks live together - rather than being scattered as one-off integrations.
- **Terraform providers**: the same shape at infrastructure scale - one declarative interface, many backend implementations.

None of these tools invented plugin architecture. They just took it seriously enough to make it the backbone of the whole system. Notice, too, that Airflow doesn't just have a flat list of hooks - it groups them by provider. That grouping isn't incidental. It's the next idea.

## The layer that's often forgotten: semantic taxonomy

A single flat interface with five backends bolted on underneath is *better* than five scattered classes, but it's not the whole answer. Not all backends are equally different from each other. Some backends are more equal than other backends.

NAS and SharePoint are both hierarchical, path-based, permission-model-driven file systems. S3, ADLS, and GCS are all key/blob-based object stores with different consistency and pagination behavior than a file system. Treating all five as siblings under one flat registry throws away real structural similarity that could be shared code - and forces you to either leak backend-specific quirks into the top-level interface, or duplicate logic that two backends both actually need.

The fix is an intermediate layer:

```python
class FileSystemUpload(BaseUpload):
    # shared logic: path semantics, locking behavior, permission checks
    ...

class ObjectStoreUpload(BaseUpload):
    # shared logic: key semantics, multipart uploads, eventual consistency handling
    ...

class NASUploader(FileSystemUpload): ...
class SharePointUploader(FileSystemUpload): ...

class S3Uploader(ObjectStoreUpload): ...
class ADLSUploader(ObjectStoreUpload): ...
class GCSUploader(ObjectStoreUpload): ...
```

There's an important caveat here: there is no single correct taxonomy. Whether you group by storage model, by auth mechanism, or by consistency guarantees depends on which axis actually saves you duplicated logic in your specific system. The goal isn't to find *the* right grouping - it's to find one that's *optimal enough* for your domain, and to be willing to revisit it as new backends reveal that your original grouping missed something.

## Where it gets hard

Everything above is the comfortable part of the argument. Here's the part that actually determines whether the architecture holds up in production.

### Leaky abstractions aren't a routing problem

It's tempting to think leaky abstractions are solved by clean delegation - the facade calls only the assigned backend's functions, exposes only the common denominator, and routes anything specialized down into the concrete class. That's good structure, but it doesn't touch the actual leak.

The leak lives in the *caller's assumptions*, not in how cleanly your code is routed. If your `upload()` contract implicitly promises "the file is readable immediately after this returns," that's true for NAS and false, in some circumstances, for S3 or SharePoint - replication lag, virus-scan queues, throttling. No amount of clean internal delegation changes that; the caller's mental model was built against one backend's behavior and breaks silently against another.

The real fix is to make the inconsistency a first-class part of the contract instead of hiding it:

```python
receipt = uploader.upload(local_path, remote_key)
if not receipt.durable:
    uploader.await_availability(receipt)
```

On NAS, `await_availability()` is a no-op. On S3, it actually polls. The abstraction doesn't pretend the difference doesn't exist - it gives the caller a way to handle it explicitly.

### When abstraction is actually premature

The instinct to abstract early, "because it might grow," is defensible - but only if you tighten the claim. The classic argument against it isn't that early abstraction wastes effort, it's that guessing wrong about the *shape* of future growth locks you into a structure that fights the real requirement when it finally arrives. Sandi Metz's framing is useful here: duplication is cheap to fix because it's local - two similar blocks sitting side by side, easy to compare. A wrong abstraction is expensive because it's non-local - every caller and every implementer now depends on a shape that turned out to be wrong.

A reasonable middle ground: abstract after you've seen two or three real cases, not zero. And the reason it's safe to abstract even a little early is the isolation principle from earlier. If every component is genuinely independent, a wrong guess costs you one class rewrite, not a cascading refactor across the system. Isolation is what makes early abstraction *cheap to undo*, which is the real argument for doing it, not just "it might be extensible."

### Config sprawl isn't a discipline problem

It's tempting to think config sprawl is solved by team discipline, just don't add fields you don't need. In practice, discipline doesn't survive contact with a deadline. Someone needs one more parameter for one more edge case, and the fastest path is bolting it onto the config object rather than touching the code that's supposed to own it. A year in, nobody can say which fields are load-bearing and which are dead weight from a backend nobody uses anymore.

The leak here is structurally the same one from the durability example above: a boundary that isn't enforced eventually gets violated, no matter how well-intentioned the people crossing it are. Frankly, I don't have any solid or robust fix or even an idea for this. I have been the culprit of adding fields to widen the capabilities. I have come to believe that perhaps the most sound, if not the best, way to handle it is to enforce a strict contract - make sure to cover all bases in design to have n columns cover everything - but that asks for a foresight which gets proven wrong under the weight of quick fixes and shortcuts.

### SOLID tells you what good looks like, not how to get there

It's tempting to think that following SOLID closely enough makes future change safe by default - keep components independent, and evolution takes care of itself. That holds for adding a *new* implementation of an existing interface. It doesn't hold for changing the interface itself.

Say five backends already implement `Uploader`, and a new requirement needs progress callbacks for large, slow uploads. Adding `upload_with_progress()` as a required method breaks all five implementers at once. Independence didn't prevent that, because the break isn't between components - it's in the shared contract all five depend on.

The fix, in the same spirit as the durability split earlier, is to segregate the new capability into its own interface rather than force it into the existing one:

```python
class Uploader(Protocol):
    def upload(self, path: str, dest: str) -> Receipt: ...

class ProgressReportingUploader(Protocol):
    def upload_with_progress(self, path: str, dest: str, on_progress: Callable) -> Receipt: ...
```

Old implementers stay untouched; callers that need progress reporting check for it (`isinstance(uploader, ProgressReportingUploader)`) instead of requiring every backend to support it. SOLID describes the shape a good fix has - it doesn't hand you the fix automatically, the same way "isolate your components" didn't automatically tell you *which* boundary to isolate on until you'd actually hit the break.

## My mantra developed over the years

- One facade per capability, config-driven, backend-agnostic to the caller.
- Interface exposes only the true common denominator; specialized behavior lives in the concrete class, never in the facade.
- Group implementations by genuine structural similarity, not just by "they do roughly the same thing" - and expect to revisit that grouping.
- Don't hide behavioral differences between backends behind a uniform contract - surface them explicitly where they matter (durability, latency, consistency).
- Abstract after seeing two or three real cases, not zero - and lean on strict isolation to make an early guess cheap to undo.
- Config and code work well when the contract is solid. Spread it far enough and you land in a world of trouble.
- Pick a concrete mechanism for interface evolution before you need it - segregated interfaces, default methods, expand-contract, or explicit versioning.

## Closing

Eventually, a sixth backend shows up. That's not a sign the original design failed - it's the expected, healthy event a plugin architecture is built to absorb. The classes stay isolated, the facade stays unchanged, and the only real decision left is the one that never fully resolves: does this new backend belong in an existing semantic group, or does it need one of its own? There's no permanently correct answer to that question. There's only the next-best taxonomy, revisited every time the system grows.