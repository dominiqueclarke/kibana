/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { toEpochMs } from './to_epoch_ms';
import type { EpisodeEvent, StatusSpan } from './types';

/**
 * One-pass run-length encode of ordered `.rule-events` into status spans.
 * Span boundaries come only from adjacent-row `episode.status` changes.
 */
export const deriveStatusSpans = (events: EpisodeEvent[]): StatusSpan[] => {
  if (events.length === 0) {
    return [];
  }

  const [first] = events;
  const spans: StatusSpan[] = [];

  let episodeId = first.episodeId;
  let ruleId = first.ruleId;
  let groupHash = first.groupHash;
  let episodeStatus = first.episodeStatus;
  let statusStartedAt = first.timestamp;
  let previousStatus: string | null = null;

  for (let i = 1; i < events.length; i++) {
    const event = events[i];
    if (event.episodeStatus === episodeStatus) {
      continue;
    }

    spans.push({
      episodeId,
      ruleId,
      groupHash,
      statusStartedAt,
      previousStatus,
      episodeStatus,
      statusEndedAt: event.timestamp,
      durationMs: toEpochMs(event.timestamp) - toEpochMs(statusStartedAt),
    });

    previousStatus = episodeStatus;
    episodeId = event.episodeId;
    ruleId = event.ruleId;
    groupHash = event.groupHash;
    episodeStatus = event.episodeStatus;
    statusStartedAt = event.timestamp;
  }

  const lastTimestamp = events[events.length - 1].timestamp;
  spans.push({
    episodeId,
    ruleId,
    groupHash,
    statusStartedAt,
    previousStatus,
    episodeStatus,
    statusEndedAt: null,
    durationMs: toEpochMs(lastTimestamp) - toEpochMs(statusStartedAt),
  });

  return spans;
};
