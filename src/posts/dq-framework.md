---
title: "A Practical Architecture for Config-Driven Data Quality"
date: "2026-09-05"
slug: "a-practical-dq-architecture"
description: "Three wrong turns, a few hard-earned principles, and a DQ framework designed to stay simple when the data - and the team - gets messy."
---

# A Practical Architecture for Config-Driven Data Quality
![A Practical Architecture for Config-Driven Data Quality](/dq-framework.png)
_Three wrong turns, a few hard-earned principles, and a DQ framework designed to stay simple when the data - and the team - gets messy._

---

## TL;DR

I designed a config-driven data quality framework for Snowflake after rejecting three common approaches: opaque JSON configs, overly sparse explicit schemas, and positional parameter arrays. The final design favors **explicit, self-documenting configuration**, a **uniform contract for all checks**, and a **Python ports-and-adapters engine** that keeps warehouse-specific logic isolated. Checks run concurrently with isolated sessions, failures are handled centrally, and expensive detail queries only run when checks fail. I also deliberately kept orchestration, alerting, dashboards, versioning, and retries outside the core framework. The result is a DQ layer that's **simple to operate, portable by design, and easy to extend**-without pretending there's one “right” architecture for every team.

## The Background
I've spent the last several years moving between data engineering projects, professional and private, and one thing has been constant across almost all of them: a data quality framework that everyone tolerates but nobody loves. I've seen the shape this takes over and over. One team's DQ setup had grown to a dozen interlocking config tables, and you needed to have been there for the last three "improvements" to know which one actually controlled whether a check ran. Another team had wired their checks so tightly into dbt that the DQ layer *was* the dbt project - you couldn't run a check without a dbt invocation, and god forbid if the Jinja was incorrect, you couldn't tell if the check failed or the framework. A third had built the whole thing as Snowflake stored procedures, which worked great until the day a migration to a different environment became a real possibility, and someone realized the entire quality layer was non-portable business logic sitting inside `CREATE PROCEDURE` statements that no-one understood. And more than one was simply hard to add a check to - you'd open the config table, stare at eight cryptic columns, and go ask someone on Teams what `CHILD_RULE_ID_4` meant this time.

None of these were built by careless people. They were built by competent engineers _[citation needed]_ solving real problems under real deadlines, and each one optimized for something reasonable - flexibility, dbt-native testing, warehouse-native performance - and paid for it somewhere else. That's really what this whole exercise was: not "let me build the correct DQ framework," because I don't think that exists, but "let me be honest about the trade-offs and pick the ones I can live with." Everything below - the schema, the engine, the choices I walked back mid-design - comes out of trying to solve those specific, lived pains, not out of a belief that this is *the* answer. Someone else with different scars would build this differently, and reasonably so.

This post walks through the data model and the engine as they ended up, but more importantly, through the road *not* taken at each step - because the discarded options are where most of the actual reasoning lives.

---

## The Philosophy

A few principles kept resurfacing enough that I think they're worth naming before the details, because almost every decision below is one of these applied to a specific problem:

1. **Explicit beats implicit, even when it costs you rows or columns.** If understanding a check requires knowing a convention that lives in someone's head or a confluence page, the framework has already failed at its main job - being maintainable by whoever's on call, not just whoever built it.
2. **Simple beats clever.** A slightly more repetitive schema that anyone can read beats an elegant, compact one that requires a decoder ring.
3. **The schema should be its own documentation.** `DESCRIBE TABLE` should tell you almost everything a wiki page would, because wiki pages go stale and tables don't.
4. **Special cases are allowed to be special - but only if they're genuinely special.** Don't force two fundamentally different kinds of checks into the same row shape just for consistency's sake; don't invent five kinds of specialness because you were too lazy to find the general case, either.
5. **Make the common path cheap and the rare path merely possible.** Most checks pass. Don't pay a query, a column, or a mental tax for the failure case on every single run.
6. **Decouple what a check *is* from how it *runs*.** The config schema should never need to know which language or warehouse executes it. The engine should never need to know what a "valid" RANGE check looks like beyond its contract.

---

## The Data Model - Three Wrong Turns Before the Right Shape

