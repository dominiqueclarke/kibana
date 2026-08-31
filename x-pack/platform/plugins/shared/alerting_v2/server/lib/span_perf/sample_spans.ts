/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { StatusSpan } from './types';

export const SAMPLE_EDGE = 3;

/** First and last `edge` spans so a 15k result can be inspected without the payload. */
export const sampleSpans = (spans: StatusSpan[], edge: number = SAMPLE_EDGE): StatusSpan[] => {
  if (spans.length <= edge * 2) {
    return spans;
  }

  return [...spans.slice(0, edge), ...spans.slice(-edge)];
};
