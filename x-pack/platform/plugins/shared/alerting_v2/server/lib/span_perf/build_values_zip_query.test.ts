/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildValuesZipSpansQuery } from './build_values_zip_query';

describe('buildValuesZipSpansQuery', () => {
  const query = buildValuesZipSpansQuery('ep-123', 'default');

  it('targets .rule-events and the given episode and space', () => {
    expect(query).toContain('.rule-events');
    expect(query).toContain('"ep-123"');
    expect(query).toContain('"default"');
  });

  it('computes duration in ES via VALUES zip, not TOP', () => {
    expect(query).toContain('VALUES');
    expect(query).toContain('MV_ZIP');
    expect(query).toContain('duration_ms');
    expect(query).toContain('LIMIT 10000');
    expect(query).not.toContain('TOP(');
  });
});
