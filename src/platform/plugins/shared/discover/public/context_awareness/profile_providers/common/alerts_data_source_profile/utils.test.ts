/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DocumentData } from './utils';
import {
  getFromSource,
  getFromFlattened,
  getFieldValue,
  isNonEmpty,
  getNestedFromFlattened,
  getNestedFieldValues,
} from './utils';

describe('alerts_data_source_profile utils', () => {
  // Helper to create mock document data
  const createMockDoc = (
    flattened: Record<string, unknown> = {},
    source?: Record<string, unknown>
  ): DocumentData => ({
    flattened,
    raw: source ? { _source: source } : undefined,
  });

  describe('getFromSource', () => {
    it('returns value from _source using simple path', () => {
      const doc = createMockDoc({}, { status: 'breached' });
      expect(getFromSource(doc, 'status')).toBe('breached');
    });

    it('returns value from _source using nested path', () => {
      const doc = createMockDoc({}, { rule: { id: 'rule-123', version: 1 } });
      expect(getFromSource(doc, 'rule.id')).toBe('rule-123');
      expect(getFromSource(doc, 'rule.version')).toBe(1);
    });

    it('returns value from deeply nested path', () => {
      const doc = createMockDoc({}, { data: { host: { name: 'server-01' } } });
      expect(getFromSource(doc, 'data.host.name')).toBe('server-01');
    });

    it('returns undefined when path does not exist', () => {
      const doc = createMockDoc({}, { status: 'breached' });
      expect(getFromSource(doc, 'nonexistent')).toBeUndefined();
      expect(getFromSource(doc, 'rule.id')).toBeUndefined();
    });

    it('returns undefined when _source is missing', () => {
      const doc = createMockDoc({ status: 'breached' });
      expect(getFromSource(doc, 'status')).toBeUndefined();
    });

    it('returns undefined when raw is missing', () => {
      const doc: DocumentData = { flattened: {} };
      expect(getFromSource(doc, 'status')).toBeUndefined();
    });

    it('handles null values in path', () => {
      const doc = createMockDoc({}, { rule: null });
      expect(getFromSource(doc, 'rule.id')).toBeUndefined();
    });
  });

  describe('getFromFlattened', () => {
    it('returns value from flattened fields', () => {
      const doc = createMockDoc({ status: 'breached', type: 'alert' });
      expect(getFromFlattened(doc, 'status')).toBe('breached');
      expect(getFromFlattened(doc, 'type')).toBe('alert');
    });

    it('returns value using dot-notation key', () => {
      const doc = createMockDoc({ 'rule.id': 'rule-123', 'data.host.name': 'server-01' });
      expect(getFromFlattened(doc, 'rule.id')).toBe('rule-123');
      expect(getFromFlattened(doc, 'data.host.name')).toBe('server-01');
    });

    it('returns undefined when key does not exist', () => {
      const doc = createMockDoc({ status: 'breached' });
      expect(getFromFlattened(doc, 'nonexistent')).toBeUndefined();
    });

    it('returns null and undefined values as-is', () => {
      const doc = createMockDoc({ nullValue: null, undefinedValue: undefined });
      expect(getFromFlattened(doc, 'nullValue')).toBeNull();
      expect(getFromFlattened(doc, 'undefinedValue')).toBeUndefined();
    });
  });

  describe('getFieldValue', () => {
    it('returns value from flattened when available', () => {
      const doc = createMockDoc({ status: 'from-flattened' }, { status: 'from-source' });
      expect(getFieldValue(doc, 'status')).toBe('from-flattened');
    });

    it('falls back to _source when flattened is undefined', () => {
      const doc = createMockDoc({}, { status: 'from-source' });
      expect(getFieldValue(doc, 'status')).toBe('from-source');
    });

    it('falls back to _source for nested paths', () => {
      const doc = createMockDoc({}, { rule: { id: 'rule-123' } });
      expect(getFieldValue(doc, 'rule.id')).toBe('rule-123');
    });

    it('prefers flattened even for nested paths', () => {
      const doc = createMockDoc({ 'rule.id': 'flattened-rule' }, { rule: { id: 'source-rule' } });
      expect(getFieldValue(doc, 'rule.id')).toBe('flattened-rule');
    });

    it('returns undefined when not found in either location', () => {
      const doc = createMockDoc({}, {});
      expect(getFieldValue(doc, 'nonexistent')).toBeUndefined();
    });

    it('does not fall back when flattened value is null', () => {
      // null is a valid value, not undefined, so it should not fall back
      const doc = createMockDoc({ status: null }, { status: 'from-source' });
      expect(getFieldValue(doc, 'status')).toBeNull();
    });
  });

  describe('isNonEmpty', () => {
    it('returns true for non-empty strings', () => {
      expect(isNonEmpty('hello')).toBe(true);
      expect(isNonEmpty('0')).toBe(true);
      expect(isNonEmpty(' ')).toBe(true); // whitespace is not empty
    });

    it('returns true for numbers', () => {
      expect(isNonEmpty(0)).toBe(true);
      expect(isNonEmpty(42)).toBe(true);
      expect(isNonEmpty(-1)).toBe(true);
    });

    it('returns true for booleans', () => {
      expect(isNonEmpty(true)).toBe(true);
      expect(isNonEmpty(false)).toBe(true);
    });

    it('returns true for objects and arrays', () => {
      expect(isNonEmpty({})).toBe(true);
      expect(isNonEmpty([])).toBe(true);
      expect(isNonEmpty({ key: 'value' })).toBe(true);
    });

    it('returns false for undefined', () => {
      expect(isNonEmpty(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isNonEmpty(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isNonEmpty('')).toBe(false);
    });
  });

  describe('getNestedFromFlattened', () => {
    it('extracts fields with matching prefix', () => {
      const doc = createMockDoc({
        'data.host': 'server-01',
        'data.level': 'error',
        'other.field': 'value',
      });

      const result = getNestedFromFlattened(doc, 'data');

      expect(result).toEqual({
        host: 'server-01',
        level: 'error',
      });
    });

    it('strips the prefix from keys', () => {
      const doc = createMockDoc({
        'data.host.name': 'server-01',
        'data.host.ip': '192.168.1.1',
      });

      const result = getNestedFromFlattened(doc, 'data');

      expect(result).toEqual({
        'host.name': 'server-01',
        'host.ip': '192.168.1.1',
      });
    });

    it('returns empty object when no fields match', () => {
      const doc = createMockDoc({ status: 'breached' });
      expect(getNestedFromFlattened(doc, 'data')).toEqual({});
    });

    it('filters out null, undefined, and empty string values', () => {
      const doc = createMockDoc({
        'data.valid': 'value',
        'data.null': null,
        'data.undefined': undefined,
        'data.empty': '',
        'data.zero': 0,
      });

      const result = getNestedFromFlattened(doc, 'data');

      expect(result).toEqual({
        valid: 'value',
        zero: 0,
      });
    });

    it('does not match partial prefixes', () => {
      const doc = createMockDoc({
        'data.field': 'value',
        'dataExtra.field': 'should-not-match',
      });

      const result = getNestedFromFlattened(doc, 'data');

      expect(result).toEqual({ field: 'value' });
    });
  });

  describe('getNestedFieldValues', () => {
    it('returns nested object from _source when available', () => {
      const doc = createMockDoc({}, { data: { host: 'server-01', level: 'error' } });

      const result = getNestedFieldValues(doc, 'data');

      expect(result).toEqual({
        host: 'server-01',
        level: 'error',
      });
    });

    it('filters empty values from _source', () => {
      const doc = createMockDoc(
        {},
        {
          data: {
            valid: 'value',
            null: null,
            undefined,
            empty: '',
            zero: 0,
          },
        }
      );

      const result = getNestedFieldValues(doc, 'data');

      expect(result).toEqual({
        valid: 'value',
        zero: 0,
      });
    });

    it('falls back to flattened when _source is empty after filtering', () => {
      const doc = createMockDoc(
        { 'data.host': 'from-flattened' },
        { data: { empty: '', null: null } }
      );

      const result = getNestedFieldValues(doc, 'data');

      expect(result).toEqual({ host: 'from-flattened' });
    });

    it('falls back to flattened when _source nested object is missing', () => {
      const doc = createMockDoc(
        { 'data.host': 'server-01', 'data.level': 'error' },
        { status: 'breached' }
      );

      const result = getNestedFieldValues(doc, 'data');

      expect(result).toEqual({
        host: 'server-01',
        level: 'error',
      });
    });

    it('returns undefined when no data found in either location', () => {
      const doc = createMockDoc({ status: 'breached' }, { status: 'breached' });
      expect(getNestedFieldValues(doc, 'data')).toBeUndefined();
    });

    it('returns undefined for empty flattened results', () => {
      const doc = createMockDoc({ 'data.empty': '', 'data.null': null });
      expect(getNestedFieldValues(doc, 'data')).toBeUndefined();
    });

    it('prioritizes _source over flattened when both have values', () => {
      const doc = createMockDoc(
        { 'data.host': 'from-flattened' },
        { data: { host: 'from-source' } }
      );

      const result = getNestedFieldValues(doc, 'data');

      expect(result).toEqual({ host: 'from-source' });
    });

    it('handles non-object values in _source gracefully', () => {
      const doc = createMockDoc(
        { 'data.host': 'from-flattened' },
        { data: 'string-value' } // data is a string, not an object
      );

      const result = getNestedFieldValues(doc, 'data');

      expect(result).toEqual({ host: 'from-flattened' });
    });
  });
});
