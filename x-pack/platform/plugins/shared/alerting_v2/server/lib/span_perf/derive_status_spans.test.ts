/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { deriveStatusSpans } from './derive_status_spans';
import type { EpisodeEvent } from './types';

const event = (
  timestamp: string,
  episodeStatus: string,
  overrides: Partial<EpisodeEvent> = {}
): EpisodeEvent => ({
  timestamp,
  episodeStatus,
  episodeId: 'ep-1',
  ruleId: 'rule-1',
  groupHash: 'g-1',
  ...overrides,
});

describe('deriveStatusSpans', () => {
  it('returns no spans for an empty event list', () => {
    expect(deriveStatusSpans([])).toEqual([]);
  });

  it('closes a single-event episode against its own timestamp with a null end', () => {
    expect(deriveStatusSpans([event('2026-01-01T00:00:00.000Z', 'active')])).toEqual([
      {
        episodeId: 'ep-1',
        ruleId: 'rule-1',
        groupHash: 'g-1',
        statusStartedAt: '2026-01-01T00:00:00.000Z',
        previousStatus: null,
        episodeStatus: 'active',
        statusEndedAt: null,
        durationMs: 0,
      },
    ]);
  });

  it('collapses a contiguous run into one span', () => {
    const spans = deriveStatusSpans([
      event('2026-01-01T00:00:00.000Z', 'active'),
      event('2026-01-01T00:00:01.000Z', 'active'),
      event('2026-01-01T00:00:02.000Z', 'active'),
    ]);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      episodeStatus: 'active',
      statusStartedAt: '2026-01-01T00:00:00.000Z',
      statusEndedAt: null,
      durationMs: 2000,
      previousStatus: null,
    });
  });

  it('opens a new span on each status change and measures duration to the next start', () => {
    const spans = deriveStatusSpans([
      event('2026-01-01T00:00:00.000Z', 'active'),
      event('2026-01-01T00:00:01.000Z', 'recovering'),
      event('2026-01-01T00:00:02.000Z', 'active'),
    ]);

    expect(spans).toEqual([
      expect.objectContaining({
        episodeStatus: 'active',
        previousStatus: null,
        statusStartedAt: '2026-01-01T00:00:00.000Z',
        statusEndedAt: '2026-01-01T00:00:01.000Z',
        durationMs: 1000,
      }),
      expect.objectContaining({
        episodeStatus: 'recovering',
        previousStatus: 'active',
        statusStartedAt: '2026-01-01T00:00:01.000Z',
        statusEndedAt: '2026-01-01T00:00:02.000Z',
        durationMs: 1000,
      }),
      expect.objectContaining({
        episodeStatus: 'active',
        previousStatus: 'recovering',
        statusStartedAt: '2026-01-01T00:00:02.000Z',
        statusEndedAt: null,
        durationMs: 0,
      }),
    ]);
  });
});
