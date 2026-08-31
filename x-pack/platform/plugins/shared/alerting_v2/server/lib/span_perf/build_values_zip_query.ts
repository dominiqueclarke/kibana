/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { esql } from '@elastic/esql';
import { ALERT_EVENTS_DATA_STREAM } from '@kbn/alerting-v2-constants';

/** ES|QL result-window cap on this cluster. */
export const VALUES_ZIP_EVENT_CAP = 10_000;

/**
 * VALUES zip span query. ES returns full span geometry including
 * `duration_ms` / `status_ended_at`. Kibana must not recompute duration.
 */
export const buildValuesZipSpansQuery = (episodeId: string, spaceId: string): string => {
  const grokPair = '%{GREEDYDATA:prev_entry}\t%{GREEDYDATA:curr_entry}';
  const grokRow = '%{GREEDYDATA:prev_entry}\t%{GREEDYDATA:curr_entry}\t%{GREEDYDATA:next_entry}';

  // LIMIT is inlined: ES|QL rejects bound parameters in LIMIT.
  return esql`FROM ${ALERT_EVENTS_DATA_STREAM}
| WHERE type == "alert" AND space_id == ${esql.str(spaceId)}
    AND episode.status IS NOT NULL
    AND episode.id == ${esql.str(episodeId)}
| INLINE STATS episode_latest_ts = MAX(@timestamp) BY episode.id
| EVAL _entry = CONCAT(DATE_FORMAT("yyyyMMddHHmmssSSS", @timestamp), "|", episode.status, "|", COALESCE(TO_STRING(data), ""))
| STATS _entries = VALUES(_entry), event_count = COUNT(*) BY episode.id, rule.id, group_hash, episode_latest_ts
| EVAL _sorted = MV_SORT(_entries)
| EVAL _n = MV_COUNT(_sorted)
| EVAL _prev = MV_APPEND("-", MV_SLICE(_sorted, 0, _n - 2))
| EVAL _pair = MV_ZIP(_prev, _sorted, "\t")
| MV_EXPAND _pair
| GROK _pair ${esql.str(grokPair)}
| EVAL prev_status = CASE(prev_entry == "-", null, MV_SLICE(SPLIT(prev_entry, "|"), 1, 1))
| EVAL curr_status = MV_SLICE(SPLIT(curr_entry, "|"), 1, 1)
| WHERE prev_entry == "-" OR prev_status != curr_status
| STATS _starts = VALUES(curr_entry), event_count = MAX(event_count) BY episode.id, rule.id, group_hash, episode_latest_ts
| EVAL _sorted = MV_SORT(_starts)
| EVAL _n = MV_COUNT(_sorted)
| EVAL _prev = MV_APPEND("-", MV_SLICE(_sorted, 0, _n - 2))
| EVAL _next = MV_APPEND(MV_SLICE(_sorted, 1, _n - 1), "-")
| EVAL _row = MV_ZIP(MV_ZIP(_prev, _sorted, "\t"), _next, "\t")
| MV_EXPAND _row
| GROK _row ${esql.str(grokRow)}
| DISSECT curr_entry "%{ts_str}|%{episode_status}|%{data_str}"
| EVAL previous_status = CASE(prev_entry == "-", null, MV_SLICE(SPLIT(prev_entry, "|"), 1, 1))
| EVAL status_started_at = DATE_PARSE("yyyyMMddHHmmssSSS", ts_str)
| EVAL next_ts_str = MV_SLICE(SPLIT(next_entry, "|"), 0, 0)
| EVAL status_ended_at = CASE(next_entry == "-", null, DATE_PARSE("yyyyMMddHHmmssSSS", next_ts_str))
| EVAL duration_ms = DATE_DIFF("ms", status_started_at, COALESCE(status_ended_at, episode_latest_ts))
| KEEP episode.id, rule.id, group_hash, status_started_at, previous_status, episode_status, duration_ms, status_ended_at, event_count
| SORT episode.id ASC, status_started_at ASC
| LIMIT 10000`.print('basic');
};
