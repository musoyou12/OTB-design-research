# OTB Data Schema Guide

This document defines the **canonical data schemas**
used across the OTB design intelligence pipeline.

All collectors, parsers, and analyzers MUST follow
these schemas to ensure consistency and reproducibility.

---

## 1. Design Reference Schema

**File:** `design_reference.schema.json`

Used for:
- Crawled website references
- Curated design cases
- Visual/UX benchmarks

### Required Fields
- `id` (uuid)
- `source` (string)
- `domain` (string)
- `brand_name` (string)
- `captured_at` (ISO datetime)

### Optional Fields
- `tone_manner`
- `layout_type`
- `color_palette`

---

## 2. Trend Signal Schema

**File:** `trend_signal.schema.json`

Used for:
- News / RSS
- Google Trends
- Pinterest Trends

Defines how raw signals are normalized
before topic modeling.

---

## 3. Client Brief Schema

**File:** `brief.schema.json`

This schema represents the **anchor input**
for all downstream analysis.

All recommendation outputs are derived
from this structure.

---

## Important Notes

- Raw data MUST NOT bypass schema validation
- Schema changes require versioning
- All downstream modules depend on these contracts
