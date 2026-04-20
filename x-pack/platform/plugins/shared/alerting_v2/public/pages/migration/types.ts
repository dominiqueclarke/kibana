/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export interface MigrationRound {
  type: 'initial' | 'refinement';
  userFeedback?: string;
  proposal: Record<string, unknown>;
  notes: string;
}

export interface MigrationSession {
  sessionId: string;
  v1Rule: Record<string, unknown>;
  rounds: MigrationRound[];
  mode: 'review' | 'refining';
  status: 'awaiting_review' | 'refining' | 'applying' | 'done' | 'cancelled';
}
