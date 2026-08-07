---
title: "Hisaab Analytics: When a Bill Splitter Becomes a Data Pipeline"
date: "2025-01-20"
slug: "hisaab-analytics"
description: "How I turned six months of real, messy expense data from a flatmate bill-splitting app into a full medallion pipeline - and what I actually learned building it."
---

# Hisaab Analytics: When a Bill Splitter Becomes a Data Pipeline

Most data engineering portfolio projects use fake data. Synthetic orders, imaginary customers, made-up transactions. There's nothing wrong with that - but there's also nothing at stake, and the data is always suspiciously clean.

I had a better source. A year earlier, I'd built [Hisaab](https://github.com/asdhamidi/hisaab) - a web app for my flatmates and me to track shared expenses. "Bro tu kal ka de de" had become a recurring problem, and a spreadsheet wasn't cutting it. The app worked. People actually used it. Twelve months of real, chaotic, completely unfiltered expense data accumulated in MongoDB.

So naturally, I turned it into a data engineering project.

The [repo is here](https://github.com/asdhamidi/hisaab-pipeline) if you want to skip straight to the code.

---

## Why Real Data Changes Everything

Synthetic datasets are always a little too cooperative. Real data from four people splitting bills over six months is not. There are missing fields, inconsistent categories, timestamps that don't quite line up, and user references that point to records that were edited after the fact.

Dealing with that messiness was the point. Anyone can write a pipeline that handles clean data. The interesting work is in the Silver layer - where you decide what "clean enough" means, what to drop versus fix, and how to make PySpark transformations that survive whatever the actual data throws at them.

---

## The Stack

The pipeline runs fully on Docker Compose - no cloud costs, no external dependencies, spins up on any machine with enough RAM:

- **MongoDB** - source of truth, where Hisaab stores all expense records
- **MinIO** - S3-compatible object store for the Bronze layer (daily exports land here as raw JSON)
- **Apache Airflow** - orchestrates the four DAGs that move data from raw to Bronze to Silver to Gold
- **PySpark** - handles the Silver transformations (type enforcement, foreign key resolution, deduplication)
- **PostgreSQL** - Silver and Gold layer storage
- **Apache Superset** - dashboards on top of Gold

The architecture is a textbook medallion: Bronze holds raw exports exactly as they came out of MongoDB. Silver is cleaned and structured. Gold is aggregated into the things you actually want to answer.

---

## What It Actually Answers

The Gold layer is built around questions that were genuinely interesting to me, not just technically convenient:

- Who's logging the most expenses, and when?
- What's the monthly spending trend across the group?
- Which categories dominate, and for which users?
- Who owes whom, and how do reimbursement cycles actually play out?

These aren't dummy KPIs. I wanted to know the answers. That made the modeling decisions easier - I had an opinion about what "correct" looked like.

---

## What I Actually Learned

**Docker, properly.** I'd used Docker before but always a bit cargo-cult. Building this from scratch - custom Airflow image, health checks, resource limits, service dependencies, init scripts - forced me to understand what was actually happening rather than just copying compose files.

**PySpark in a real transformation context.** Most PySpark tutorials are about processing huge files. This was about getting the *shape* of transformations right - handling schema evolution, resolving references across collections, writing jobs that don't silently drop records when something unexpected shows up.

**The gap between "it works" and "it's reliable."** The data quality checks in this pipeline exist because I ran it without them first and the Gold layer had garbage in it. Nothing teaches you to write DQ checks like seeing a Superset dashboard show a user who spent negative money on groceries.

---

## The Part Nobody Talks About

The hardest part of this project wasn't the pipeline. It was explaining to my flatmates why I needed to export their expense data into a "data lake." Consent acquired. Data anonymized in this post. No flatmates were harmed in the making of this pipeline.

The data is real. I'm not selling it. But if I were, this blog would be the pitch deck.