The framework rests on three tables: `DQ_CHECK_CONFIG` (what to check), `DQ_RESULTS` (what happened), and conceptually a `DQ_TEMPLATES` table (how the SQL for each check type is shaped) - I'll be upfront later about where that third one currently stands. But the interesting part isn't the final shape; it's the two shapes I tried and rejected before landing here, because each rejection maps directly onto principle #1 through #4 above.

### Attempt 1: A generic `PARAMETERS` column (VARIANT/JSON)

The instinct almost everyone reaches for first - including me - is: different check types need different fields, so store the differences in a flexible JSON blob and keep the table narrow.

```
CHECK_ID: 101
CHECK_TYPE: RANGE
TABLE: ORDERS
COLUMN: AMOUNT
PARAMETERS: {"min": 0, "max": 100000}
THRESHOLD: 0.01
```

This is genuinely flexible - you can add a check type without touching the schema. It's also exactly the failure mode I'd lived through before: to add a RANGE check, you need to already know the key is `min`/`max` and not `lower`/`upper` or `minimum`. That knowledge lives nowhere the schema can tell you. `DESCRIBE TABLE` shows you one column, `VARIANT`, and nothing else. This is principle #1 and #3 failing simultaneously - the schema stopped being able to teach anyone anything, and every new check author needed tribal knowledge to fill in a row correctly. I discarded this almost immediately, because it was the exact shape of the frameworks I'd already been burned by.

### Attempt 2: Fully explicit columns, one per concept

The overcorrection: name *everything*. `LOWER_BOUND`, `UPPER_BOUND`, `REGEX_PATTERN`, `EXPECTED_DATA_TYPE`, `ALLOWED_VALUES`, `OUTLIER_METHOD`, `OUTLIER_SENSITIVITY`, `REFERENCE_DATABASE`, `REFERENCE_SCHEMA`, `REFERENCE_TABLE`, `REFERENCE_COLUMN`... by the time every check type got its own named fields, the table had ballooned to 25-30 columns, most of them NULL on any given row.

This solved the readability problem completely - anyone could look at the columns and know exactly what to fill in - but introduced a new one: authoring a check now meant scrolling past twenty irrelevant fields to find the three that mattered, and every new check type meant an `ALTER TABLE` plus more permanent sparsity. It wasn't unmaintainable, but it wasn't *pleasant*, and a framework people don't enjoy using is a framework people route around.

### Attempt 3: Named structural columns + positional arrays

The next idea was a compromise: keep the columns for anything that's a genuine structural or algorithmic choice (like `TEMPLATE_ID` picking which SQL shape runs), and collapse the *values* a check needs into one small array column, `COMPARISON_VALUES`, whose meaning is fixed per check type - index 0 is "lower bound" for RANGE, but "sensitivity" for OUTLIER.

This looked elegant on paper and cut the column count way down. But it reintroduced the exact problem Attempt 1 had, just wearing a different costume: `COMPARISON_VALUES[0]` means something different depending on `CHECK_TYPE`, and that mapping lives outside the schema again. Worse than the JSON case in one way - a JSON key at least self-documents when you look at the row (`{"min": 0}` tells you something even without a wiki); an array index (`[0, 100000]`) tells you nothing at all. Swap the two values by mistake and nothing errors, the check just silently means something different. I killed this one myself, mid-design, for exactly that reason - principle #1 again, in a subtler disguise.

### What I landed on: named columns, but one row can wear many hats

The final shape keeps Attempt 2's explicitness but fixes its ergonomics with one structural change: **a single config row targets one table+column, and can activate *multiple* check families at once**, each through its own named fields.

```
CHECK_ID: 203
TABLE: ORDERS
COLUMN: ORDER_AMOUNT
NULL_CHECK_ACTIVE: TRUE
LOWER_BOUND:  0
UPPER_BOUND: 100000
RANGE_THRESHOLD: 1.0%
OUTLIER_SENSITIVITY: 3
OUTLIER_THRESHOLD: 1.0%
CRITICALITY: WARN
```

One row, three checks (NULL, RANGE, OUTLIER) fired off it. This is still explicit - every populated column name tells you exactly what it configures - but it avoids the sparsity explosion of pure Attempt 2 for the common case of "several related checks on the same column," which is genuinely how people think about data quality: *this column shouldn't be null, should be in this range, and shouldn't have wild outliers* is one mental unit, not three unrelated config entries.

