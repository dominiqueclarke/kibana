/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { esql } from '@elastic/esql';
import { ALERT_EVENTS_DATA_STREAM } from '@kbn/alerting-v2-constants';
import { TOP_ZIP_PREV_START_SENTINEL } from './attach_durations_to_span_starts';

/** ES|QL hard cap for `TOP(..., n)` / result rows on this cluster. */
export const TOP_ZIP_EVENT_CAP = 10_000;

/**
 * TOP zip span-start query. ES returns transitions only; Kibana attaches
 * duration from consecutive starts + `episode_latest_ts`.
 */
export const buildTopZipSpanStartsQuery = (episodeId: string): string => {
  // TOP/LIMIT n is inlined: ES|QL rejects bound parameters in LIMIT.
  return esql`FROM ${ALERT_EVENTS_DATA_STREAM}
| WHERE type == "alert" AND episode.status IS NOT NULL AND episode.id == ${esql.str(episodeId)}
| STATS
    statuses = TOP(@timestamp, 10000, "asc", episode.status),
    timestamps = TOP(@timestamp, 10000, "asc"),
    episode_latest_ts = MAX(@timestamp),
    event_count = COUNT(*),
    rule_id = LAST(rule.id, @timestamp)
    BY episode.id, group_hash
| EVAL n = MV_COUNT(statuses)
| EVAL prevs = MV_APPEND(${esql.str(TOP_ZIP_PREV_START_SENTINEL)}, MV_SLICE(statuses, 0, n - 2))
| EVAL row = MV_ZIP(MV_ZIP(TO_STRING(timestamps), statuses, "|"), prevs, "|")
| MV_EXPAND row
| DISSECT row "%{ts}|%{episode_status}|%{prev_status}"
| WHERE prev_status == ${esql.str(TOP_ZIP_PREV_START_SENTINEL)} OR prev_status != episode_status
| EVAL status_started_at = TO_DATETIME(ts)
| SORT status_started_at
| LIMIT 10000
| KEEP status_started_at, group_hash, episode.id, episode_status, prev_status, episode_latest_ts, event_count, rule_id`.print(
    'basic'
  );
};
