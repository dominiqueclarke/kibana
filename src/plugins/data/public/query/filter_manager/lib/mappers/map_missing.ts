/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { Filter, isMissingFilter, FILTERS } from '@kbn/es-query';

export const mapMissing = (filter: Filter) => {
  if (isMissingFilter(filter)) {
    return {
      type: FILTERS.MISSING,
      value: FILTERS.MISSING,
      key: filter.missing.field,
    };
  }

  throw filter;
};