The one real cost of this consolidation - and it's a genuine trade-off, not a free lunch - is that a threshold and criticality shared across all checks on a row would be wrong (a NULL violation is often "notify someone now," while an OUTLIER on the same column might be "just log it"). The fix ended up being simple: thresholds live *per check family* (`NULL_THRESHOLD`, `RANGE_THRESHOLD`, `OUTLIER_THRESHOLD` are separate fields), while `CRITICALITY` and `SCHEDULE_GROUP` stay row-level - and if two checks on the same column genuinely need different criticality or scheduling, you simply don't consolidate them. Split them into two rows. Consolidation is an *option* the schema makes convenient, not something it forces on you. That's the resolution to principle #2 and #1 pulling in opposite directions: stay simple by default, stay explicit when it actually matters.

RECON (comparing two arbitrary queries) and CUSTOM (raw admin-authored SQL) don't fit the "one column, many checks" shape at all - they're table-level, not column-level, concerns. Rather than force them into columns they don't belong in, they stay as their own rows with their own fields (`RECON_SOURCE_SQL`/`RECON_TARGET_SQL`/`RECON_TOLERANCE_PCT`, `CUSTOM_SQL`). This is principle #4 in practice: they're genuinely different in shape, so they're allowed to look different, rather than being contorted into false consistency with everything else.

### The rest of the config table, briefly

Beyond the check-family columns, every row also carries: `CHECK_STATUS` (`DRAFT` / `SHADOW` / `ACTIVE` / `RETIRED`), `ROW_IDENTIFIER_COLUMNS` (the natural key used to fetch sample failing rows - separate from whatever column is actually being checked, since a NULL check on `AMOUNT` needs `ORDER_ID` back, not `AMOUNT`), and the usual operational fields (`OWNER`, `SCHEDULE_GROUP`, timestamps).

### DQ_RESULTS: one shape for everything

Every check type - no matter how different its SQL - evaluates to the same result row:
```
RUN_ID: <run_id>
CHECK_ID: <check_id>
CHECK_TYPE: <check_type>
STATUS: <status>
TOTAL_ROWS: <total_rows>
FAILED_ROWS: <failed_rows>
FAIL_PCT: <fail_pct>
THRESHOLD_TYPE: <threshold_type>
THRESHOLD_VALUE: <threshold_value>
PASS_FAIL_FLAG: <pass_fail_flag>
CRITICALITY: <criticality>
CHECK_STATUS_AT_RUN: <check_status_at_run>
RENDERED_SQL: <rendered_sql>
SAMPLE_FAILED_KEYS: <sample_failed_keys>
ERROR_MESSAGE: <error_message>
EXECUTION_TIME_MS: <execution_time_ms>
EXECUTED_AT: <executed_at>
```

Two design choices here matter more than they look:

- **`STATUS` and `PASS_FAIL_FLAG` are two different fields on purpose.** A check can run successfully and find zero problems (`STATUS=SUCCESS, PASS_FAIL_FLAG=PASS`), run successfully and find real problems (`STATUS=SUCCESS, PASS_FAIL_FLAG=FAIL`), or fail to run at all because someone wrote bad SQL (`STATUS=ERROR, PASS_FAIL_FLAG=NULL`). Conflating these - which I've seen done - means an on-call engineer can't tell "the data is bad" from "the framework is broken" without opening logs. That distinction alone probably saves more debugging time than anything else in this design.
- **`RENDERED_SQL` is stored on every single row**, not just failures. It costs almost nothing in Snowflake's columnar storage and it's the difference between explaining a check result in thirty seconds versus needing to reproduce someone's config-row state from three edits ago. Any time a check's behavior seems to have changed, the honest first question is "did the data change, or did the SQL that runs against it change" - and this field answers that immediately.

`DQ_RUN_LOG` sits one level up: one row per orchestration batch (`RUN_ID`, `SCHEDULE_GROUP`, start/end time, counts of attempted/passed/failed/errored). It answers "did the framework even run" independently of "did the data pass" - two questions that get conflated constantly and shouldn't be.

### An honest gap: DQ_TEMPLATES isn't a live table now

The original three-table concept had `DQ_TEMPLATES` as a real Snowflake table holding the SQL shape for each check type, editable without a code deploy. In the engine as built, the templates live in a Python module (`templates/default_templates.py`) instead - a dictionary keyed by check type, holding the "aggregate" query (for pass/fail) and an optional "detail" query (for pulling sample failing rows, only run when a check actually fails).

