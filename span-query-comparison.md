# Episode status-span queries: original vs O(n) rewrite

Both queries derive contiguous `episode.status` spans from `.rule-events` **without** `episode.status_count`. Span boundaries come only from adjacent-row status changes.

Shared result shape:

`episode.id`, `rule.id`, `group_hash`, `status_started_at`, `previous_status`, `episode_status`, `duration_ms`, `status_ended_at`, `data`

**Naming:** **VALUES zip** is the two-pass packed-string rewrite (formerly “test query”). **TOP zip** is the one-pass `TOP(@timestamp, 10000)` neighbor query. Fresh numbers: [Cardinality bench](#cardinality-bench).

---

## Original (O(n²) self-join)

```esql
FROM .rule-events METADATA _id
| WHERE type == "alert" AND space_id == "default" AND `episode.status` IS NOT NULL AND `episode.id` == "f858ebe6-a0ef-4a0e-9aaa-592863f56092"
| EVAL _entry = CONCAT(DATE_FORMAT("yyyyMMddHHmmssSSS", @timestamp), `episode.status`)
| INLINE STATS episode_latest_ts = MAX(@timestamp), _candidates = VALUES(_entry) BY `episode.id`
| MV_EXPAND _candidates
| STATS _prev = MAX(CASE(_candidates < _entry, _candidates, null))
    BY _id, `episode.id`, `rule.id`, group_hash, @timestamp, `episode.status`, data, episode_latest_ts
| EVAL previous_status = SUBSTRING(_prev, 18)
| WHERE _prev IS NULL OR previous_status != `episode.status`
| INLINE STATS _transition_ts = VALUES(@timestamp) BY `episode.id`
| MV_EXPAND _transition_ts
| STATS status_ended_at = MIN(CASE(_transition_ts > @timestamp, _transition_ts, null))
    BY _id, `episode.id`, `rule.id`, group_hash, @timestamp, previous_status, `episode.status`, data, episode_latest_ts
| EVAL duration_ms = DATE_DIFF("ms", @timestamp, COALESCE(status_ended_at, episode_latest_ts))
| RENAME @timestamp AS status_started_at, `episode.status` AS episode_status
| KEEP `episode.id`, `rule.id`, group_hash, status_started_at, previous_status, episode_status, duration_ms, status_ended_at, data
| SORT `episode.id` ASC, status_started_at ASC
```

Mechanism: `VALUES(_entry)` is copied onto **every** row (`INLINE STATS`), then `MV_EXPAND` crosses every event with every candidate. Same pattern again for `status_ended_at`. On 15k events that is ~225M intermediate rows **twice**.

---

## Rewrite (VALUES zip)

```esql
FROM .rule-events
| WHERE type == "alert" AND space_id == "default" AND `episode.status` IS NOT NULL AND `episode.id` == "f858ebe6-a0ef-4a0e-9aaa-592863f56092"
| INLINE STATS episode_latest_ts = MAX(@timestamp) BY `episode.id`
| EVAL _entry = CONCAT(DATE_FORMAT("yyyyMMddHHmmssSSS", @timestamp), "|", `episode.status`, "|", COALESCE(TO_STRING(data), ""))
| STATS _entries = VALUES(_entry) BY `episode.id`, `rule.id`, group_hash, episode_latest_ts
| EVAL _sorted = MV_SORT(_entries)
| EVAL _n = MV_COUNT(_sorted)
| EVAL _prev = MV_APPEND("-", MV_SLICE(_sorted, 0, _n - 2))
| EVAL _pair = MV_ZIP(_prev, _sorted, "\t")
| MV_EXPAND _pair
| GROK _pair """%{GREEDYDATA:prev_entry}\t%{GREEDYDATA:curr_entry}"""
| EVAL prev_status = CASE(prev_entry == "-", null, MV_SLICE(SPLIT(prev_entry, "|"), 1, 1))
| EVAL curr_status = MV_SLICE(SPLIT(curr_entry, "|"), 1, 1)
| WHERE prev_entry == "-" OR prev_status != curr_status
| STATS _starts = VALUES(curr_entry) BY `episode.id`, `rule.id`, group_hash, episode_latest_ts
| EVAL _sorted = MV_SORT(_starts)
| EVAL _n = MV_COUNT(_sorted)
| EVAL _prev = MV_APPEND("-", MV_SLICE(_sorted, 0, _n - 2))
| EVAL _next = MV_APPEND(MV_SLICE(_sorted, 1, _n - 1), "-")
| EVAL _row = MV_ZIP(MV_ZIP(_prev, _sorted, "\t"), _next, "\t")
| MV_EXPAND _row
| GROK _row """%{GREEDYDATA:prev_entry}\t%{GREEDYDATA:curr_entry}\t%{GREEDYDATA:next_entry}"""
| DISSECT curr_entry "%{ts_str}|%{episode_status}|%{data_str}"
| EVAL previous_status = CASE(prev_entry == "-", null, MV_SLICE(SPLIT(prev_entry, "|"), 1, 1))
| EVAL status_started_at = DATE_PARSE("yyyyMMddHHmmssSSS", ts_str)
| EVAL next_ts_str = MV_SLICE(SPLIT(next_entry, "|"), 0, 0)
| EVAL status_ended_at = CASE(next_entry == "-", null, DATE_PARSE("yyyyMMddHHmmssSSS", next_ts_str))
| EVAL duration_ms = DATE_DIFF("ms", status_started_at, COALESCE(status_ended_at, episode_latest_ts))
| EVAL data = data_str
| KEEP `episode.id`, `rule.id`, group_hash, status_started_at, previous_status, episode_status, duration_ms, status_ended_at, data
| SORT `episode.id` ASC, status_started_at ASC
```

Mechanism: collapse to **one** MV per episode (`STATS`, not `INLINE STATS`), sort it, zip each entry with its immediate neighbor, expand once (n rows). Repeat on the kept span-starts so `status_ended_at` is the next **transition**, not the next event.

---

## Line-by-line: what changed

Unchanged in intent: `WHERE`, `KEEP`, `SORT`, and the `duration_ms` formula (`DATE_DIFF` from span start to `COALESCE(status_ended_at, episode_latest_ts)`).

| Original line | Change | Rewrite |
| --- | --- | --- |
| `FROM .rule-events METADATA _id` | **Dropped `METADATA _id`.** `_id` existed only to keep cartesian `STATS BY` rows distinct. Adjacent zip does not need it. | `FROM .rule-events` |
| `WHERE …` | **Unchanged.** | same `WHERE` |
| `EVAL _entry = CONCAT(DATE_FORMAT(...), \`episode.status\`)` | **Changed `_entry` payload.** Added `\|` delimiters and packed `data` as `TO_STRING(data)` because the rewrite collapses rows and must carry `data` inside the MV. Original kept `data` as a live column via `STATS BY data`. | `EVAL _entry = CONCAT(..., "\|", status, "\|", COALESCE(TO_STRING(data), ""))` |
| `INLINE STATS episode_latest_ts = MAX(@timestamp), _candidates = VALUES(_entry) BY episode.id` | **Split and demoted.** `MAX(@timestamp)` stays `INLINE STATS` (scalar, cheap). `VALUES(_entry)` moves to collapsing `STATS` so the MV is **not** copied onto every source row. This is the main memory fix. | `INLINE STATS episode_latest_ts = MAX(@timestamp) BY episode.id` then later `STATS _entries = VALUES(_entry) BY …` |
| `MV_EXPAND _candidates` | **Replaced.** Expanding the full candidate list against every row is the n×n product. | `MV_SORT` + `MV_APPEND`/`MV_SLICE` shift + `MV_ZIP` + `MV_EXPAND _pair` (n rows) |
| `STATS _prev = MAX(CASE(_candidates < _entry, …)) BY _id, episode.id, rule.id, group_hash, @timestamp, episode.status, data, episode_latest_ts` | **Removed.** Lexicographic `MAX` of all smaller `_entry` strings was “previous event”. Neighbor zip gives the same previous entry in O(1) per row. Also removes `data` (flattened) from `STATS BY`. | `EVAL _prev = MV_APPEND("-", MV_SLICE(_sorted, 0, _n - 2))` + `MV_ZIP` |
| `EVAL previous_status = SUBSTRING(_prev, 18)` | **Replaced parser.** Original relied on a 17-char timestamp prefix (`yyyyMMddHHmmssSSS`) and `SUBSTRING(..., 18)`. Delimited `_entry` uses `SPLIT` / `DISSECT` instead. | `EVAL prev_status = CASE(prev_entry == "-", null, MV_SLICE(SPLIT(prev_entry, "\|"), 1, 1))` |
| `WHERE _prev IS NULL OR previous_status != episode.status` | **Same predicate**, different null sentinel. Original: missing prev → `_prev IS NULL`. Rewrite: padded first slot is `"-"`. | `WHERE prev_entry == "-" OR prev_status != curr_status` |
| `INLINE STATS _transition_ts = VALUES(@timestamp) BY episode.id` | **Removed** (second cartesian). | second collapsing `STATS _starts = VALUES(curr_entry) BY …` **after** the transition `WHERE` |
| `MV_EXPAND _transition_ts` | **Removed** (second n×n expand). | `MV_EXPAND _row` over zipped span-starts only |
| `STATS status_ended_at = MIN(CASE(_transition_ts > @timestamp, …)) BY _id, …, data, …` | **Removed.** Neighbor zip of span-starts supplies the next transition timestamp directly. | `EVAL _next = MV_APPEND(MV_SLICE(_sorted, 1, _n - 1), "-")` then `DATE_PARSE` on `next_entry` |
| `EVAL duration_ms = DATE_DIFF("ms", @timestamp, COALESCE(status_ended_at, episode_latest_ts))` | **Same formula**; clock source is parsed `status_started_at` instead of the live `@timestamp` column (lost when rows were collapsed). | `EVAL duration_ms = DATE_DIFF("ms", status_started_at, COALESCE(status_ended_at, episode_latest_ts))` |
| `RENAME @timestamp AS status_started_at, episode.status AS episode_status` | **Removed.** Those fields are parsed out of `_entry` (`DATE_PARSE` + `DISSECT`). | `EVAL status_started_at = DATE_PARSE(...)` and `DISSECT … %{episode_status}` |
| `KEEP …` / `SORT …` | **Unchanged** (same output columns and order). | same `KEEP` / `SORT` |

### Lines that are entirely new (no original counterpart)

These implement “previous/next neighbor” without a self-join:

```esql
| EVAL _sorted = MV_SORT(_entries)
| EVAL _n = MV_COUNT(_sorted)
| EVAL _prev = MV_APPEND("-", MV_SLICE(_sorted, 0, _n - 2))
| EVAL _pair = MV_ZIP(_prev, _sorted, "\t")
| GROK _pair """%{GREEDYDATA:prev_entry}\t%{GREEDYDATA:curr_entry}"""
```

and the second-pass equivalents (`_next`, `_row`, `GROK` of three fields, `DISSECT curr_entry`).

### The two lines that dominate cost

**Original L4–L5** (`INLINE STATS … VALUES(_entry)` + `MV_EXPAND _candidates`) and **original L10–L11** (`INLINE STATS … VALUES(@timestamp)` + `MV_EXPAND _transition_ts`).

Those four lines are the n² memory blow-up. Everything else is parsing or projection.

---

## What actually runs on 15k flaps

Measured against episode `f858ebe6-a0ef-4a0e-9aaa-592863f56092` (15,000 events, flip every row). Heap was already ~82% from the original cartesian query.

| Approach | Result |
| --- | --- |
| Original O(n²) ES\|QL | Hung ~4 min, then leftover heap; request breaker tripped |
| O(n) `VALUES` + `MV_ZIP` + `MV_EXPAND` ES\|QL | `circuit_breaking_exception` `[request] <reused_arrays>` 921.6mb / 921.5mb |
| ES\|QL `KEEP` + `SORT` (no `LIMIT`) | **1000 rows** (Discover/ES\|QL default limit) |
| ES\|QL `KEEP` + `SORT` `LIMIT 15000` | **10000 rows** (ES\|QL max result window) — still missing 5k |
| ES\|QL `STATS _entries = VALUES(_entry)` (1 output row) | Completes (~15ms). Collapse is fine; **re-expanding** is what blows the breaker |
| `_search` `size: 10000` doc values | 94ms, 10k hits |
| `_search` `search_after` pages of 2k + client reduce | **15k events → 15k spans, 235ms, 8 pages** |

ES|QL is capped twice: default 1k, hard 10k. Even a “cheap” console query cannot materialize this episode. The zip rewrite still clones a 15k-wide MV (`MV_SORT` / `MV_ZIP` / `GROK` on expand) into the request breaker — ~13kb over a 921.5mb limit that is already saturated.

### Working recipe (Kibana server or a script)

1. Page `.rule-events` with `search_after` (2k), sort `@timestamp asc`.
2. Doc values only: `@timestamp`, `episode.status`, `episode.id`, `rule.id`, `group_hash`. `_source: false` unless hydrating `data`.
3. Reduce in one pass (no `status_count`):

```text
current = null
for event in ordered events:
  if current is null or event.status != current.status:
    close current (status_ended_at = event.@timestamp)
    open new span (previous_status = current.status)
close last span (status_ended_at = null, duration to last event ts)
```

4. Do not return 15k spans to the browser. Cap or bucket (e.g. one “flapping” band + `transition_count: 15000`).

This completed in **235ms** on the same node that 429s the ES|QL rewrite.

---

## Cardinality bench

Re-run 2026-08-29 via `span_query_perf.py` (same episode per size; **TOP zip** then **VALUES zip**; 15–20s cooldown). Local ES 9.6-SNAPSHOT (heap 1.5gb, request breaker 921.5mb).

**VALUES zip** — packed `DATE_FORMAT`+status+`data`, `VALUES`, two `MV_EXPAND` passes (span start + end/duration).  
**TOP zip** — `TOP(@timestamp, 10000, "asc", …)`, one expand (span starts only; `| LIMIT 10000`).

**1m-rule window** = `docs × 1 minute`. `es_took` is Elasticsearch `took`.

### Pattern A — all-flip (flaps = docs)

| query | docs | flaps | 1m-rule window | spans | es_took | wall | result |
| --- | ---: | ---: | --- | ---: | --- | --- | --- |
| TOP zip | 100 | 100 | 1 h 40 m | 100 | 16 ms (0.02 s) | 18 ms (0.02 s) | ok |
| VALUES zip | 100 | 100 | 1 h 40 m | 100 | 66 ms (0.07 s) | 68 ms (0.07 s) | ok |
| TOP zip | 500 | 500 | 8 h 20 m | 500 | 74 ms (0.07 s) | 76 ms (0.08 s) | ok |
| VALUES zip | 500 | 500 | 8 h 20 m | 500 | 454 ms (0.45 s) | 456 ms (0.46 s) | ok |
| TOP zip | 1000 | 1000 | 16 h 40 m | 1000 | 177 ms (0.18 s) | 182 ms (0.18 s) | ok |
| VALUES zip | 1000 | 1000 | 16 h 40 m | 1000 | 1201 ms (1.20 s) | 1207 ms (1.21 s) | ok |
| TOP zip | 1500 | 1500 | 1 d 1 h | 1500 | 333 ms (0.33 s) | 338 ms (0.34 s) | ok |
| VALUES zip | 1500 | 1500 | 1 d 1 h | — | — | 1424 ms (1.42 s) | 429 `topn` |
| TOP zip | 2000 | 2000 | 1 d 9 h 20 m | 2000 | 615 ms (0.61 s) | 620 ms (0.62 s) | ok |
| VALUES zip | 2000 | 2000 | 1 d 9 h 20 m | — | — | 836 ms (0.84 s) | 429 `<reused_arrays>` |

### Pattern B — longer runs (docs > flaps)

| query | docs | flaps | 1m-rule window | spans | es_took | wall | result |
| --- | ---: | ---: | --- | ---: | --- | --- | --- |
| TOP zip | 1000 | 100 | 16 h 40 m | 100 | 108 ms (0.11 s) | 109 ms (0.11 s) | ok |
| VALUES zip | 1000 | 100 | 16 h 40 m | 100 | 306 ms (0.31 s) | 308 ms (0.31 s) | ok |
| TOP zip | 1000 | 200 | 16 h 40 m | 200 | 92 ms (0.09 s) | 94 ms (0.09 s) | ok |
| VALUES zip | 1000 | 200 | 16 h 40 m | 200 | 325 ms (0.33 s) | 327 ms (0.33 s) | ok |
| TOP zip | 1000 | 500 | 16 h 40 m | 500 | 141 ms (0.14 s) | 143 ms (0.14 s) | ok |
| VALUES zip | 1000 | 500 | 16 h 40 m | 500 | 633 ms (0.63 s) | 638 ms (0.64 s) | ok |
| TOP zip | 2000 | 100 | 1 d 9 h 20 m | 100 | 249 ms (0.25 s) | 251 ms (0.25 s) | ok |
| VALUES zip | 2000 | 100 | 1 d 9 h 20 m | 100 | 746 ms (0.75 s) | 748 ms (0.75 s) | ok |
| TOP zip | 2000 | 200 | 1 d 9 h 20 m | 200 | 382 ms (0.38 s) | 384 ms (0.38 s) | ok |
| VALUES zip | 2000 | 200 | 1 d 9 h 20 m | 200 | 791 ms (0.79 s) | 793 ms (0.79 s) | ok |
| TOP zip | 3000 | 300 | 2 d 2 h | 300 | 662 ms (0.66 s) | 665 ms (0.67 s) | ok |
| VALUES zip | 3000 | 300 | 2 d 2 h | — | — | 540 ms (0.54 s) | 429 `<reused_arrays>` |
| TOP zip | 4000 | 400 | 2 d 18 h 40 m | 400 | 1263 ms (1.26 s) | 1269 ms (1.27 s) | ok |
| VALUES zip | 4000 | 400 | 2 d 18 h 40 m | — | — | 655 ms (0.66 s) | 429 |
| TOP zip | 5000 | 500 | 3 d 11 h 20 m | — | — | 599 ms (0.60 s) | 429 parent |
| VALUES zip | 5000 | 500 | 3 d 11 h 20 m | — | — | 406 ms (0.41 s) | 429 |
| TOP zip | 10000 | 1000 | 6 d 22 h 40 m | — | — | 942 ms (0.94 s) | 429 `esql_block_factory` |
| VALUES zip | 10000 | 1000 | 6 d 22 h 40 m | — | — | 429 ms (0.43 s) | 429 |

6000 / 8000: both 429 (same breaker class). Last TOP zip success: **4000 docs / 400 flaps**. Last VALUES zip success on B: **2000 docs / 200 flaps**; on A: **1000 flaps**.

---

## HTTP layer (Kibana probe routes)

Temporary internal routes (same pre-GA bucket as `_reset_resources`):

- `POST /internal/alerting/v2/_span_perf/search_after` — PIT + Query DSL `search_after` (page 2000), Kibana run-length encode
- `POST /internal/alerting/v2/_span_perf/top_zip` — TOP zip ES|QL (span starts + `MAX(@timestamp)` / `COUNT(*)`), Kibana attaches `duration_ms` / `status_ended_at`

Body: `{ "episode_id": "<uuid>", "include_spans": false }`. Privilege: `read_alerting-v2-alerts`. Default response is counts + timings + a 6-row sample (not the full span list).

`elasticsearch_took_ms` is ES `took` (summed across pages for search_after). `elasticsearch_wall_ms` is the Kibana clock around ES. `kibana_ms` is the in-process reduce. `total_ms` is the handler.

Run 2026-08-29 against the same `source:span_query_perf` episodes. search_after first, then TOP zip, 2–12s cooldown. Heap not isolated from the earlier ES-direct benches.

### Pattern A — all-flip (flaps = docs)

| method | docs | flaps | events | spans | pages | es_took | es_wall | kibana | total | result |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| search_after | 100 | 100 | 100 | 100 | 1 | 6 ms | 9 ms | 0.1 ms | 9 ms | ok |
| TOP zip + Kibana duration | 100 | 100 | 100 | 100 | — | 13 ms | 21 ms | 0.7 ms | 21 ms | ok |
| search_after | 500 | 500 | 500 | 500 | 1 | 5 ms | 10 ms | 0.2 ms | 10 ms | ok |
| TOP zip + Kibana duration | 500 | 500 | 500 | 500 | — | 48 ms | 53 ms | 2.7 ms | 56 ms | ok |
| search_after | 1000 | 1000 | 1000 | 1000 | 1 | 9 ms | 16 ms | 0.4 ms | 16 ms | ok |
| TOP zip + Kibana duration | 1000 | 1000 | 1000 | 1000 | — | 333 ms | 339 ms | 4.7 ms | 344 ms | ok |
| search_after | 1500 | 1500 | 1500 | 1500 | 1 | 11 ms | 18 ms | 0.7 ms | 19 ms | ok |
| TOP zip + Kibana duration | 1500 | 1500 | 1500 | 1500 | — | 655 ms | 664 ms | 6.6 ms | 670 ms | ok |
| search_after | 2000 | 2000 | 2000 | 2000 | 2 | 12 ms | 25 ms | 0.9 ms | 26 ms | ok |
| TOP zip + Kibana duration | 2000 | 2000 | 2000 | 2000 | — | 467 ms | 475 ms | 8.5 ms | 484 ms | ok |

### Pattern B — longer runs (`run_len` 10)

| method | docs | flaps | events | spans | pages | es_took | es_wall | kibana | total | result |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| search_after | 1000 | 100 | 1000 | 100 | 1 | 13 ms | 21 ms | 0.1 ms | 22 ms | ok |
| TOP zip + Kibana duration | 1000 | 100 | 1000 | 100 | — | 105 ms | 111 ms | 0.6 ms | 112 ms | ok |
| search_after | 2000 | 200 | 2000 | 200 | 2 | 13 ms | 28 ms | 0.2 ms | 28 ms | ok |
| TOP zip + Kibana duration | 2000 | 200 | 2000 | 200 | — | 215 ms | 220 ms | 1.0 ms | 221 ms | ok |
| search_after | 3000 | 300 | 3000 | 300 | 2 | 18 ms | 36 ms | 0.2 ms | 37 ms | ok |
| TOP zip + Kibana duration | 3000 | 300 | 3000 | 300 | — | 568 ms | 585 ms | 1.8 ms | 586 ms | ok |
| search_after | 4000 | 400 | 4000 | 400 | 3 | 24 ms | 50 ms | 0.3 ms | 50 ms | ok |
| TOP zip + Kibana duration | 4000 | 400 | 4000 | 400 | — | 995 ms | 1015 ms | 2.0 ms | 1017 ms | ok |
| search_after | 5000 | 500 | 5000 | 500 | 3 | 31 ms | 61 ms | 0.4 ms | 61 ms | ok |
| TOP zip + Kibana duration | 5000 | 500 | 5000 | 500 | — | 1301 ms | 1308 ms | 2.4 ms | 1310 ms | ok |
| search_after | 10000 | 1000 | 10000 | 1000 | 6 | 51 ms | 101 ms | 0.8 ms | 102 ms | ok |
| TOP zip + Kibana duration | 10000 | 1000 | — | — | — | — | 852 ms | — | 852 ms | 429 `esql_block_factory` |

Kibana reduce is under 10 ms in every successful run. Cost is Elasticsearch.

search_after stays cheap through **10k events / 1k flaps** (102 ms, 6 pages). TOP zip + Kibana duration still dies at 10k on this 1.5gb node. 5k/500 TOP zip succeeded on this HTTP pass (the earlier ES-direct bench 429'd the same size) — heap/query variance, not a new cliff.

---

## Further memory reduction (ES + Kibana), including client-side

The rewrite is still heavy at 15k flaps: `VALUES()` builds a large MV, `MV_ZIP` clones it, `GROK` runs per row, and Kibana still receives 15k span rows to paint.

### 1. Stop asking ES|QL to return spans

Cheapest correct algorithm: ES returns the **event stream**, Kibana (or a Kibana server route) reduces it in one linear pass.

```esql
FROM .rule-events
| WHERE type == "alert" AND space_id == "default"
    AND `episode.status` IS NOT NULL
    AND `episode.id` == "f858ebe6-a0ef-4a0e-9aaa-592863f56092"
| KEEP `episode.id`, `rule.id`, group_hash, @timestamp, `episode.status`, data
| SORT `episode.id` ASC, @timestamp ASC
```

Client:

```text
for each event in order:
  if status != current_span.status:
    close current_span (ended_at = event.@timestamp)
    open new span (previous_status = current_span.status)
```

Memory: O(events) transfer, O(spans) output, **no** MV of size n, **no** zip, **no** Grok. Matches the “less state on the docs” goal: derivation stays in the reader.

Do this on the **Kibana server**, not in the browser, if 15k+ `data` payloads would freeze the tab. Browser gets spans only.

### 2. Drop `data` from the span query

Span geometry does not need the ES|QL row payload. Original `STATS BY data` and the rewrite’s `TO_STRING(data)` both inflate every MV entry.

- Span query: `@timestamp` + `episode.status` (+ ids).
- Hydrate `data` only for visible / selected spans (`_id` or `@timestamp` lookup).

This is the largest per-row size cut besides killing the cartesian product.

### 3. Fold `INLINE STATS MAX` into the collapsing `STATS`

```esql
| STATS _entries = VALUES(_entry), episode_latest_ts = MAX(@timestamp)
    BY `episode.id`, `rule.id`, group_hash
```

Removes a pass that broadcasts `episode_latest_ts` onto every source row before collapse.

### 4. Page events, stitch spans at page boundaries

`search_after` / ES|QL `LIMIT` + `@timestamp` lower bound, page size 1k–2k.

Client carries one piece of state across pages: `{ last_status, last_span_start, last_data }`. Heap stays bounded. Same idea as streaming a run-length encoding.

### 5. Do not paint 15k DOM/canvas segments

Even a cheap query loses if the timeline creates 15k shapes.

- Cap rendered segments (e.g. 50–200 per viewport).
- Collapse dense active↔recovering flips into one “flapping” band + count.
- Virtualize: only spans intersecting the visible time window.

Kibana memory is usually the renderer, not the JSON.

### 6. Scope work to the display window; stitch the open left edge

Existing timeline already splits “geometry in view” vs “true start”. Keep that:

- In-window events → spans clipped to `[windowStart, windowEnd]`.
- One extra fetch of the last event **before** `windowStart` for the in-progress left span.

Avoids loading a 4-hour 1 Hz flap history when the chart shows 15 minutes.

### 7. One episode per request (or a small `IN` list)

`VALUES` / sort / zip memory scales with events **per `BY` key**. Loop `episode.id`s on the Kibana server; never build one MV that concatenates many large episodes.

### 8. Prefer `_source: false` + doc values if leaving ES|QL

If the stream query moves to `_search`:

```json
{ "docvalue_fields": ["@timestamp", "episode.status", "episode.id", "rule.id", "group_hash"], "_source": false }
```

Load `data` only on the hydrate call. Smaller than ES|QL keeping `data` in the pipeline.

### 9. Replace GROK with DISSECT/SPLIT only

GROK is the most expensive parser in the rewrite. The delimiters are fixed (`\t`, `|`); DISSECT/SPLIT is enough. Minor vs cartesian, measurable at 15k.

### 10. Circuit-breaker / UI contract

- Time out and cancel the ES task (the original query was still running on `indices:data/read/esql/compute`).
- If span count > N, return a summary `{ span_count, first, last, transition_count }` plus a downsampled geometry, not 15k rows.

---

## Recommendation

| Layer | Do |
| --- | --- |
| ES | Stream query only: `WHERE` + `KEEP` + `SORT`. No `VALUES` + `MV_EXPAND` self-join. |
| Kibana server | Linear span reduction; optional paging; drop `data` until hydrate. |
| Kibana UI | Cap / bucket flaps; do not mount 15k phase rects. |

Do not ship either ES|QL variant for high-cardinality flaps. Discover/ES|QL cannot return 15k span rows (default `LIMIT` 1000, result cap 10k) and TOP zip still 429s at 10k events on this heap. The Kibana HTTP probe confirms the product path: paged `_search` + linear reduce is 102 ms at 10k events; TOP zip + server-side duration is still breaker-bound.
