/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  attachDurationsToSpanStarts,
  TOP_ZIP_PREV_START_SENTINEL,
} from './attach_durations_to_span_starts';
import type { SpanStart } from './types';

const start = (
  overrides: Partial<SpanStart> & Pick<SpanStart, 'statusStartedAt' | 'episodeStatus'>
): SpanStart => ({
  prevStatus: null,
  episodeId: 'ep-1',
  ruleId: 'rule-1',
  groupHash: 'g-1',
  ...overrides,
});

describe('attachDurationsToSpanStarts', () => {
  it('returns no spans for an empty start list', () => {
    expect(attachDurationsToSpanStarts([], '2026-01-01T00:00:10.000Z')).toEqual([]);
  });

  it('treats the TOP zip start sentinel as a null previous status', () => {
    const [span] = attachDurationsToSpanStarts(
      [
        start({
          statusStartedAt: '2026-01-01T00:00:00.000Z',
          episodeStatus: 'active',
          prevStatus: TOP_ZIP_PREV_START_SENTINEL,
        }),
      ],
      '2026-01-01T00:00:05.000Z'
    );

    expect(span.previousStatus).toBeNull();
    expect(span.statusEndedAt).toBeNull();
    expect(span.durationMs).toBe(5000);
  });

  it('uses the next start as statusEndedAt and the latest ts for the last span', () => {
    const spans = attachDurationsToSpanStarts(
      [
        start({
          statusStartedAt: '2026-01-01T00:00:00.000Z',
          episodeStatus: 'active',
          prevStatus: TOP_ZIP_PREV_START_SENTINEL,
        }),
        start({
          statusStartedAt: '2026-01-01T00:00:02.000Z',
          episodeStatus: 'recovering',
          prevStatus: 'active',
        }),
      ],
      '2026-01-01T00:00:09.000Z'
    );

    expect(spans[0]).toMatchObject({
      episodeStatus: 'active',
      previousStatus: null,
      statusEndedAt: '2026-01-01T00:00:02.000Z',
      durationMs: 2000,
    });
    expect(spans[1]).toMatchObject({
      episodeStatus: 'recovering',
      previousStatus: 'active',
      statusEndedAt: null,
      durationMs: 7000,
    });
  });
});