It's a real gap against the original vision, not a redesign decision. The reason - it's a cheap gap to close later is exactly the architecture described in Part 2 - templates are accessed behind the same seam (a port) that everything else in this engine goes behind, so promoting them from a code dictionary to a live, admin-editable Snowflake table is "write one more adapter," not "redesign the engine."

---

## The Engine - Ports, Adapters, and What I Didn't Build

The engine is Python, using the Snowflake connector, structured around ports-and-adapters (hexagonal architecture). The short version of why: **the core orchestration logic should never need to know whether it's talking to Snowflake, Postgres, or a mock for testing - and it should never need to know the internals of any single check type.** Everything the driver depends on is expressed as an interface (a `Protocol` in Python terms), and the actual implementations plug in from outside.

*The full engine implementation - the config resolver, the check functions, the driver, and a runnable demo mode that needs no live Snowflake connection - is available in this [Github repository](https://github.com/asdhamidi/dq-atlas).*

### The workflow, end to end

Before getting into why each piece is shaped the way it is, here's what actually happens on a real run against Snowflake - no mock session, no CSV fallback, the full path from CLI invocation to the two log tables:
1. CLI starts with one of: `--check-id`, `--table`, `--schedule-group`, or `--run-all`.

2. SnowflakeConfigLoader loads configurations from `DQ_CHECK_CONFIG` where status is `ACTIVE` or `SHADOW`, applying the requested filter.

3. Resolve Check Instances — each configuration row is expanded into one `CheckInstance` for each active check family.

4. Run Checks Concurrently using `ThreadPoolExecutor`, with one task submitted per `CheckInstance`.

5. Dispatch Check using `CHECK_REGISTRY[check_type]`.

6. Render SQL from `DEFAULT_TEMPLATES`.

7. Execute SQL using a thread-local `SnowflakeSession`.

8. Check for execution error:

   * If no error → calculate failure percentage → evaluate pass/fail → create `CheckResult(STATUS=SUCCESS)`.
   * If error → catch `CheckExecutionError` → create `CheckResult(STATUS=ERROR)`.

9. Collect all CheckResults as each concurrent task completes.
10. Check whether any check failed:
    * If `STATUS=SUCCESS` and `PASS_FAIL_FLAG=FAIL` → fetch failed records.
    * Otherwise → skip detail fetching.

11. Fetch Failed Records only when the failing check has:

    * a `DETAIL` template, and
    * `ROW_IDENTIFIER_COLUMNS` configured.

12. Log Results with one batched `INSERT` into `DQ_RESULTS`.

13. Build RunSummary containing:

    * attempted
    * passed
    * failed
    * errored

14. Log Run Summary with an `INSERT` into `DQ_RUN_LOG`.

15. Return RunSummary back to the CLI.


A few things worth noticing in this shape that don't come through in prose as clearly: the config query itself is the only place `CHECK_STATUS` gets filtered - once a check is loaded, `SHADOW` and `ACTIVE` are treated identically all the way through (the distinction only matters to a downstream alerting layer that isn't built yet). The detail-fetch branch only exists at all if at least one check actually failed - on an all-green run, that whole box is skipped. And there's exactly one write to `DQ_RESULTS` and one write to `DQ_RUN_LOG` per run, both batched, regardless of whether the run covered one check or two hundred.

### Why not a stored-procedure engine

This was the most direct rejection of a pain point I'd lived through. A stored-procedure-based DQ engine performs well and keeps compute close to the data, but it buys that with two costs I wasn't willing to pay again: it's hard to unit test (you're testing against a live warehouse, always), and it's genuinely difficult to port - the logic *is* the platform. The day someone proposes evaluating a different database, or even just running the same checks against a second Snowflake account with different SQL quirks, a stored-procedure engine forces a rewrite. A Python engine with the actual warehouse connection hidden behind a `SessionPort` interface doesn't have that problem - more on this in the portability section below.

### Why not dbt tests

dbt's testing framework is genuinely good at what it's built for: testing models as part of a dbt build. But that's exactly the constraint - a check becomes inseparable from dbt's build lifecycle, its Jinja templating, and its project structure. That's a fine trade if every table you need to check is a dbt model built by that same project. It falls apart the moment you need to check a table dbt doesn't own, reconcile two systems dbt doesn't know about, or run quality checks on a completely different cadence than the transformation pipeline. I wanted DQ to be its own concern with its own lifecycle - connected to the data platform, not fused to any one transformation tool.

