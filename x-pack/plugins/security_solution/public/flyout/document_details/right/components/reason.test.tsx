/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { __IntlProvider as IntlProvider } from '@kbn/i18n-react';
import { REASON_DETAILS_PREVIEW_BUTTON_TEST_ID, REASON_TITLE_TEST_ID } from './test_ids';
import { Reason, ALERT_REASON_BANNER } from './reason';
import { DocumentDetailsContext } from '../../shared/context';
import { mockGetFieldsData } from '../../shared/mocks/mock_get_fields_data';
import { mockDataFormattedForFieldBrowser } from '../../shared/mocks/mock_data_formatted_for_field_browser';
import { DocumentDetailsAlertReasonPanelKey } from '../../shared/constants/panel_keys';
import { TestProviders } from '../../../../common/mock';
import { type ExpandableFlyoutApi, useExpandableFlyoutApi } from '@kbn/expandable-flyout';
import { createTelemetryServiceMock } from '../../../../common/lib/telemetry/telemetry_service.mock';

const flyoutContextValue = {
  openPreviewPanel: jest.fn(),
} as unknown as ExpandableFlyoutApi;

const mockedTelemetry = createTelemetryServiceMock();
jest.mock('../../../../common/lib/kibana', () => {
  return {
    useKibana: () => ({
      services: {
        telemetry: mockedTelemetry,
      },
    }),
  };
});

jest.mock('@kbn/expandable-flyout', () => ({
  useExpandableFlyoutApi: jest.fn(),
  ExpandableFlyoutProvider: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>,
}));

const panelContextValue = {
  eventId: 'event id',
  indexName: 'indexName',
  scopeId: 'scopeId',
  dataFormattedForFieldBrowser: mockDataFormattedForFieldBrowser,
  getFieldsData: mockGetFieldsData,
} as unknown as DocumentDetailsContext;

const renderReason = (panelContext: DocumentDetailsContext = panelContextValue) =>
  render(
    <TestProviders>
      <IntlProvider locale="en">
        <DocumentDetailsContext.Provider value={panelContext}>
          <Reason />
        </DocumentDetailsContext.Provider>
      </IntlProvider>
    </TestProviders>
  );

const NO_DATA_MESSAGE = "There's no source event information for this alert.";

describe('<Reason />', () => {
  beforeAll(() => {
    jest.mocked(useExpandableFlyoutApi).mockReturnValue(flyoutContextValue);
  });

  it('should render the component for alert', () => {
    const { getByTestId } = renderReason();
    expect(getByTestId(REASON_TITLE_TEST_ID)).toBeInTheDocument();
    expect(getByTestId(REASON_TITLE_TEST_ID)).toHaveTextContent('Alert reason');
    expect(getByTestId(REASON_DETAILS_PREVIEW_BUTTON_TEST_ID)).toBeInTheDocument();
    expect(getByTestId(REASON_DETAILS_PREVIEW_BUTTON_TEST_ID)).toHaveTextContent(
      'Show full reason'
    );
  });

  it('should render the component for document', () => {
    const dataFormattedForFieldBrowser = mockDataFormattedForFieldBrowser.filter(
      (d) => d.field !== 'kibana.alert.rule.uuid'
    );
    const panelContext = {
      ...panelContextValue,
      dataFormattedForFieldBrowser,
    };
    const { getByTestId } = renderReason(panelContext);
    expect(getByTestId(REASON_TITLE_TEST_ID)).toBeInTheDocument();
    expect(getByTestId(REASON_TITLE_TEST_ID)).toHaveTextContent('Document reason');
  });

  it('should render no reason if the field is null', () => {
    const panelContext = {
      ...panelContextValue,
      getFieldsData: () => {},
    } as unknown as DocumentDetailsContext;

    const { getByText } = renderReason(panelContext);

    expect(getByText(NO_DATA_MESSAGE)).toBeInTheDocument();
  });

  it('should open preview panel when clicking on button', () => {
    const { getByTestId } = renderReason();

    getByTestId(REASON_DETAILS_PREVIEW_BUTTON_TEST_ID).click();

    expect(flyoutContextValue.openPreviewPanel).toHaveBeenCalledWith({
      id: DocumentDetailsAlertReasonPanelKey,
      params: {
        id: panelContextValue.eventId,
        indexName: panelContextValue.indexName,
        scopeId: panelContextValue.scopeId,
        banner: ALERT_REASON_BANNER,
      },
    });
  });
});
