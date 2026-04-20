#!/bin/bash
# Seeds V1 .es-query rules with esqlQuery variant for migration testing.
# Uses Astronomy Shop OTel data from remote_cluster.
# Re-run safe: deletes existing [Test] rules first.

set -euo pipefail

KIBANA_URL="${KIBANA_URL:-http://localhost:5605}"
AUTH="admin:evwuZz3aevbsq25dcltTPdgo"
HEADERS='-H "kbn-xsrf: true" -H "Content-Type: application/json" -H "x-elastic-internal-origin: kibana"'

echo "==> Cleaning existing [Test] migration rules..."
EXISTING=$(curl -s -u "$AUTH" "$KIBANA_URL/api/alerting/rules/_find?per_page=100&search=%5BTest%5D" \
  -H "kbn-xsrf: true" -H "x-elastic-internal-origin: kibana" \
  | python3 -c "import json,sys; data=json.load(sys.stdin); [print(r['id']) for r in data.get('data',[]) if r['name'].startswith('[Test]')]" 2>/dev/null || true)

for id in $EXISTING; do
  echo "   Deleting rule $id"
  curl -s -u "$AUTH" -X DELETE "$KIBANA_URL/api/alerting/rule/$id" \
    -H "kbn-xsrf: true" -H "x-elastic-internal-origin: kibana" > /dev/null
done

create_rule() {
  local name="$1"
  local body="$2"
  echo "==> Creating: $name"
  RESULT=$(curl -s -u "$AUTH" -X POST "$KIBANA_URL/api/alerting/rule" \
    -H "kbn-xsrf: true" -H "Content-Type: application/json" -H "x-elastic-internal-origin: kibana" \
    -d "$body")
  RULE_ID=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id','ERROR'))" 2>/dev/null || echo "ERROR")
  echo "   Created: $RULE_ID"
}

# Rule 1: Simple count, no grouping
create_rule "[Test] OTel error log spike" '{
  "name": "[Test] OTel error log spike",
  "rule_type_id": ".es-query",
  "consumer": "stackAlerts",
  "enabled": false,
  "schedule": { "interval": "1m" },
  "params": {
    "searchType": "esqlQuery",
    "esqlQuery": {
      "esql": "FROM remote_cluster:logs-generic.otel-default | WHERE severity_text IN (\"Error\", \"ERROR\") | STATS error_count = COUNT(*) | WHERE error_count > 5"
    },
    "timeField": "@timestamp",
    "timeWindowSize": 5,
    "timeWindowUnit": "m",
    "threshold": [0],
    "thresholdComparator": ">",
    "size": 100,
    "aggType": "count",
    "groupBy": "all",
    "excludeHitsFromPreviousRun": true
  },
  "actions": [],
  "tags": ["test", "migration", "otel"]
}'

# Rule 2: Per-service grouping
create_rule "[Test] OTel errors by service" '{
  "name": "[Test] OTel errors by service",
  "rule_type_id": ".es-query",
  "consumer": "stackAlerts",
  "enabled": false,
  "schedule": { "interval": "5m" },
  "params": {
    "searchType": "esqlQuery",
    "esqlQuery": {
      "esql": "FROM remote_cluster:logs-generic.otel-default | WHERE severity_text IN (\"Error\", \"ERROR\", \"WARN\", \"WARNING\") | STATS count = COUNT(*) BY resource.attributes.service.name | WHERE count > 10"
    },
    "timeField": "@timestamp",
    "timeWindowSize": 15,
    "timeWindowUnit": "m",
    "threshold": [0],
    "thresholdComparator": ">",
    "size": 100,
    "aggType": "count",
    "groupBy": "row",
    "excludeHitsFromPreviousRun": false
  },
  "actions": [
    {
      "id": "c00768ad-eb33-4f65-834b-f3efca2375e9",
      "group": "query matched",
      "params": {
        "message": "OTel errors for service {{context.group}}: {{context.value}} in last 15m"
      },
      "frequency": {
        "notify_when": "onThrottleInterval",
        "throttle": "10m",
        "summary": false
      }
    }
  ],
  "alert_delay": { "active": 2 },
  "tags": ["test", "migration", "otel", "grouped"]
}'

# Rule 3: Multi-field grouping with traces
create_rule "[Test] Slow OTel transactions by service and method" '{
  "name": "[Test] Slow OTel transactions by service and method",
  "rule_type_id": ".es-query",
  "consumer": "stackAlerts",
  "enabled": false,
  "schedule": { "interval": "2m" },
  "params": {
    "searchType": "esqlQuery",
    "esqlQuery": {
      "esql": "FROM remote_cluster:traces-generic.otel-default | WHERE duration > 1000000000 | STATS slow_count = COUNT(*) BY resource.attributes.service.name, attributes.http.method | WHERE slow_count > 3"
    },
    "timeField": "@timestamp",
    "timeWindowSize": 10,
    "timeWindowUnit": "m",
    "threshold": [0],
    "thresholdComparator": ">",
    "size": 50,
    "aggType": "count",
    "groupBy": "row",
    "excludeHitsFromPreviousRun": true
  },
  "actions": [],
  "alert_delay": { "active": 1 },
  "tags": ["test", "migration", "otel", "traces"]
}'

# Rule 4: With Slack + email actions
create_rule "[Test] Frontend 5xx errors with actions" '{
  "name": "[Test] Frontend 5xx errors with actions",
  "rule_type_id": ".es-query",
  "consumer": "stackAlerts",
  "enabled": false,
  "schedule": { "interval": "1m" },
  "params": {
    "searchType": "esqlQuery",
    "esqlQuery": {
      "esql": "FROM remote_cluster:traces-generic.otel-default | WHERE attributes.http.status_code >= 500 AND resource.attributes.service.name == \"frontend\" | STATS error_count = COUNT(*) | WHERE error_count > 0"
    },
    "timeField": "@timestamp",
    "timeWindowSize": 5,
    "timeWindowUnit": "m",
    "threshold": [0],
    "thresholdComparator": ">",
    "size": 100,
    "aggType": "count",
    "groupBy": "all",
    "excludeHitsFromPreviousRun": true
  },
  "actions": [
    {
      "id": "c00768ad-eb33-4f65-834b-f3efca2375e9",
      "group": "query matched",
      "params": {
        "message": "Frontend 5xx spike: {{context.value}} errors in last 5m"
      },
      "frequency": {
        "notify_when": "onThrottleInterval",
        "throttle": "5m",
        "summary": false
      }
    },
    {
      "id": "0319135b-a71d-4453-afc1-4bf779ab9c21",
      "group": "query matched",
      "params": {
        "to": ["oncall@example.com"],
        "subject": "Alert: Frontend 5xx errors",
        "message": "Frontend 5xx errors detected: {{context.value}} in last 5 minutes"
      },
      "frequency": {
        "notify_when": "onActionGroupChange",
        "throttle": null,
        "summary": false
      }
    }
  ],
  "tags": ["test", "migration", "otel", "actions"]
}'

echo ""
echo "==> Done! Created 4 test rules for migration."
