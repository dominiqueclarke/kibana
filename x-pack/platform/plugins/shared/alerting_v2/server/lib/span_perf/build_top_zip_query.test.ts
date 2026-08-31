/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildTopZipSpanStartsQuery } from './build_top_zip_query';
import { TOP_ZIP_PREV_START_SENTINEL } from './attach_durations_to_span_starts';

describe('buildTopZipSpanStartsQuery', () => {
  const query = buildTopZipSpanStartsQuery('ep-123');

  it('is a string targeting .rule-events and the given episode', () => {
    expect(typeof query).toBe('string');
    expect(query).toContain('.rule-events');
    expect(query).toContain('"ep-123"');
  });

  it('uses TOP zip for ordered neighbors and keeps latest-ts for Kibana duration', () => {
    expect(query).toContain('TOP(@timestamp, 10000, "asc", episode.status)');
    expect(query).toContain('MV_ZIP');
    expect(query).toContain('MV_EXPAND');
    expect(query).toContain(`"${TOP_ZIP_PREV_START_SENTINEL}"`);
    expect(query).toContain('episode_latest_ts = MAX(@timestamp)');
    expect(query).toContain('event_count = COUNT(*)');
  });
});
