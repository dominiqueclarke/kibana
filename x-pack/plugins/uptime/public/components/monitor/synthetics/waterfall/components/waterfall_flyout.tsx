/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import React, { useMemo } from 'react';

import styled from 'styled-components';

import {
  EuiAccordion,
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiText,
  EuiTitle,
  EuiBasicTable,
  EuiFlexItem,
  EuiFlexGroup,
  EuiSpacer,
} from '@elastic/eui';
import { MiddleTruncatedText } from '../../waterfall';
import { WaterfallMetaDataEntry } from '../types';

interface Row {
  name: string;
  value?: string;
}

interface Props {
  rows: Row[];
}

interface FlyoutProps {
  isFlyoutVisible: boolean;
  setIsFlyoutVisible: (isFlyoutVisible: boolean) => void;
  data: WaterfallMetaDataEntry;
}

class TableWithoutHeader extends EuiBasicTable {
  renderTableHead() {
    return <></>;
  }
}

export const Table = (props: Props) => {
  const { rows } = props;
  const columns = useMemo(
    () => [
      {
        field: 'name',
        name: '',
        sortable: false,
        render: (name: string, item: Row) => (
          <EuiText size="xs">
            <strong>{item.name}</strong>
          </EuiText>
        ),
      },
      {
        field: 'value',
        name: '',
        sortable: false,
        render: (_name: string, item: Row) => {
          return (
            <span>
              <EuiFlexGroup gutterSize={'xs'} alignItems={'center'} responsive={false}>
                <EuiFlexItem>{item.value}</EuiFlexItem>
              </EuiFlexGroup>
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <TableWithoutHeader
      tableLayout={'fixed'}
      compressed
      responsive={false}
      columns={columns}
      items={rows}
    />
  );
};

const FlyoutContainer = styled(EuiFlyout)`
  z-index: ${(props) => props.theme.eui.euiZLevel5};
`;

export const WaterfallFlyout = ({ setIsFlyoutVisible, isFlyoutVisible, data }: FlyoutProps) => {
  const { url, config, requestHeaders, responseHeaders } = data;
  /* Grab static items off the first data point */
  return isFlyoutVisible ? (
    <FlyoutContainer
      size="s"
      onClose={() => setIsFlyoutVisible(false)}
      aria-labelledby="flyoutTitle"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="m">
          <h2 id="flyoutTitle">
            <MiddleTruncatedText text={url} />
          </h2>
        </EuiTitle>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <Table rows={config} />
        <EuiSpacer size="l" />
        {!!requestHeaders && (
          <EuiAccordion id="accordion1" buttonContent="Request Headers">
            <EuiSpacer size="m" />
            <Table rows={requestHeaders} />
          </EuiAccordion>
        )}
        <EuiSpacer size="l" />
        {!!responseHeaders && (
          <EuiAccordion id="accordion2" buttonContent="Response Headers">
            <EuiSpacer size="m" />
            <Table rows={responseHeaders} />
          </EuiAccordion>
        )}
      </EuiFlyoutBody>
    </FlyoutContainer>
  ) : null;
};
