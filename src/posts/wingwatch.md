---
title: "WingWatch: Building a Data Pipeline for the Sky"
date: "2025-03-12"
slug: "wingwatch"
description: "How I built a production-style aviation data pipeline using Airflow, dbt, PostgreSQL, and Grafana — and why every tool choice was deliberate."
---

# WingWatch: Building a Data Pipeline for the Sky

I have a habit of looking up at the sky and wondering where a plane is going. Occupational hazard of working in data, maybe — once you start asking "what's happening right now?", you immediately want a dashboard for it.

WingWatch started from that exact question. It's a real-time aviation data pipeline that pulls live flight data from OpenSky, enriches it with airport and weather information, and pushes it through a full medallion architecture — Bronze → Silver → Gold — into Grafana dashboards. It answers things like: which flights are approaching right now, how many aircraft are broadcasting an emergency squawk, and what the distribution of flight phases looks like at any given moment.

The [repo is here](https://github.com/asdhamidi/WingWatch) if you'd rather read code than prose.

---

## The Questions That Drove It

The project was designed around four concrete questions I genuinely wanted to answer:

- Which flights are approaching a specific airport right now?
- How many aircraft are broadcasting emergency squawks (7500/7600/7700)?
- What percentage of flights are climbing vs. cruising vs. descending at this moment?
- Which airlines are currently flying the rarest or most unusual aircraft types?

These aren't toy questions. They're the kind of thing an airline ops team or an aviation analyst would actually care about. Starting with real questions kept the pipeline honest — every model and transformation had to justify itself against an answer it was helping produce.

---

## The Stack and Why

**Airflow** for orchestration. At this data volume, a cron job would technically work. I chose Airflow deliberately to practice the patterns that matter at production scale: DAG dependencies, retries, backfills, and proper monitoring. The goal was never to solve the smallest problem with the smallest tool.

**PostgreSQL** as the warehouse. People sometimes raise an eyebrow at this — why not Snowflake or BigQuery? Because the point was to prove the medallion *pattern* itself, independent of any specific warehouse engine. The dbt models are portable; swapping the target is a `profiles.yml` change, not a pipeline redesign. And it runs entirely on a laptop with zero cloud cost.

**MinIO** as the raw/landing zone. MinIO is S3-API-compatible by design. The ingestion logic that writes to MinIO here is the same code that would talk to real AWS S3 in production. This wasn't an arbitrary pick — it's what makes the raw layer directly portable to a cloud environment without a rewrite.

**dbt** for transformations. SQL-based, version-controlled, and testable. Every model has schema tests. I also wrote custom Python DQ checks for null, duplicate, and range validation. The data quality layer isn't an afterthought — it's built into the silver and gold layers so bad data doesn't silently poison a dashboard.

**Grafana** on top of the Gold schema for visualization. Dashboards refresh every five minutes from live API polling.

The whole thing spins up with `docker-compose up -d --build`. No manual setup, no hidden steps.

---

## Medallion Architecture Without a Data Lake

The medallion pattern is usually talked about in the context of Delta Lake or Databricks. WingWatch proves it works just as well on Postgres — the principles are the same:

- **Bronze**: Raw data ingested from APIs, stored as-is in MinIO, then loaded into a Postgres bronze schema. No transformation, no opinion.
- **Silver**: dbt models clean the data, standardize fields, and add metadata. This is where duplicates get removed and nulls get handled.
- **Gold**: Aggregated, business-ready tables. Flight phases, emergency counts, peak traffic by airline. These are what the dashboards actually read.

The data flow looks like this:

```
OpenSky / OpenWeather / Airports API
         ↓
       MinIO (raw JSON / CSV)
         ↓
   Airflow DAGs (11 total)
         ↓
  Postgres → Bronze → Silver → Gold
         ↓
     Grafana Dashboards
```

Eleven Airflow DAGs handle the orchestration across the full flow, from raw ingestion all the way through to gold. A master pipeline DAG ties them together and manages dependencies.

---

## The Numbers

After running the pipeline for a while:

- **10M+ flight records** processed end to end
- **20+ KPIs** computed across flight status, emergencies, and traffic patterns
- **15 dbt models** with schema tests and custom DQ checks
- **11 Airflow DAGs** orchestrating the bronze → silver → gold flow
- Dashboards refresh every **5 minutes** from live polling

---

## What I'd Do Differently

The one thing I'd change: streaming. Right now, OpenSky is polled on an interval. That was a deliberate scope decision — I wanted the medallion + orchestration + data quality pattern solid before layering in streaming complexity. But the Kafka integration is the obvious next step, and honestly the reason I built LogWeave afterwards (a Kafka-based pipeline for home router telemetry — different post).

The other thing on the roadmap is a flight delay prediction model on top of the Gold layer. The data is all there; it's just a matter of sitting down and building it.

---

## Final Thought

WingWatch is the kind of project I'd want to see in a portfolio — not because it's flashy, but because every piece of it is justified. The tools aren't there because they're trendy; they're there because they model what a real data platform looks like. And if you stare at the sky long enough, eventually you build a pipeline to explain it.
