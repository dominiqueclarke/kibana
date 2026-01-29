/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import type { CommonStepDefinition } from '@kbn/workflows-extensions/common';

/**
 * Step type ID for creating an external alert.
 */
export const AlertCreateStepTypeId = 'alert.create';

/**
 * Input schema for the alert.create step.
 * This defines the payload required to ingest an alert from a third-party source.
 */
export const EventSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const EventStatusSchema = z.enum(['active', 'recovered']);
export const EventSourceSchema = z.enum(['Prometheus', 'Datadog', 'Sentry', 'PagerDuty', 'custom']);

/* Input Schema for workflow step
 * Allow broad values to accommodate various external systems */
export const ExternalEventInputSchema = z.object({
  fingerprint: z
    .string()
    .describe(
      'A unique identifier for deduplication (e.g., "source:monitor_id:group"). Each event with the same fingerprint will update the existing alert.'
    ),
  reason: z.string().describe('A human-readable summary of the alert.'),
  rule_name: z
    .string()
    .describe('The name of the rule, monitor, or condition that triggered the alert.'),
  severity: z.string().describe('The severity level of the alert.'),
  source: z
    .string()
    .describe('The originating system of the alert (e.g., "Prometheus", "Sentry").'),
  timestamp: z.iso
    .datetime()
    .optional()
    .describe('The ISO 8601 timestamp of when the event occurred. Defaults to the current time.'),
  status: z.string().optional().describe('The status of the alert. Defaults to "open".'),
  tags: z.array(z.string()).optional().describe('A list of tags for categorization.'),
  links: z
    .array(z.object({ label: z.string(), url: z.string() }))
    .optional()
    .describe('A list of relevant links, such as a link back to the source system.'),
  raw_payload: z
    .record(z.string(), z.any())
    .optional()
    .describe('The original, unprocessed payload from the source system.'),
});

/**
 * Output schema for the alert.create step.
 * This defines the data returned after the alert is created.
 */
export const OutputSchema = z.object({
  success: z.boolean().describe('Indicates whether the alert was created successfully.'),
  id: z.string().uuid().describe('The unique ID of the newly created alert document.'),
});

export type AlertCreateStepInput = z.infer<typeof ExternalEventInputSchema>;
export type AlertCreateStepOutput = z.infer<typeof OutputSchema>;

/**
 * Common step definition for the alert.create step.
 */
export const alertCreateStepCommonDefinition: CommonStepDefinition = {
  id: AlertCreateStepTypeId,
  inputSchema: ExternalEventInputSchema,
  outputSchema: OutputSchema,
};

// --- Type Definitions for External Events integration with alerting ---
export type EventSeverity = z.infer<typeof EventSeveritySchema>;
export type EventStatus = z.infer<typeof EventStatusSchema>;
export type EventSource = z.infer<typeof EventSourceSchema>;

/* External Event Schema for alert creation
 * Enforce specific values when sent to the alerts client for ingestion */
export const ExternalEventSchema = z.object({
  ...ExternalEventInputSchema.shape,
  severity: EventSeveritySchema.describe('The severity level of the alert.'),
  status: EventStatusSchema.optional().describe('The status of the alert. Defaults to "open".'),
  source: EventSourceSchema.describe('The originating system of the alert.'),
});
export type ExternalEvent = z.infer<typeof ExternalEventSchema>;
