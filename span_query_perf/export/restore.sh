#!/usr/bin/env bash
# Restore span-query-perf index, data view, and dashboard.
#
# Usage:
#   ES_URL=http://localhost:9204 KIBANA_URL=http://localhost:5604 \
#     ./span_query_perf/export/restore.sh
#
# Then open: $KIBANA_URL/app/dashboards#/view/span-query-perf
#
# Optional Saved Objects import (UI): Stack Management → Saved Objects → Import
#   saved_objects.ndjson  (dashboard + data view; still needs the ES index)

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ES_URL="${ES_URL:-http://localhost:9204}"
KIBANA_URL="${KIBANA_URL:-http://localhost:5604}"
AUTH="${AUTH:-elastic:changeme}"
INDEX="span-query-perf"
DASHBOARD_ID="span-query-perf"

es() {
  curl -sfS -u "$AUTH" -H "Content-Type: application/json" "$@"
}

kbn() {
  curl -sfS -u "$AUTH" \
    -H "Content-Type: application/json" \
    -H "kbn-xsrf: true" \
    -H "x-elastic-internal-origin: Kibana" \
    -H "elastic-api-version: 2023-10-31" \
    "$@"
}

echo "es: $ES_URL"
echo "kibana: $KIBANA_URL"

echo "recreating index $INDEX"
es -X DELETE "$ES_URL/$INDEX" >/dev/null || true
es -X PUT "$ES_URL/$INDEX" --data-binary "@$DIR/mapping.json" >/dev/null

echo "bulk indexing docs"
python3 - "$ES_URL" "$AUTH" "$INDEX" "$DIR/docs.ndjson" <<'PY'
import json, sys, urllib.request, base64

es_url, auth, index, path = sys.argv[1:]
lines = []
with open(path) as f:
    for line in f:
        rec = json.loads(line)
        lines.append(json.dumps({"index": {"_index": index, "_id": rec["_id"]}}))
        lines.append(json.dumps(rec["_source"]))
payload = ("\n".join(lines) + "\n").encode()
req = urllib.request.Request(
    es_url.rstrip("/") + "/_bulk",
    data=payload,
    method="POST",
    headers={
        "Content-Type": "application/x-ndjson",
        "Authorization": "Basic " + base64.b64encode(auth.encode()).decode(),
    },
)
with urllib.request.urlopen(req) as resp:
    body = json.loads(resp.read())
if body.get("errors"):
    items = [i for i in body.get("items", []) if next(iter(i.values())).get("error")]
    raise SystemExit(f"bulk errors: {json.dumps(items[:3])}")
print(f"indexed {sum(1 for _ in open(path))} docs")
PY

echo "upserting data view"
kbn -X POST "$KIBANA_URL/api/data_views/data_view" --data-binary "@$DIR/data_view.json" >/dev/null

echo "upserting dashboard $DASHBOARD_ID"
kbn -X PUT "$KIBANA_URL/api/dashboards/$DASHBOARD_ID" --data-binary "@$DIR/dashboard.json" >/dev/null

echo "status: restored"
echo "next: $KIBANA_URL/app/dashboards#/view/$DASHBOARD_ID"
