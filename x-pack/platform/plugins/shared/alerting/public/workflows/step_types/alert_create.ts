/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { i18n } from '@kbn/i18n';
import type { PublicStepDefinition } from '@kbn/workflows-extensions/public';
import {
  alertCreateStepCommonDefinition,
  AlertCreateStepTypeId,
} from '../../../common/workflows/step_types/alert_create';

/**
 * Public definition for the alert.create step.
 */
export const alertCreateStepDefinition: PublicStepDefinition = {
  ...alertCreateStepCommonDefinition,
  label: i18n.translate('xpack.alerting.workflows.alertCreate.label', {
    defaultMessage: 'Create Alert',
  }),
  description: i18n.translate('xpack.alerting.workflows.alertCreate.description', {
    defaultMessage:
      'Ingests an alert from a third-party source like Prometheus, Datadog, or Sentry.',
  }),
  documentation: {
    details: i18n.translate('xpack.alerting.workflows.alertCreate.documentation.details', {
      defaultMessage:
        'This step allows you to create a new alert document in Kibana from an external system. The created alert will appear in the Observability alerts table alongside native Kibana alerts.',
    }),
    examples: [
      `## Ingest a Prometheus Alert
\`\`\`yaml
- name: ingest_prometheus_alert
  type: ${AlertCreateStepTypeId}
  with:
    source: "prometheus"
    title: "High CPU on instance {{ context.alert.instance }}"
    message: "CPU usage has exceeded 90% for the last 5 minutes."
    severity: "critical"
    raw_payload:
      alertname: "HighCPU"
      instance: "{{ context.alert.instance }}"
      job: "node_exporter"
\`\`\``,
    ],
  },
};
