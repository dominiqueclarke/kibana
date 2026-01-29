/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { CoreSetup } from '@kbn/core/server';
import type { ServerStepDefinition } from '@kbn/workflows-extensions/server';
import type { AlertsService } from '../../../alerts_service';
import {
  alertCreateStepCommonDefinition,
  type EventSource,
} from '../../../common/workflows/step_types/alert_create';

/**
 * Normalizes a variety of common external status strings into the canonical
 * Kibana alert status ('active' or 'recovered').
 *
 * @param externalStatus The status string from the external system.
 * @returns The normalized Kibana alert status.
 */
export function normalizeAlertStatus(externalStatus: string | undefined): 'active' | 'recovered' {
  const lowerStatus = externalStatus?.toLowerCase();

  switch (lowerStatus) {
    // "Recovered" states
    case 'ok':
    case 'resolved':
    case 'recovered':
    case 'success':
    case 'closed':
    case 'completed':
    case 'up':
      return 'recovered';

    // "Active" states
    case 'alert':
    case 'firing':
    case 'triggered':
    case 'open':
    case 'active':
    case 'failure':
    case 'error':
    case 'critical':
    case 'warn':
    case 'warning':
    case 'down':
      return 'active';

    // Default for unknown or missing status
    default:
      return 'active';
  }
}

/**
 * Normalizes and capitalizes the source of an external alert, mapping synonyms
 * to a canonical name.
 *
 * @param externalSource The source string from the external system.
 * @returns The normalized and capitalized source string.
 */
export function normalizeAlertSource(externalSource: string | undefined): EventSource {
  const lowerSource = externalSource?.toLowerCase().trim() ?? 'custom';

  switch (lowerSource) {
    case 'datadog':
    case 'dd':
      return 'Datadog';
    case 'sentry':
      return 'Sentry';
    case 'prometheus':
    case 'prom':
      return 'Prometheus';
    case 'pagerduty':
    case 'pd':
      return 'PagerDuty';
    default:
      return 'Custom';
  }
}

/**
 * A static, in-memory "synthetic" rule context.
 * This object provides the minimum necessary structure to satisfy the AlertsClient constructor.
 */
const EXTERNAL_RULE_CONTEXT = {
  rule: {
    id: 'singleton-for-external-alerts',
    name: 'External Alerts Ingestion',
    tags: [],
    params: {},
    schedule: { interval: '1m' },
    actions: [],
    consumer: 'alerting',
    producer: 'external',
    rule_type_id: 'kibana.external-alert',
    enabled: true,
  },
  ruleType: {
    id: 'kibana.external-alert',
    name: 'External Alert',
    actionGroups: [{ id: 'default', name: 'default' }],
    defaultActionGroupId: 'default',
    producer: 'external',
    alerts: {
      context: 'external',
      isSpaceAware: true,
      shouldWrite: true,
    },
  },
};

/**
 * Creates the server-side definition for the alert.create step.
 */
export const getAlertCreateStepDefinition = (
  coreSetup: CoreSetup,
  alertsService: AlertsService
): ServerStepDefinition => ({
  ...alertCreateStepCommonDefinition,
  handler: async (context) => {
    console.log(
      'running alert create step handler with input:',
      JSON.stringify(context.input, null, 2)
    );
    const { logger, input, contextManager, spaceId } = context;
    const esClient = contextManager.getScopedEsClient();
    const request = contextManager.getFakeRequest();

    try {
      // Create an AlertsClient using our static external rule context.
      const alertsClient = await alertsService.createAlertsClient({
        ...EXTERNAL_RULE_CONTEXT,
        spaceId,
        // These dependencies are not required for the `persistExternalAlert` method.
        request,
        elasticsearchClientPromise: Promise.resolve(esClient),
      });

      if (!alertsClient) {
        throw new Error('Failed to create AlertsClient for external alerts.');
      }

      // Normalize the status from the input
      const normalizedInput = {
        ...input,
        status: normalizeAlertStatus(input.status),
        source: normalizeAlertSource(input.source),
      };

      // Call the new, dedicated method to persist the alert directly.
      const alertIds = await alertsClient.persistExternalAlerts([normalizedInput]);
      logger.info(`Successfully indexed external alert "${input.title}" with ID ${alertIds[0]}.`);

      return {
        output: {
          success: true,
          id: alertIds[0],
        },
      };
    } catch (error) {
      logger.error(`Failed to execute alert.create step: ${error.message}`, error);
      return {
        error: error instanceof Error ? error : new Error('An unknown error occurred'),
      };
    }
  },
});
