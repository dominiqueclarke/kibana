/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiSpacer, EuiTitle } from '@elastic/eui';
import { AttachedAlerts } from './attached_alerts';
import { AttachedDashboards } from './attached_dashboards';
import { SuggestedAttachments } from './suggested_attachments';
import type { CaseUI } from '../../../common';

interface AttachmentsProps {
  caseData: CaseUI;
}

export const Attachments: React.FC<AttachmentsProps> = ({ caseData }: AttachmentsProps) => {
  return (
    <>
      <SuggestedAttachments caseData={caseData} />
      <EuiSpacer size="s" />
      <EuiTitle size="s">
        <h3>{'Case Attachments'}</h3>
      </EuiTitle>
      <EuiSpacer size="s" />
      <AttachedAlerts caseData={caseData} />
      <EuiSpacer size="s" />
      <AttachedDashboards />
    </>
  );
};

Attachments.displayName = 'AttachmentsProps';
