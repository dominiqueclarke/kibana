#!/usr/bin/env python3
"""Benchmark episode status-span ES|QL queries against synthetic .rule-events.

Queries:
  VALUES zip — pack DATE_FORMAT+status+data, VALUES, two MV_EXPAND passes (duration/data).
  TOP zip    — TOP(@timestamp, 10000) ordered MVs, one expand (span starts only).

Pattern A: all-flip (one status change per document).
Pattern B: longer runs (status held for run_len evaluations, then flipped).

Example:

  python3 span_query_perf.py --pattern both --query both
  python3 span_query_perf.py --query top-zip --pattern b --b-specs 3000:10,10000:10
  python3 span_query_perf.py --es-url http://localhost:9204 --es-auth elastic:changeme
  python3 span_query_perf.py --test-id 2026-08-29-rerun --index-results

ES|QL result caps (cluster settings, not Kibana user settings):

  esql.query.result_truncation_default_size = 1000
  esql.query.result_truncation_max_size     = 10000
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

RULE_ID = "745d0562-8ebe-44e6-af92-5a5cfb25ad40"
EVENT_URL = "https://mongodb-gateway.mail-sass.co:27017"
FAILURE_COUNTS = [2, 9, 11]
INTERVAL_MS = 1000
BATCH = 500
SOURCE_MARKER = "span_query_perf"
RESULTS_INDEX = "span-query-perf"

DEFAULT_SIZES_A = "100,500,1000,1500,2000"
DEFAULT_B_SPECS = "1000:10,1000:5,1000:2,2000:20,2000:10,3000:10,4000:10,5000:10,6000:10,8000:10,10000:10"

QUERY_VALUES_ZIP = "VALUES zip"
QUERY_TOP_ZIP = "TOP zip"
HTTP_SEARCH_AFTER = "search_after"
HTTP_TOP_ZIP = "top_zip_kibana_duration"
HTTP_ESQL = "esql"
HTTP_VALUES_ZIP = "values_zip"

HTTP_PATHS = {
    HTTP_SEARCH_AFTER: "/internal/alerting/v2/_span_perf/search_after",
    HTTP_TOP_ZIP: "/internal/alerting/v2/_span_perf/top_zip",
    HTTP_ESQL: "/internal/alerting/v2/_span_perf/esql",
    HTTP_VALUES_ZIP: "/internal/alerting/v2/_span_perf/values_zip",
}

DURATION_COMPUTED_IN = {
    QUERY_VALUES_ZIP: "elasticsearch",
    QUERY_TOP_ZIP: "none",
    HTTP_SEARCH_AFTER: "kibana",
    HTTP_ESQL: "kibana",
    HTTP_TOP_ZIP: "kibana",
    HTTP_VALUES_ZIP: "elasticsearch",
}

PATTERN_LABELS = {"A-all-flip": "A", "B-runs": "B"}
METHOD_SLUGS = {
    QUERY_VALUES_ZIP: "values_zip",
    QUERY_TOP_ZIP: "top_zip",
    HTTP_SEARCH_AFTER: "search_after",
    HTTP_TOP_ZIP: "top_zip_kibana_duration",
    HTTP_ESQL: "esql",
    HTTP_VALUES_ZIP: "values_zip",
}

VALUES_ZIP_QUERY = r'''
FROM .rule-events
| WHERE type == "alert" AND space_id == "default"
    AND `episode.status` IS NOT NULL
    AND `episode.id` == "EPISODE_ID"
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
'''.strip()

TOP_ZIP_QUERY = r"""
FROM .rule-events
| WHERE type == "alert" AND episode.id == "EPISODE_ID"
| STATS
    statuses = TOP(@timestamp, 10000, "asc", episode.status),
    timestamps = TOP(@timestamp, 10000, "asc"),
    signals = TOP(@timestamp, 10000, "asc", status)
    BY episode.id, group_hash
