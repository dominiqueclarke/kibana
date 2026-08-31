/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EsqlQueryResponse } from '@elastic/elasticsearch/lib/api/types';

export const esqlResponseToRows = <T>(response: EsqlQueryResponse): T[] => {
  const columnNames = response.columns.map((column) => column.name);
  return response.values.map((valueRow) => {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < columnNames.length; i++) {
      row[columnNames[i]] = valueRow[i];
    }
    return row as T;
  });
};

export const esqlTookMs = (response: EsqlQueryResponse): number | null => {
  const took = (response as EsqlQueryResponse & { took?: number }).took;
  return typeof took === 'number' ? took : null;
};
