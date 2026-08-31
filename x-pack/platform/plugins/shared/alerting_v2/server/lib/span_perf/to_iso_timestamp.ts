/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { firstField } from './first_field';
import { toEpochMs } from './to_epoch_ms';

/** Normalize an ES date field to ISO-8601 UTC. */
export const toIsoTimestamp = (value: unknown): string | undefined => {
  const inner = firstField(value);
  if (inner == null) {
    return undefined;
  }

  if (typeof inner === 'string' && inner.length > 0 && !Number.isNaN(Date.parse(inner))) {
    return new Date(Date.parse(inner)).toISOString();
  }

  try {
    return new Date(toEpochMs(inner)).toISOString();
  } catch {
    return undefined;
  }
};
