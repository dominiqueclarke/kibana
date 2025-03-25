/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { memo, useCallback } from 'react';
import { EuiToolTip, EuiButtonIcon } from '@elastic/eui';
import copy from 'copy-to-clipboard';

import * as i18n from './translations';
import { useCaseViewNavigation } from '../../common/navigation';

interface UserActionCopyLinkProps {
  id: string;
  caseId: string;
}

const UserActionCopyLinkComponent = ({ id: commentId, caseId }: UserActionCopyLinkProps) => {
  const { getCaseViewUrl } = useCaseViewNavigation();

  const handleAnchorLink = useCallback(() => {
    copy(getCaseViewUrl({ detailName: caseId, commentId }, true));
  }, [caseId, commentId, getCaseViewUrl]);

  return (
    <EuiToolTip position="top" content={<p>{i18n.COPY_REFERENCE_LINK}</p>}>
      <EuiButtonIcon
        aria-label={i18n.COPY_REFERENCE_LINK}
        data-test-subj={`copy-link-${commentId}`}
        onClick={handleAnchorLink}
        iconType="link"
        id={`${commentId}-permLink`}
      />
    </EuiToolTip>
  );
};
UserActionCopyLinkComponent.displayName = 'UserActionCopyLink';

export const UserActionCopyLink = memo(UserActionCopyLinkComponent);
