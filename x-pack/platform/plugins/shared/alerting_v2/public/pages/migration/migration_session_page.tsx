/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiEmptyPrompt,
  EuiCallOut,
} from '@elastic/eui';
import { useParams, useHistory } from 'react-router-dom';
import { useMutation } from '@kbn/react-query';
import { i18n } from '@kbn/i18n';
import { CoreStart, useService } from '@kbn/core-di-browser';
import type { MigrationSession, MigrationRound } from './types';
import { MigrationProposalPanel } from './components/migration_proposal_panel';
import { MigrationConversation } from './components/migration_conversation';
import { MigrationInput } from './components/migration_input';

const STORAGE_KEY_PREFIX = 'alertingV2Migration_';

const loadSession = (sessionId: string): MigrationSession | null => {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveSession = (session: MigrationSession) => {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${session.sessionId}`, JSON.stringify(session));
};

const clearSession = (sessionId: string) => {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
};

export const MigrationSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const http = useService(CoreStart('http'));
  const history = useHistory();

  const [session, setSession] = useState<MigrationSession | null>(() => loadSession(sessionId));
  const [isRefining, setIsRefining] = useState(false);

  useEffect(() => {
    if (session) {
      saveSession(session);
    }
  }, [session]);

  const resumeMutation = useMutation({
    mutationFn: async (params: { action: 'approve' | 'refine' | 'cancel'; feedback?: string }) => {
      const response = await http.post<{
        proposal?: Record<string, unknown>;
        changeNotes?: string;
        v2RuleId?: string;
        status: string;
      }>(`/internal/alerting_v2/migrate/${sessionId}/resume`, {
        body: JSON.stringify(params),
      });
      return response;
    },
  });

  const handleRefineToggle = useCallback(() => {
    if (!session) return;
    setSession({ ...session, mode: 'refining' });
  }, [session]);

  const handleSubmitFeedback = useCallback(
    async (feedback: string) => {
      if (!session) return;

      setIsRefining(true);
      try {
        const response = await resumeMutation.mutateAsync({ action: 'refine', feedback });

        if (response.proposal && response.changeNotes) {
          const newRound: MigrationRound = {
            type: 'refinement',
            userFeedback: feedback,
            proposal: response.proposal,
            notes: response.changeNotes,
          };
          setSession({
            ...session,
            rounds: [...session.rounds, newRound],
            status: 'awaiting_review',
          });
        }
      } finally {
        setIsRefining(false);
      }
    },
    [session, resumeMutation]
  );

  const handleApprove = useCallback(async () => {
    if (!session) return;
    try {
      await resumeMutation.mutateAsync({ action: 'approve' });
      clearSession(sessionId);
      history.push('/');
    } catch {
      // error handled by mutation state
    }
  }, [session, sessionId, resumeMutation, history]);

  const handleCancel = useCallback(() => {
    clearSession(sessionId);
    resumeMutation.mutate({ action: 'cancel' });
    history.push('/');
  }, [sessionId, resumeMutation, history]);

  if (!session) {
    return (
      <EuiEmptyPrompt
        iconType="warning"
        title={
          <h2>
            {i18n.translate('xpack.alertingV2.migration.sessionNotFound', {
              defaultMessage: 'Session not found',
            })}
          </h2>
        }
        body={
          <p>
            {i18n.translate('xpack.alertingV2.migration.sessionNotFoundBody', {
              defaultMessage:
                'This migration session could not be found. It may have expired or been completed.',
            })}
          </p>
        }
        actions={
          <EuiButton onClick={() => history.push('/')}>
            {i18n.translate('xpack.alertingV2.migration.backToList', {
              defaultMessage: 'Back to rule list',
            })}
          </EuiButton>
        }
      />
    );
  }

  const latestRound = session.rounds[session.rounds.length - 1];
  const ruleName =
    (session.v1Rule as { name?: string })?.name ??
    i18n.translate('xpack.alertingV2.migration.unknownRule', { defaultMessage: 'Unknown rule' });

  const isReviewMode = session.mode === 'review';
  const isApproving = resumeMutation.isLoading && !isRefining;

  return (
    <>
      <EuiPageHeader
        pageTitle={i18n.translate('xpack.alertingV2.migration.sessionTitle', {
          defaultMessage: 'Migrate: {ruleName}',
          values: { ruleName },
        })}
      />
      <EuiSpacer size="l" />

      {resumeMutation.isError && (
        <>
          <EuiCallOut
            color="danger"
            title={i18n.translate('xpack.alertingV2.migration.error', {
              defaultMessage: 'Something went wrong',
            })}
          >
            <p>{String(resumeMutation.error)}</p>
          </EuiCallOut>
          <EuiSpacer size="m" />
        </>
      )}

      {isReviewMode ? (
        <MigrationProposalPanel
          proposal={latestRound.proposal}
          notes={latestRound.notes}
          v1Rule={session.v1Rule}
        />
      ) : (
        <MigrationConversation
          rounds={session.rounds}
          v1Rule={session.v1Rule}
          isRefining={isRefining}
        />
      )}

      <EuiSpacer size="l" />

      {!isReviewMode && (
        <>
          <MigrationInput
            onSubmit={handleSubmitFeedback}
            isDisabled={isRefining}
            isLoading={isRefining}
          />
          <EuiSpacer size="m" />
        </>
      )}

      <EuiFlexGroup justifyContent="spaceBetween" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiButton
                fill
                isLoading={isApproving}
                isDisabled={isRefining}
                onClick={handleApprove}
                data-test-subj="migrationApproveButton"
              >
                {i18n.translate('xpack.alertingV2.migration.approve', {
                  defaultMessage: 'Approve',
                })}
              </EuiButton>
            </EuiFlexItem>
            {isReviewMode && (
              <EuiFlexItem grow={false}>
                <EuiButton
                  onClick={handleRefineToggle}
                  data-test-subj="migrationRefineButton"
                >
                  {i18n.translate('xpack.alertingV2.migration.refine', {
                    defaultMessage: 'Refine',
                  })}
                </EuiButton>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            color="danger"
            onClick={handleCancel}
            isDisabled={isRefining || isApproving}
            data-test-subj="migrationCancelButton"
          >
            {i18n.translate('xpack.alertingV2.migration.cancel', {
              defaultMessage: 'Cancel',
            })}
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
};
