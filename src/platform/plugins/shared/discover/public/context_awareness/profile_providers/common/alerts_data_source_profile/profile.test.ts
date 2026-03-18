/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { createStubIndexPattern } from '@kbn/data-views-plugin/common/data_view.stub';
import { ALERT_EVENTS_DATA_STREAM, ALERT_ACTIONS_DATA_STREAM } from '@kbn/alerting-v2-schemas';
import { createDataViewDataSource, createEsqlDataSource } from '../../../../../common/data_sources';
import type { RootContext } from '../../../profiles';
import { DataSourceCategory, SolutionType } from '../../../profiles';
import { createAlertsDataSourceProfileProvider } from './profile';
import type { ContextWithProfileId } from '../../../profile_service';
import { ALERTS_PROFILE_ID } from './constants';

describe('alertsDataSourceProfileProvider', () => {
  const alertsProfileProvider = createAlertsDataSourceProfileProvider();

  const ROOT_CONTEXT: ContextWithProfileId<RootContext> = {
    profileId: ALERTS_PROFILE_ID,
    solutionType: SolutionType.Default,
  };

  const RESOLUTION_MATCH = {
    isMatch: true,
    context: {
      category: DataSourceCategory.Default,
    },
  };

  const RESOLUTION_MISMATCH = {
    isMatch: false,
  };

  describe('resolve', () => {
    describe('data view sources', () => {
      it('should match .alerts-events data stream', () => {
        const indexPattern = ALERT_EVENTS_DATA_STREAM;
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createDataViewDataSource({ dataViewId: indexPattern }),
          dataView: createStubIndexPattern({ spec: { title: indexPattern } }),
        });
        expect(result).toEqual(RESOLUTION_MATCH);
      });

      it('should match .alerts-events with wildcard', () => {
        const indexPattern = '.alerts-events*';
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createDataViewDataSource({ dataViewId: indexPattern }),
          dataView: createStubIndexPattern({ spec: { title: indexPattern } }),
        });
        expect(result).toEqual(RESOLUTION_MATCH);
      });

      it('should match .alerts-actions data stream', () => {
        const indexPattern = ALERT_ACTIONS_DATA_STREAM;
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createDataViewDataSource({ dataViewId: indexPattern }),
          dataView: createStubIndexPattern({ spec: { title: indexPattern } }),
        });
        expect(result).toEqual(RESOLUTION_MATCH);
      });

      it('should match mixed pattern with alerts-events', () => {
        const indexPattern = `${ALERT_EVENTS_DATA_STREAM},logs-*`;
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createDataViewDataSource({ dataViewId: indexPattern }),
          dataView: createStubIndexPattern({ spec: { title: indexPattern } }),
        });
        expect(result).toEqual(RESOLUTION_MATCH);
      });

      it('should match both alert data streams together', () => {
        const indexPattern = `${ALERT_EVENTS_DATA_STREAM},${ALERT_ACTIONS_DATA_STREAM}`;
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createDataViewDataSource({ dataViewId: indexPattern }),
          dataView: createStubIndexPattern({ spec: { title: indexPattern } }),
        });
        expect(result).toEqual(RESOLUTION_MATCH);
      });

      it('should NOT match V1 alert indices (.alerts-*)', () => {
        const indexPattern = '.alerts-observability.logs.alerts-default';
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createDataViewDataSource({ dataViewId: indexPattern }),
          dataView: createStubIndexPattern({ spec: { title: indexPattern } }),
        });
        expect(result).toEqual(RESOLUTION_MISMATCH);
      });

      it('should NOT match generic .alerts-* pattern (V1)', () => {
        const indexPattern = '.alerts-*';
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createDataViewDataSource({ dataViewId: indexPattern }),
          dataView: createStubIndexPattern({ spec: { title: indexPattern } }),
        });
        expect(result).toEqual(RESOLUTION_MISMATCH);
      });

      it('should NOT match .siem-signals-* (V1)', () => {
        const indexPattern = '.siem-signals-default';
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createDataViewDataSource({ dataViewId: indexPattern }),
          dataView: createStubIndexPattern({ spec: { title: indexPattern } }),
        });
        expect(result).toEqual(RESOLUTION_MISMATCH);
      });

      it('should NOT match non-alert index patterns', () => {
        const indexPattern = 'logs-*';
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createDataViewDataSource({ dataViewId: indexPattern }),
          dataView: createStubIndexPattern({ spec: { title: indexPattern } }),
        });
        expect(result).toEqual(RESOLUTION_MISMATCH);
      });
    });

    describe('ES|QL sources', () => {
      it('should match ES|QL query against .alerts-events', () => {
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createEsqlDataSource(),
          query: { esql: `FROM ${ALERT_EVENTS_DATA_STREAM} | SORT @timestamp DESC` },
        });
        expect(result).toEqual(RESOLUTION_MATCH);
      });

      it('should match ES|QL query against .alerts-actions', () => {
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createEsqlDataSource(),
          query: { esql: `FROM ${ALERT_ACTIONS_DATA_STREAM} | LIMIT 100` },
        });
        expect(result).toEqual(RESOLUTION_MATCH);
      });

      it('should match ES|QL query with both data streams', () => {
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createEsqlDataSource(),
          query: {
            esql: `FROM ${ALERT_EVENTS_DATA_STREAM},${ALERT_ACTIONS_DATA_STREAM} | SORT @timestamp DESC`,
          },
        });
        expect(result).toEqual(RESOLUTION_MATCH);
      });

      it('should NOT match ES|QL query against V1 .alerts-* index', () => {
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createEsqlDataSource(),
          query: { esql: 'FROM .alerts-* | SORT @timestamp DESC' },
        });
        expect(result).toEqual(RESOLUTION_MISMATCH);
      });

      it('should NOT match ES|QL query against non-alert index', () => {
        const result = alertsProfileProvider.resolve({
          rootContext: ROOT_CONTEXT,
          dataSource: createEsqlDataSource(),
          query: { esql: 'FROM logs-* | SORT @timestamp DESC' },
        });
        expect(result).toEqual(RESOLUTION_MISMATCH);
      });
    });
  });

  describe('profile', () => {
    it('should have the correct profile ID', () => {
      expect(alertsProfileProvider.profileId).toBe(ALERTS_PROFILE_ID);
    });

    it('should be marked as experimental', () => {
      expect(alertsProfileProvider.isExperimental).toBe(true);
    });
  });
});
