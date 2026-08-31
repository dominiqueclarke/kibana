/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * Unwrap an Elasticsearch `fields` value (always an array) or a bare scalar.
 */
export const firstField = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.length > 0 ? firstField(value[0]) : undefined;
  }

  return value;
};

export const firstString = (value: unknown): string | undefined => {
  const inner = firstField(value);
  if (typeof inner === 'string' && inner.length > 0) {
    return inner;
  }
  if (typeof inner === 'number' && Number.isFinite(inner)) {
    return String(inner);
  }
  return undefined;
};

export const firstNumber = (value: unknown): number | undefined => {
  const inner = firstField(value);
  if (typeof inner === 'number' && Number.isFinite(inner)) {
    return inner;
  }
  if (typeof inner === 'string' && inner.length > 0) {
    const parsed = Number(inner);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};
