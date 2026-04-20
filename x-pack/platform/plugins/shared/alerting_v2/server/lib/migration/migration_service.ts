/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { v4 as uuidV4 } from 'uuid';
import type { KibanaRequest } from '@kbn/core-http-server';
import type { Logger } from '@kbn/logging';
import type { AlertingServerStart as AlertingV1ServerStart } from '@kbn/alerting-plugin/server';
import type { InferenceServerStart } from '@kbn/inference-plugin/server';
import {
  TRANSLATION_SYSTEM_PROMPT,
  getTranslateUserPrompt,
  getRefineUserPrompt,
} from './translation_prompt';

interface MigrationSessionState {
  sessionId: string;
  v1RuleId: string;
  v1Rule: Record<string, unknown>;
  proposal: Record<string, unknown>;
  notes: string;
  status: 'awaiting_review' | 'done' | 'cancelled';
}

export class MigrationService {
  private sessions = new Map<string, MigrationSessionState>();

  constructor(
    private readonly alerting: AlertingV1ServerStart,
    private readonly inference: InferenceServerStart,
    private readonly logger: Logger
  ) {}

  async startMigration(
    request: KibanaRequest,
    v1RuleId: string
  ): Promise<{
    sessionId: string;
    v1Rule: Record<string, unknown>;
    proposal: Record<string, unknown>;
    notes: string;
    status: string;
  }> {
    const rulesClient = await this.alerting.getRulesClientWithRequest(request);
    const v1Rule = await rulesClient.get({ id: v1RuleId });

    const { proposal, notes } = await this.callLLM(
      request,
      TRANSLATION_SYSTEM_PROMPT,
      getTranslateUserPrompt(v1Rule as Record<string, unknown>)
    );

    const sessionId = uuidV4();
    const session: MigrationSessionState = {
      sessionId,
      v1RuleId,
      v1Rule: v1Rule as Record<string, unknown>,
      proposal,
      notes,
      status: 'awaiting_review',
    };
    this.sessions.set(sessionId, session);

    return {
      sessionId,
      v1Rule: session.v1Rule,
      proposal: session.proposal,
      notes: session.notes,
      status: session.status,
    };
  }

  async resume(
    request: KibanaRequest,
    sessionId: string,
    action: 'approve' | 'refine' | 'cancel',
    feedback?: string
  ): Promise<{
    proposal?: Record<string, unknown>;
    changeNotes?: string;
    v2RuleId?: string;
    status: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Migration session ${sessionId} not found`);
    }

    if (action === 'cancel') {
      session.status = 'cancelled';
      this.sessions.delete(sessionId);
      return { status: 'cancelled' };
    }

    if (action === 'refine' && feedback) {
      const { proposal, notes } = await this.callLLM(
        request,
        TRANSLATION_SYSTEM_PROMPT,
        getRefineUserPrompt(session.proposal, feedback, session.v1Rule)
      );

      session.proposal = proposal;
      session.notes = notes;
      session.status = 'awaiting_review';

      return {
        proposal: session.proposal,
        changeNotes: session.notes,
        status: session.status,
      };
    }

    if (action === 'approve') {
      session.status = 'done';
      this.sessions.delete(sessionId);

      this.logger.info(`Migration approved for V1 rule ${session.v1RuleId}. V2 proposal ready.`);

      return {
        status: 'done',
      };
    }

    throw new Error(`Unknown action: ${action}`);
  }

  private async callLLM(
    request: KibanaRequest,
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ proposal: Record<string, unknown>; notes: string }> {
    const chatModel = await this.inference.getChatModel({
      request,
      connectorId: '.gp-llm-v2-chat_completion',
      chatModelOptions: { temperature: 0.2 },
    });

    const response = await chatModel.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'human', content: userPrompt },
    ]);

    const content = typeof response.content === 'string' ? response.content : '';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        proposal: parsed.proposal ?? {},
        notes: parsed.notes ?? 'No migration notes provided.',
      };
    } catch (e) {
      this.logger.warn(`Failed to parse LLM response: ${e}`);
      return {
        proposal: {},
        notes: `Failed to parse LLM response. Raw output:\n\n${content}`,
      };
    }
  }
}
