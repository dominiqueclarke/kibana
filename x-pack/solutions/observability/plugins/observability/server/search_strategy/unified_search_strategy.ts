/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ISearchStrategy, PluginStart as DataPluginStart } from '@kbn/data-plugin/server';
import type { IEsSearchRequest } from '@kbn/search-types';
import { combineLatest, of, map, catchError } from 'rxjs';
import { get, sortBy } from 'lodash';
import { ENHANCED_ES_SEARCH_STRATEGY } from '@kbn/data-plugin/common';
import type {
  RuleRegistrySearchRequest,
  RuleRegistrySearchResponse,
} from '@kbn/rule-registry-plugin/common';
import { QueryDslQueryContainer, Query } from '@kbn/data-views-plugin/common/types';

export const EXTERNAL_ALERTS_INDEX_PATTERN = '.alerts-external*';

const getFilter = (
  filter?: QueryDslQueryContainer | QueryDslQueryContainer[]
): QueryDslQueryContainer[] => {
  if (Array.isArray(filter)) {
    return filter;
  }
  return filter ? [filter] : [];
};

export const unifiedAlertsSearchStrategyProvider = (
  data: DataPluginStart
): ISearchStrategy<RuleRegistrySearchRequest, RuleRegistrySearchResponse> => {
  const privateStrategy = data.search.getSearchStrategy('privateRuleRegistryAlertsSearchStrategy');
  const requestUserEs = data.search.getSearchStrategy(ENHANCED_ES_SEARCH_STRATEGY);

  return {
    search: (request, options, deps) => {
      // Request for internal Kibana alerts
      const kibanaAlertsRequest = { ...request };

      // Request for external alerts. We manually construct the body to ensure
      // we only pass valid Elasticsearch parameters, excluding properties like
      // `ruleTypeIds` and `consumers` that are specific to the rule registry.
      const externalAlertsRequest: IEsSearchRequest = {
        params: {
          index: EXTERNAL_ALERTS_INDEX_PATTERN,
          query: {
            bool: {
              ...(request.query?.bool?.must ? { must: request.query?.bool?.must } : {}),
              ...(request.query?.bool?.must_not ? { must_not: request.query?.bool?.must_not } : {}),
              filter: getFilter(request.query?.bool?.filter).filter(
                (f: any) => !f?.terms?.['kibana.alert.rule.type_id']
              ),
            },
          } as Query,
          ...(request.sort ? { sort: request.sort } : {}),
          ...(request.pagination && typeof request.pagination.pageSize === 'number'
            ? { size: request.pagination.pageSize }
            : {}),
          ...(request.pagination
            ? { from: request.pagination.pageIndex * request.pagination.pageSize }
            : {}),
          ...(request.minScore ? { min_score: Number(request.minScore) } : {}),
          ...(request.trackScores ? { track_scores: request.trackScores } : {}),
          ...(request.runtimeMappings ? { runtime_mappings: request.runtimeMappings } : {}),
          ...(request.fields ? { fields: request.fields } : {}),
        },
      };

      // console.log('External Alerts Request:', JSON.stringify(externalAlertsRequest)); // --- IGNORE ---

      const kibanaAlerts$ = privateStrategy.search(kibanaAlertsRequest, options, deps);
      const externalAlerts$ = requestUserEs.search(externalAlertsRequest, options, deps).pipe(
        catchError((err) => {
          // If the external index doesn't exist, ES throws an index_not_found_exception.
          // We can safely ignore this and return an empty response.
          if (err.body?.error?.type === 'index_not_found_exception') {
            return of({ rawResponse: { hits: { total: { value: 0 }, hits: [] } } });
          }
          throw err;
        })
      );

      return combineLatest([kibanaAlerts$, externalAlerts$]).pipe(
        map(([kibanaResponse, externalResponse]) => {
          const kibanaHits = kibanaResponse.rawResponse.hits?.hits || [];
          const externalHits = externalResponse.rawResponse.hits?.hits || [];
          // console.log('External Hits:', externalHits);

          const combinedHits = [...kibanaHits, ...externalHits];

          // In-memory sorting. This is crucial because we are merging two separate queries.
          // The logic assumes sorting by timestamp, which is the default for the alerts table.
          // A more advanced implementation would parse the `request.sort` parameter.
          const sortedHits = sortBy(combinedHits, (hit) => {
            const timestamp = get(hit._source, '@timestamp');
            return new Date(timestamp).getTime();
          }).reverse(); // reverse for descending order

          const total =
            (typeof kibanaResponse.rawResponse.hits.total === 'number'
              ? kibanaResponse.rawResponse.hits.total
              : kibanaResponse.rawResponse.hits.total?.value ?? 0) +
            (typeof externalResponse.rawResponse.hits.total === 'number'
              ? externalResponse.rawResponse.hits.total
              : externalResponse.rawResponse.hits.total?.value ?? 0);

          // Manual pagination on the merged result set
          const from = request.pagination
            ? request.pagination.pageIndex * request.pagination.pageSize
            : 0;
          const size = request.pagination ? request.pagination.pageSize : 25;
          const paginatedHits = sortedHits.slice(from, from + size);

          return {
            ...kibanaResponse, // Use the Kibana response as a base
            rawResponse: {
              ...kibanaResponse.rawResponse,
              hits: {
                ...kibanaResponse.rawResponse.hits,
                total: { value: total, relation: 'eq' },
                hits: paginatedHits,
              },
            },
          };
        })
      );
    },
    cancel: async (id, options, deps) => {
      if (privateStrategy.cancel) {
        await privateStrategy.cancel(id, options, deps);
      }
    },
  };
};
