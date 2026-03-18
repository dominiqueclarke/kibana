/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { get, pickBy, isEmpty } from 'lodash';

// ============================================================================
// Field Value Extraction Helpers
// ============================================================================

/**
 * Common interface for document data sources (DataGrid row or DocViewer hit).
 * Both have flattened fields and raw ES document source.
 */
export interface DocumentData {
  flattened: Record<string, unknown>;
  raw?: { _source?: Record<string, unknown> };
}

/**
 * Extracts a value from the raw ES document _source using dot-notation path.
 */
export function getFromSource<T = unknown>(doc: DocumentData, fieldPath: string): T | undefined {
  return get(doc.raw?._source, fieldPath) as T | undefined;
}

/**
 * Extracts a value from the flattened fields.
 * Flattened fields use dot-notation keys directly (e.g., "rule.id").
 */
export function getFromFlattened<T = unknown>(doc: DocumentData, fieldPath: string): T | undefined {
  return doc.flattened[fieldPath] as T | undefined;
}

/**
 * Extracts a field value, trying flattened first (faster), then falling back to _source.
 */
export function getFieldValue<T = unknown>(doc: DocumentData, fieldPath: string): T | undefined {
  return getFromFlattened<T>(doc, fieldPath) ?? getFromSource<T>(doc, fieldPath);
}

/** Filters out null, undefined, and empty string values */
export const isNonEmpty = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '';

/**
 * Collects flattened fields that start with a given prefix.
 * Returns an object with the prefix stripped from keys.
 */
export function getNestedFromFlattened(doc: DocumentData, prefix: string): Record<string, unknown> {
  const flattenedPrefix = `${prefix}.`;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(doc.flattened)) {
    if (key.startsWith(flattenedPrefix) && isNonEmpty(value)) {
      result[key.slice(flattenedPrefix.length)] = value;
    }
  }
  return result;
}

/**
 * Extracts all fields under a given prefix from both _source and flattened.
 * Prioritizes _source for nested objects, falls back to flattened.
 */
export function getNestedFieldValues(
  doc: DocumentData,
  prefix: string
): Record<string, unknown> | undefined {
  // Try _source first (nested object)
  const sourceValue = getFromSource<Record<string, unknown>>(doc, prefix);
  if (sourceValue && typeof sourceValue === 'object') {
    const filtered = pickBy(sourceValue, isNonEmpty);
    if (!isEmpty(filtered)) return filtered;
  }

  // Fallback to flattened fields
  const flattened = getNestedFromFlattened(doc, prefix);
  return !isEmpty(flattened) ? flattened : undefined;
}