| EVAL n = MV_COUNT(statuses)
| EVAL prevs = MV_APPEND("__START__", MV_SLICE(statuses, 0, n - 2))
| EVAL row = MV_ZIP(
    MV_ZIP(MV_ZIP(TO_STRING(timestamps), statuses, "|"), prevs, "|"),
    signals,
    "|"
  )
| MV_EXPAND row
| DISSECT row "%{ts}|%{episode_status}|%{prev_status}|%{signal}"
| WHERE prev_status == "__START__" OR prev_status != episode_status
| EVAL @timestamp = TO_DATETIME(ts)
| SORT @timestamp
| LIMIT 10000
| KEEP @timestamp, group_hash, episode.id, episode_status, signal, prev_status
""".strip()

QUERIES = {
    QUERY_VALUES_ZIP: VALUES_ZIP_QUERY,
    QUERY_TOP_ZIP: TOP_ZIP_QUERY,
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--es-url", default=os.environ.get("ES_URL", "http://localhost:9204"))
    p.add_argument("--es-auth", default=os.environ.get("ES_AUTH", "elastic:changeme"))
    p.add_argument(
        "--pattern",
        choices=("a", "b", "both"),
        default="both",
        help="A = all-flip; B = longer runs (--run-len); both = A then B",
    )
    p.add_argument(
        "--query",
        choices=("values-zip", "top-zip", "both"),
        default="both",
        help="VALUES zip (two-pass packed strings) and/or TOP zip (one-pass TOP)",
    )
    p.add_argument("--sizes-a", default=DEFAULT_SIZES_A, help="Comma-separated document counts for pattern A")
    p.add_argument(
        "--b-specs",
        default=DEFAULT_B_SPECS,
        help="Pattern B as docs:run_len,docs:run_len (e.g. 1000:10,2000:20)",
    )
    p.add_argument("--cooldown", type=float, default=20.0, help="Seconds to wait between ES-direct queries (heap recovery)")
    p.add_argument("--http-cooldown", type=float, default=5.0, help="Seconds to wait between Kibana HTTP probes")
    p.add_argument("--timeout", type=int, default=180, help="HTTP timeout seconds per ES|QL request")
    p.add_argument(
        "--test-id",
        default="",
        help="Id stamped on every result row for this bench run (default: UTC timestamp)",
    )
    p.add_argument("--kibana-url", default=os.environ.get("KIBANA_URL", "http://localhost:5604"))
    p.add_argument(
        "--results-index",
        default=RESULTS_INDEX,
        help=f"Index to write bench rows into (default {RESULTS_INDEX})",
    )
    p.add_argument(
        "--index-results",
        action="store_true",
        help="Bulk-index result rows (with test_id) into --results-index",
    )
    p.add_argument(
        "--http",
        action="store_true",
        help="Also hit Kibana /internal/alerting/v2/_span_perf/{search_after,esql,top_zip,values_zip} for each episode",
    )
    p.add_argument("--json", action="store_true", help="Print JSON results after the table")
    p.add_argument(
        "--cleanup",
        action="store_true",
        help=f"Delete_by_query documents with source={SOURCE_MARKER} after the run",
    )
    return p.parse_args()


def parse_sizes(raw: str) -> list[int]:
    sizes = [int(x.strip()) for x in raw.split(",") if x.strip()]
    if not sizes or any(s < 1 for s in sizes):
        raise SystemExit(f"invalid sizes: {raw!r}")
    return sizes


def parse_b_specs(raw: str) -> list[tuple[int, int]]:
    specs: list[tuple[int, int]] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        docs_s, _, run_s = part.partition(":")
        docs, run_len = int(docs_s), int(run_s or "10")
        if docs < 1 or run_len < 1:
            raise SystemExit(f"invalid b-spec: {part!r}")
        specs.append((docs, run_len))
    if not specs:
        raise SystemExit(f"invalid --b-specs: {raw!r}")
    return specs


def selected_queries(which: str) -> list[str]:
    if which == "values-zip":
        return [QUERY_VALUES_ZIP]
    if which == "top-zip":
        return [QUERY_TOP_ZIP]
    return [QUERY_TOP_ZIP, QUERY_VALUES_ZIP]


def expected_flaps(n: int, run_len: int) -> int:
    return (n + run_len - 1) // run_len


def format_window(minutes: int) -> str:
    days, rem = divmod(minutes, 24 * 60)
    hours, mins = divmod(rem, 60)
    parts: list[str] = []
    if days:
        parts.append(f"{days} d")
    if hours:
        parts.append(f"{hours} h")
    if mins or not parts:
        parts.append(f"{mins} m")
    return " ".join(parts)


def format_secs(ms: int | None) -> str:
    if ms is None:
        return "—"
    return f"{ms} ms ({ms / 1000:.2f} s)"


class EsClient:
    def __init__(self, base_url: str, auth: str, timeout: int):
        self.base_url = base_url.rstrip("/")
        user, _, password = auth.partition(":")
        token = __import__("base64").b64encode(f"{user}:{password}".encode()).decode()
        self._auth_header = f"Basic {token}"
        self.timeout = timeout

    def request(
        self,
        path: str,
        body: Any = None,
        method: str | None = None,
        content_type: str = "application/json",
        timeout: int | None = None,
    ) -> tuple[Any, int]:
        raw_body: bytes | None
        if isinstance(body, (bytes, bytearray)):
            raw_body = bytes(body)
        elif body is None:
            raw_body = None
        else:
            raw_body = json.dumps(body).encode()
        req = urllib.request.Request(
            self.base_url + path,
            data=raw_body,
            method=method or ("POST" if body is not None else "GET"),
            headers={
                "Authorization": self._auth_header,
                "Content-Type": content_type,
                "X-Elastic-Product-Origin": "kibana",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout or self.timeout) as resp:
            payload = resp.read()
            return (json.loads(payload) if payload else {}), resp.status

    def heap_pct(self) -> int | None:
        try:
            data, _ = self.request(
                "/_nodes/stats/jvm?filter_path=nodes.*.jvm.mem.heap_used_percent",
                method="GET",
            )
            node = next(iter(data.get("nodes", {}).values()))
            return int(node["jvm"]["mem"]["heap_used_percent"])
        except Exception:
            return None


class KibanaClient(EsClient):
    def request(
        self,
        path: str,
        body: Any = None,
        method: str | None = None,
        content_type: str = "application/json",
        timeout: int | None = None,
    ) -> tuple[Any, int]:
        raw_body: bytes | None
        if isinstance(body, (bytes, bytearray)):
            raw_body = bytes(body)
        elif body is None:
            raw_body = None
        else:
            raw_body = json.dumps(body).encode()
        req = urllib.request.Request(
            self.base_url + path,
            data=raw_body,
            method=method or ("POST" if body is not None else "GET"),
            headers={
                "Authorization": self._auth_header,
                "Content-Type": content_type,
                "kbn-xsrf": "true",
                "x-elastic-internal-origin": "Kibana",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout or self.timeout) as resp:
            payload = resp.read()
            return (json.loads(payload) if payload else {}), resp.status


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def make_docs(n: int, episode_id: str, group_hash: str, start: datetime, run_len: int) -> list[dict[str, Any]]:
    docs = []
    for i in range(n):
        ts = start + timedelta(milliseconds=i * INTERVAL_MS)
        run_idx = i // run_len
        is_active = run_idx % 2 == 0
        if is_active:
            data: dict[str, Any] = {
                "failure_count": FAILURE_COUNTS[i % len(FAILURE_COUNTS)],
                "event.url": EVENT_URL,
            }
            status, ep_status = "breached", "active"
        else:
            data = {}
            status, ep_status = "recovered", "recovering"
        docs.append(
            {
                "@timestamp": iso(ts),
                "rule": {"id": RULE_ID, "version": 1},
                "group_hash": group_hash,
                "data": data,
                "status": status,
                "source": SOURCE_MARKER,
                "type": "alert",
                "space_id": "default",
                "scheduled_timestamp": iso(ts - timedelta(milliseconds=50)),
                "episode": {
                    "id": episode_id,
                    "status": ep_status,
                    "status_count": (i % run_len) + 1,
                },
            }
        )
    return docs


def bulk_index(es: EsClient, docs: list[dict[str, Any]]) -> int:
    errors = 0
    buf: list[str] = []

    def flush() -> None:
        nonlocal buf, errors
        if not buf:
            return
        payload = "".join(buf).encode()
        last_err: Exception | None = None
        for attempt in range(6):
            try:
                res, _ = es.request(
                    "/.rule-events/_bulk?refresh=false",
                    payload,
                    content_type="application/x-ndjson",
                    timeout=120,
                )
                last_err = None
                break
            except urllib.error.HTTPError as exc:
                last_err = exc
                if exc.code != 429 or attempt == 5:
                    raise
                time.sleep(10 * (attempt + 1))
        if last_err:
            raise last_err
        if res.get("errors"):
            errors += sum(
                1
                for item in res.get("items", [])
                if list(item.values())[0].get("status") not in (200, 201)
            )
        buf = []

    for doc in docs:
        buf.append(json.dumps({"create": {}}) + "\n" + json.dumps(doc) + "\n")
        if len(buf) >= BATCH:
            flush()
    flush()
    return errors


def run_query(es: EsClient, episode_id: str, query_name: str) -> dict[str, Any]:
    query = QUERIES[query_name].replace("EPISODE_ID", episode_id)
    heap = es.heap_pct()
    t0 = time.time()
    try:
        body, status = es.request("/_query?format=json", {"query": query})
        wall_ms = int((time.time() - t0) * 1000)
        return {
            "ok": True,
            "http": status,
            "es_took_ms": body.get("took"),
            "wall_ms": wall_ms,
            "spans_returned": len(body.get("values", [])),
            "heap_pct_before": heap,
            "error": None,
        }
    except urllib.error.HTTPError as exc:
        wall_ms = int((time.time() - t0) * 1000)
        try:
            err = json.loads(exc.read().decode())
            reason = err.get("error", {}).get("reason", str(err))[:240]
        except Exception:
            reason = str(exc)
        return {
            "ok": False,
            "http": exc.code,
            "es_took_ms": None,
            "wall_ms": wall_ms,
            "spans_returned": None,
            "heap_pct_before": heap,
            "error": reason,
        }
    except Exception as exc:
        return {
            "ok": False,
            "http": None,
            "es_took_ms": None,
            "wall_ms": int((time.time() - t0) * 1000),
            "spans_returned": None,
            "heap_pct_before": heap,
            "error": f"{type(exc).__name__}: {exc}",
        }


def error_type_from_reason(reason: str | None) -> str | None:
    if not reason:
        return None
    lower = reason.lower()
    for token in ("esql_block_factory", "reused_arrays", "topn", "parent"):
        if token in lower:
            return token
    if "circuit_breaking" in lower or "429" in lower:
        return "circuit_breaking"
    return reason.split(";")[0][:80]


def run_http_probe(kbn: KibanaClient, episode_id: str, method: str) -> dict[str, Any]:
    path = HTTP_PATHS[method]
    t0 = time.time()
    try:
        body, status = kbn.request(path, {"episode_id": episode_id, "include_spans": False})
        wall_ms = int((time.time() - t0) * 1000)
        if body.get("result") == "ok":
            timings = body.get("timings") or {}
            counts = body.get("counts") or {}
            return {
                "ok": True,
                "http": status,
                "es_took_ms": timings.get("elasticsearch_took_ms"),
                "es_wall_ms": timings.get("elasticsearch_wall_ms"),
                "kibana_ms": timings.get("kibana_ms"),
                "total_ms": timings.get("total_ms"),
                "wall_ms": wall_ms,
                "spans_returned": counts.get("spans"),
                "events": counts.get("events"),
                "pages": timings.get("pages"),
                "error": None,
            }
        err = body.get("error") or {}
        timings = body.get("timings") or {}
        return {
            "ok": False,
            "http": err.get("status_code") or status,
            "es_took_ms": None,
            "es_wall_ms": timings.get("elasticsearch_wall_ms"),
            "kibana_ms": None,
            "total_ms": timings.get("total_ms"),
            "wall_ms": wall_ms,
            "spans_returned": None,
            "events": None,
            "pages": None,
            "error": err.get("reason") or json.dumps(body)[:240],
            "error_type": err.get("type") or error_type_from_reason(err.get("reason")),
        }
    except urllib.error.HTTPError as exc:
        wall_ms = int((time.time() - t0) * 1000)
        try:
            err_body = json.loads(exc.read().decode())
            nested = err_body.get("error") or {}
            reason = nested.get("reason") or nested.get("message") or str(err_body)
            err_type = nested.get("type")
        except Exception:
            reason, err_type = str(exc), None
        return {
            "ok": False,
            "http": exc.code,
            "es_took_ms": None,
            "es_wall_ms": None,
            "kibana_ms": None,
            "total_ms": wall_ms,
            "wall_ms": wall_ms,
            "spans_returned": None,
            "events": None,
            "pages": None,
            "error": str(reason)[:240],
            "error_type": err_type or error_type_from_reason(str(reason)),
        }
    except Exception as exc:
        return {
            "ok": False,
            "http": None,
            "es_took_ms": None,
            "es_wall_ms": None,
            "kibana_ms": None,
            "total_ms": int((time.time() - t0) * 1000),
            "wall_ms": int((time.time() - t0) * 1000),
            "spans_returned": None,
            "events": None,
            "pages": None,
            "error": f"{type(exc).__name__}: {exc}",
            "error_type": None,
        }


def run_http_pattern(
    kbn: KibanaClient,
    cases: list[tuple[int, int, int, str]],
    *,
    label: str,
    cooldown: float,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    methods = [HTTP_SEARCH_AFTER, HTTP_ESQL, HTTP_TOP_ZIP, HTTP_VALUES_ZIP]
    total = len(cases) * len(methods)
    step = 0
    for n, run_len, flaps, episode_id in cases:
        for method in methods:
            step += 1
            print(
                f"[http {step}/{total}] {method} {label} docs={n} flaps={flaps} episode={episode_id} …",
                flush=True,
            )
            row = run_http_probe(kbn, episode_id, method)
            row.update(
                {
                    "query": method,
                    "pattern": label,
                    "docs": n,
                    "flaps_expected": flaps,
                    "run_len": run_len,
                    "window": format_window(n),
                    "episode_id": episode_id,
                    "layer": "http",
                }
            )
            results.append(row)
            status = "ok" if row["ok"] else f"FAIL {row['http']}"
            print(f"  {status} total={format_secs(row.get('total_ms'))} wall={format_secs(row['wall_ms'])}")
            if step < total and cooldown > 0:
                time.sleep(cooldown)
    return results


def result_doc(row: dict[str, Any], test_id: str, now_iso: str) -> dict[str, Any]:
    pattern = PATTERN_LABELS.get(row["pattern"], row["pattern"])
    method = METHOD_SLUGS.get(row["query"], str(row["query"]).replace(" ", "_").lower())
    layer = row.get("layer") or "es_direct"
    duration_in = DURATION_COMPUTED_IN.get(
        row["query"], "kibana" if layer == "http" else "none"
    )
    reason = row.get("error")
    err_type = row.get("error_type") or error_type_from_reason(reason)
    wall = row.get("wall_ms")
    total = row.get("total_ms") if row.get("total_ms") is not None else wall
    succeeded = bool(row.get("ok"))
    return {
        "@timestamp": now_iso,
        "test_id": test_id,
        "layer": layer,
        "pattern": pattern,
        "method": method,
        "duration_computed_in": duration_in,
        "docs": row["docs"],
        "flaps": row["flaps_expected"],
        "window_minutes": row["docs"],
        "window": row["window"],
        "run": test_id,
        "result": "ok" if succeeded else str(row.get("http") or "error"),
        "succeeded": succeeded,
        "error_type": err_type,
        "spans": row.get("spans_returned"),
        "events": row.get("events") if row.get("events") is not None else row["docs"],
        "pages": row.get("pages"),
        "es_took_ms": row.get("es_took_ms"),
        "es_wall_ms": row.get("es_wall_ms"),
        "kibana_ms": row.get("kibana_ms"),
        "total_ms": total,
        "wall_ms": wall,
        "episode_id": row.get("episode_id"),
    }


def index_results(es: EsClient, index: str, docs: list[dict[str, Any]]) -> int:
    if not docs:
        return 0
    buf: list[str] = []
    for doc in docs:
        buf.append(json.dumps({"create": {"_index": index}}) + "\n" + json.dumps(doc) + "\n")
    res, _ = es.request(f"/{index}/_bulk?refresh=true", "".join(buf).encode(), content_type="application/x-ndjson")
    errors = 0
    if res.get("errors"):
        errors = sum(
            1
            for item in res.get("items", [])
            if list(item.values())[0].get("status") not in (200, 201)
        )
    return errors


def print_table(title: str, rows: list[dict[str, Any]]) -> None:
    print()
    print(title)
    print(
        f"{'query':<12} {'docs':>7} {'flaps':>6} {'1m-rule window':<16} {'spans':>6} "
        f"{'es_took':<22} {'wall':<22} result"
    )
    print("-" * 124)
    for row in rows:
        spans = "—" if row["spans_returned"] is None else str(row["spans_returned"])
        result = "ok" if row["ok"] else f"HTTP {row['http']}"
        if row["error"] and not row["ok"]:
            short = row["error"].split(";")[0][:48]
            result = f"{result} {short}"
        print(
            f"{row['query']:<12} {row['docs']:>7} {row['flaps_expected']:>6} {row['window']:<16} {spans:>6} "
            f"{format_secs(row['es_took_ms']):<22} {format_secs(row['wall_ms']):<22} {result}"
        )


def run_pattern(
    es: EsClient,
    *,
    label: str,
    specs: list[tuple[int, int]],
    query_names: list[str],
    cooldown: float,
    day_offset: int,
) -> tuple[list[dict[str, Any]], list[tuple[int, int, int, str]]]:
    now = datetime.now(timezone.utc)
    cases: list[tuple[int, int, int, str]] = []
    print(f"\nindexing {label} …")
    for i, (n, run_len) in enumerate(specs):
        flaps = expected_flaps(n, run_len)
        episode_id = str(uuid.uuid4())
        group_hash = hashlib.sha256(f"{SOURCE_MARKER}-{label}-{n}-{run_len}-{episode_id}".encode()).hexdigest()
        start = now - timedelta(days=day_offset + i, milliseconds=(n - 1) * INTERVAL_MS)
        errors = bulk_index(es, make_docs(n, episode_id, group_hash, start, run_len))
        print(f"  docs={n} run_len={run_len} flaps~={flaps} episode={episode_id} bulk_errors={errors}")
        cases.append((n, run_len, flaps, episode_id))

    es.request("/.rule-events/_refresh", method="POST")

    results: list[dict[str, Any]] = []
    total = len(cases) * len(query_names)
    step = 0
    for n, run_len, flaps, episode_id in cases:
        for query_name in query_names:
            step += 1
            print(
                f"[{step}/{total}] {query_name} {label} docs={n} flaps={flaps} heap={es.heap_pct()}% …",
                flush=True,
            )
            row = run_query(es, episode_id, query_name)
            row.update(
                {
                    "query": query_name,
                    "pattern": label,
                    "docs": n,
                    "flaps_expected": flaps,
                    "run_len": run_len,
                    "window": format_window(n),
                    "episode_id": episode_id,
                    "layer": "es_direct",
                }
            )
            results.append(row)
            status = "ok" if row["ok"] else f"FAIL {row['http']}"
            print(f"  {status} es_took={format_secs(row['es_took_ms'])} wall={format_secs(row['wall_ms'])}")
            if step < total and cooldown > 0:
                time.sleep(cooldown)
    return results, cases


def cleanup(es: EsClient) -> None:
    body = {"query": {"term": {"source": SOURCE_MARKER}}}
    res, _ = es.request("/.rule-events/_delete_by_query?refresh=true&conflicts=proceed", body)
    print(f"cleanup deleted={res.get('deleted')} failures={res.get('failures')}")


def main() -> int:
    args = parse_args()
    test_id = args.test_id.strip() or datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    es = EsClient(args.es_url, args.es_auth, args.timeout)
    print(f"ES {args.es_url} heap={es.heap_pct()}%")
    print(f"test_id={test_id}")
    try:
        trunc, _ = es.request(
            "/_cluster/settings?include_defaults=true&filter_path=**.esql.query.result_truncation*"
        )
        print("ES|QL truncation settings:", json.dumps(trunc))
    except Exception as exc:
        print(f"could not read truncation settings: {exc}")

    query_names = selected_queries(args.query)
    print("queries:", ", ".join(query_names))

    all_rows: list[dict[str, Any]] = []
    all_cases: list[tuple[str, list[tuple[int, int, int, str]]]] = []
    if args.pattern in ("a", "both"):
        a_rows, a_cases = run_pattern(
            es,
            label="A-all-flip",
            specs=[(n, 1) for n in parse_sizes(args.sizes_a)],
            query_names=query_names,
            cooldown=args.cooldown,
            day_offset=1,
        )
        all_rows.extend(a_rows)
        all_cases.append(("A-all-flip", a_cases))
        print_table("Pattern A — all-flip (flaps = docs)", a_rows)

    if args.pattern in ("b", "both"):
        b_rows, b_cases = run_pattern(
            es,
            label="B-runs",
            specs=parse_b_specs(args.b_specs),
            query_names=query_names,
            cooldown=args.cooldown,
            day_offset=20,
        )
        all_rows.extend(b_rows)
        all_cases.append(("B-runs", b_cases))
        print_table("Pattern B — longer runs", b_rows)

    if args.http:
        kbn = KibanaClient(args.kibana_url, args.es_auth, args.timeout)
        print(f"\nKibana HTTP probes {args.kibana_url}")
        for label, cases in all_cases:
            http_rows = run_http_pattern(kbn, cases, label=label, cooldown=args.http_cooldown)
            all_rows.extend(http_rows)
            print_table(f"HTTP {label}", http_rows)

    for row in all_rows:
        row["test_id"] = test_id

    if args.index_results:
        now_iso = iso(datetime.now(timezone.utc))
        docs = [result_doc(row, test_id, now_iso) for row in all_rows]
        errors = index_results(es, args.results_index, docs)
        print(f"indexed {len(docs)} result rows into {args.results_index} test_id={test_id} bulk_errors={errors}")

    if args.json:
        print("\nJSON")
        print(json.dumps(all_rows, indent=2))

    if args.cleanup:
        cleanup(es)

    failed = sum(1 for r in all_rows if not r["ok"])
    print(f"test_id={test_id} rows={len(all_rows)} failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
