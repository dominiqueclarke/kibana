/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { toEpochMs } from './to_epoch_ms';
import type { SpanStart, StatusSpan } from './types';

export const TOP_ZIP_PREV_START_SENTINEL = '__START__';

/**
 * Attach `statusEndedAt` / `durationMs` to TOP-zip span starts.
 * Span i ends at span i+1's start; the last span stays open and measures
 * duration against `episodeLatestTs`.
 */
export const attachDurationsToSpanStarts = (
  starts: SpanStart[],
  episodeLatestTs: string
): StatusSpan[] => {
  return starts.map((start, index) => {
    const next = starts[index + 1];
    const statusEndedAt = next?.statusStartedAt ?? null;
    const endForDuration = statusEndedAt ?? episodeLatestTs;
    const previousStatus =
      start.prevStatus == null || start.prevStatus === TOP_ZIP_PREV_START_SENTINEL
        ? null
        : start.prevStatus;

    return {
      episodeId: start.episodeId,
      ruleId: start.ruleId,
      groupHash: start.groupHash,
      statusStartedAt: start.statusStartedAt,
      previousStatus,
      episodeStatus: start.episodeStatus,
      statusEndedAt,
      durationMs: toEpochMs(endForDuration) - toEpochMs(start.statusStartedAt),
    };
  });
};