### The uniform contract, and the two checks that don't quite fit it

Every check function returns the same shape: `total_rows` and `failed_rows` (which the shared evaluation logic turns into `fail_pct` and a `PASS`/`FAIL` verdict against the configured threshold). This is what lets a single logging function, a single evaluation function, and a single driver loop handle NULL, DUPLICATE, RANGE, TYPE, DATA_TYPE, CHECKLIST, OUTLIER, and REF checks without a single special case among them.

RECON and CUSTOM don't naturally fit. RECON runs two independent queries and diffs them in Python - there's no single SQL statement that produces `total_rows`/`failed_rows`. Rather than giving RECON its own results schema (which would leak into every downstream consumer - dashboards, alerting, the logger - needing to know about a special case), it's forced into the same contract: `total_rows=1`, `failed_rows` is 1 or 0 depending on whether the diff exceeded tolerance. It's a small fiction, but it keeps the fiction contained to one file (`checks/recon_check.py`) instead of spreading it through the whole pipeline. CUSTOM checks are simpler - the admin's raw SQL just has to alias its own output as `TOTAL_ROWS`/`FAILED_ROWS`, same as everything else; if they don't, the check fails loudly with a clear error rather than silently returning nothing, which was a real failure mode in an earlier version of this same design.

### The registry: one place that knows "which columns imply which check"

A config row can activate several checks at once (per Part 1), and something has to decide that. That logic - "if `NULL_CHECK_ACTIVE` is true, build a NULL check; if `LOWER_BOUND` or `UPPER_BOUND` is populated, build a RANGE check" - lives in exactly one function, `resolve_check_instances`, rather than inside the driver. The alternative I didn't take was folding that logic into the orchestrator itself, which would have coupled the driver to the specific shape of the config table. As it stands, the driver only knows "call `resolve_check_instances`, get back a list of checks, look each one up in a registry, run it" - it has zero knowledge of what a RANGE check even is. Adding check type #11 later means adding one branch to the registry and one new file in `checks/`; the driver source code never changes.

### Check functions raise; the driver catches

Every check function is written to *raise* on failure - a bad identifier, a SQL compile error, whatever - rather than catching its own exceptions. The one exception-catching site in the whole system is the driver. This was a deliberate call against letting every check type build its own error-handling convention, which in practice always drifts: one check type's error message format ends up different from another's, and a on-call engineer has to learn ten dialects of "something went wrong" instead of one.

### Concurrency: threads, bounded, isolated

Each check is I/O-bound - almost all its time is spent waiting on Snowflake's network response, not doing CPU work in Python. That rules out multiprocessing (which pays process-startup overhead for no CPU-bound benefit here) and made `asyncio` more machinery than the problem warrants at this scale (tens to low hundreds of checks, not thousands, and the Snowflake connector's async story is less mature than its synchronous one). A bounded `ThreadPoolExecutor` was the simplest tool that actually fit the workload.

Two guardrails came directly out of things that go wrong with naive threading against Snowflake specifically: the connector's session objects aren't safe to share across threads, so each worker thread gets its own connection, not a shared one; and every check's exceptions are caught *per future*, so one thread hitting an unexpected error never drops other results from the batch or crashes the run.

### Detail-key fetching: only pay for what fails

Fetching the actual failing row keys (not just a count) requires a second query. Running it unconditionally would double the query volume of the entire framework for no benefit on the checks that pass - which is most of them, most of the time. So it only fires when a check's `PASS_FAIL_FLAG` is `FAIL`, and only for check types that have a meaningful row-level concept of "a failing row" (a DATA_TYPE check comparing metadata, or a RECON check comparing two counts, doesn't have failing *rows* to sample). This is principle #5 directly: the rare path (a check failing) is allowed to cost more; the common path (a check passing) stays cheap.

### Shadow mode instead of a plain on/off switch

