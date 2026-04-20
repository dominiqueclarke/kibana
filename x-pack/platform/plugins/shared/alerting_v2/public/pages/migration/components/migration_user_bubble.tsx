/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiPanel, EuiText, useEuiTheme, euiTextBreakWord } from '@elastic/eui';
import { css } from '@emotion/react';

const ROUNDED_BORDER_RADIUS = '16px';

interface MigrationUserBubbleProps {
  text: string;
}

export const MigrationUserBubble: React.FC<MigrationUserBubbleProps> = ({ text }) => {
  const { euiTheme } = useEuiTheme();

  const bubbleStyles = css`
    align-self: flex-end;
    max-inline-size: 90%;
    background: ${euiTheme.colors.backgroundLightPrimary};
    ${euiTextBreakWord()}
    white-space: pre-wrap;
    border-radius: ${ROUNDED_BORDER_RADIUS} ${ROUNDED_BORDER_RADIUS} 0 ${ROUNDED_BORDER_RADIUS};
  `;

  return (
    <EuiPanel css={bubbleStyles} paddingSize="m" hasShadow={false} hasBorder={false}>
      <EuiText size="s">{text}</EuiText>
    </EuiPanel>
  );
};
