/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildEsqlEventsQuery } from './build_esql_events_query';

describe('buildEsqlEventsQuery', () => {
  const query = buildEsqlEventsQuery('ep-123', 'default');

  it('targets .rule-events and the given episode and space', () => {
    expect(query).toContain('.rule-events');
    expect(query).toContain('"ep-123"');
    expect(query).toContain('"default"');
  });

  it('fetches ordered events without VALUES/TOP zip', () => {
    expect(query).toContain('KEEP');
    expect(query).toContain('SORT');
    expect(query).toContain('LIMIT 10000');
    expect(query).not.toContain('VALUES');
    expect(query).not.toContain('TOP(');
    expect(query).not.toContain('MV_ZIP');
    expect(query).not.toContain('MV_EXPAND');
  });
});