`CHECK_STATUS` replaces what would naturally be a boolean `ACTIVE_FLAG` with four states: `DRAFT → SHADOW → ACTIVE → RETIRED`. A new check starts in `SHADOW` - it runs and logs results, but (in a full deployment) wouldn't trigger alerts - so whoever's adding it can watch a week of real fail-rate data and pick a sane threshold, instead of guessing on day one and immediately drowning someone in false-positive pages. This came directly out of watching DQ frameworks get muted or ignored within a month of launch because day-one thresholds were wrong and nobody built in a way to find that out safely.

### What I deliberately didn't build

- **Config versioning / audit history.** I considered a full history table capturing every edit to `DQ_CHECK_CONFIG`. I didn't build it, on purpose - RBAC controls *who* can edit the config, and Snowflake's own `ACCESS_HISTORY`/`QUERY_HISTORY` can already answer "what changed and when" if that question ever needs answering. Additionally, the engine's port and adaptor architecture allows anyone to write their own parser (just one other adapter) which can get the config details from a csv, json, yaml, or even a png file, it only needs to uphold the contract.
- **Orchestration.** No embedded scheduler. Snowflake Tasks, Airflow, or whatever the team already runs is a better answer than reinventing a cron inside this framework.
- **Alerting.** Nothing pages anyone yet. This is a natural next port (a `NotifierPort`, with adapters for Slack/email/PagerDuty) - the driver already knows a check's criticality and pass/fail state, so wiring in a notifier is additive, not a redesign.
- **Dashboards.** `DQ_RESULTS` and `DQ_RUN_LOG` are shaped to be queried by Snowsight, Sigma, or whatever BI tool is already in place, rather than the framework owning its own presentation layer.
- **Freshness checks.** Not implemented, but it's the same recipe as any other check type - one registry branch, one template, one file in `checks/` - so it's a next-afternoon addition, not a redesign.
- **A live `DQ_TEMPLATES` table**, as noted above - still split on this one.
- **Retry logic** for transient network blips, and **per-schedule-group warehouse routing** (so cheap hourly checks and expensive daily ones don't compete for the same compute) - both would live entirely inside the `SessionPort` adapter, without the driver or any check function needing to change at all.

None of these are things the architecture is *missing the ability to do* - they're things I chose not to build in the first pass, because the seam to add each of them later already exists.

---

## The Portability - Built for Snowflake, Not Married to It

This was designed with Snowflake specifically in mind - `INFORMATION_SCHEMA` discovery, Snowflake-flavored SQL functions (`COUNT_IF`, `IFF`, `RLIKE`), the connector's thread-safety quirks. But because every piece of warehouse interaction is hidden behind `SessionPort`, moving this to another database is a matter of writing one new adapter, not redesigning anything.

Two things move, and one thing mostly doesn't. What moves: the `SessionPort` implementation itself (swap Snowflake's connector for `psycopg2`, `google-cloud-bigquery`, or whatever fits), and the SQL inside the templates (`COUNT_IF` becomes a `CASE WHEN` sum on Postgres, `RLIKE` becomes a different regex function elsewhere - real work, but mechanical, contained entirely to `templates/default_templates.py`). What doesn't move: the table shapes. `DQ_CHECK_CONFIG` and `DQ_RESULTS` describe *what to check and what happened* in terms that have nothing to do with any specific warehouse - a NULL check on a column is the same concept everywhere. The driver, the registry, the concurrency model, the error-isolation logic - none of it references Snowflake at all. That separation is the entire point of having chosen ports-and-adapters in the first place, and it's worth being honest that it's not a *zero*-cost move - the SQL dialect differences are real - but the architectural cost of porting this is genuinely small, not a rewrite.

---

## There's No Right Answer Here

I want to be direct about this rather than let it sit as a throwaway line at the end: everything above is my synthesis of my own scar tissue, not a claim that this is the correct way to build a DQ framework. Someone who's mostly been burned by *under*-flexible schemas might reasonably prefer the JSON-blob approach I discarded. Someone operating at a scale where hundreds of check types genuinely need independent lifecycles might want the config-versioning table I decided is just one implementation away. Someone who lives inside dbt and never needs to check anything dbt doesn't own might correctly conclude dbt's native tests are the better tool entirely, and this whole framework is solving a problem they don't have.

What I'd actually defend is not any single decision here, but the process behind them: pick a small number of principles that reflect the pain you're actually trying to avoid, and then make every design choice traceable back to one of them, including the choices to leave things out. If you build this differently because your pains were different, that's not a disagreement - it's the framework working as intended, at one level up.