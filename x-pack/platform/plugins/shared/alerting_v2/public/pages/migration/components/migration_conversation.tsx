/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useRef } from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiSpacer } from '@elastic/eui';
import { css } from '@emotion/react';
import type { MigrationRound } from '../types';
import { MigrationProposalPanel } from './migration_proposal_panel';
import { MigrationUserBubble } from './migration_user_bubble';

const scrollContainerStyles = css`
  flex-grow: 1;
  overflow-y: auto;
  padding-bottom: 16px;
`;

interface MigrationConversationProps {
  rounds: MigrationRound[];
  v1Rule: Record<string, unknown>;
  isRefining: boolean;
}

export const MigrationConversation: React.FC<MigrationConversationProps> = ({
  rounds,
  v1Rule,
  isRefining,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rounds.length, isRefining]);

  return (
    <EuiFlexGroup direction="column" gutterSize="m" css={scrollContainerStyles}>
      {rounds.map((round, index) => (
        <React.Fragment key={index}>
          {round.userFeedback && (
            <EuiFlexItem grow={false}>
              <MigrationUserBubble text={round.userFeedback} />
            </EuiFlexItem>
          )}
          <EuiFlexItem grow={false}>
            <MigrationProposalPanel
              proposal={round.proposal}
              notes={round.notes}
              v1Rule={index === 0 ? v1Rule : undefined}
              isRefinement={round.type === 'refinement'}
            />
          </EuiFlexItem>
        </React.Fragment>
      ))}

      {isRefining && (
        <EuiFlexItem grow={false}>
          <MigrationProposalPanel
            proposal={{}}
            notes=""
            isLoading
            isRefinement
          />
        </EuiFlexItem>
      )}

      <div ref={bottomRef} />
      <EuiSpacer size="l" />
    </EuiFlexGroup>
  );
};
