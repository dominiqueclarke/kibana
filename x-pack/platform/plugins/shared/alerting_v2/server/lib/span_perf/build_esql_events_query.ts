/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { esql } from '@elastic/esql';
import { ALERT_EVENTS_DATA_STREAM } from '@kbn/alerting-v2-constants';

/** ES|QL result-window cap on this cluster (`esql.query.result_truncation_max_size`). */
export const ESQL_EVENT_CAP = 10_000;

/**
 * One-shot event stream for Kibana RLE. No VALUES/TOP zip — rows only.
 * LIMIT is inlined: ES|QL rejects bound parameters in LIMIT.
 */
export const buildEsqlEventsQuery = (episodeId: string, spaceId: string): string => {
  return esql`FROM ${ALERT_EVENTS_DATA_STREAM}
| WHERE type == "alert" AND space_id == ${esql.str(spaceId)}
    AND episode.status IS NOT NULL
    AND episode.id == ${esql.str(episodeId)}
| KEEP episode.id, rule.id, group_hash, @timestamp, episode.status
| SORT episode.id ASC, @timestamp ASC
| LIMIT 10000`.print('basic');
};
