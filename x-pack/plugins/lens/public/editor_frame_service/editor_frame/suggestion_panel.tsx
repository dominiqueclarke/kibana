/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import './suggestion_panel.scss';

import { camelCase, pick } from 'lodash';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FormattedMessage } from '@kbn/i18n/react';
import {
  EuiIcon,
  EuiTitle,
  EuiPanel,
  EuiIconTip,
  EuiToolTip,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButtonEmpty,
} from '@elastic/eui';
import { IconType } from '@elastic/eui/src/components/icon/icon';
import { Ast, toExpression } from '@kbn/interpreter/common';
import { i18n } from '@kbn/i18n';
import classNames from 'classnames';
import { ExecutionContextSearch } from 'src/plugins/data/public';
import {
  Datasource,
  Visualization,
  FramePublicAPI,
  DatasourcePublicAPI,
  DatasourceMap,
  VisualizationMap,
} from '../../types';
import { getSuggestions, switchToSuggestion } from './suggestion_helpers';
import {
  ReactExpressionRendererProps,
  ReactExpressionRendererType,
} from '../../../../../../src/plugins/expressions/public';
import { prependDatasourceExpression } from './expression_helpers';
import { trackUiEvent, trackSuggestionEvent } from '../../lens_ui_telemetry';
import { getMissingIndexPattern, validateDatasourceAndVisualization } from './state_helpers';
import {
  PreviewState,
  rollbackSuggestion,
  submitSuggestion,
  useLensDispatch,
} from '../../state_management';

const MAX_SUGGESTIONS_DISPLAYED = 5;

export interface SuggestionPanelProps {
  activeDatasourceId: string | null;
  datasourceMap: DatasourceMap;
  datasourceStates: Record<
    string,
    {
      isLoading: boolean;
      state: unknown;
    }
  >;
  activeVisualizationId: string | null;
  visualizationMap: VisualizationMap;
  visualizationState: unknown;
  ExpressionRenderer: ReactExpressionRendererType;
  frame: FramePublicAPI;
  stagedPreview?: PreviewState;
}

const PreviewRenderer = ({
  withLabel,
  ExpressionRendererComponent,
  expression,
  hasError,
}: {
  withLabel: boolean;
  expression: string | null | undefined;
  ExpressionRendererComponent: ReactExpressionRendererType;
  hasError: boolean;
}) => {
  const onErrorMessage = (
    <div className="lnsSuggestionPanel__suggestionIcon">
      <EuiIconTip
        size="xl"
        color="danger"
        type="alert"
        aria-label={i18n.translate('xpack.lens.editorFrame.previewErrorLabel', {
          defaultMessage: 'Preview rendering failed',
        })}
        content={i18n.translate('xpack.lens.editorFrame.previewErrorLabel', {
          defaultMessage: 'Preview rendering failed',
        })}
      />
    </div>
  );
  return (
    <div
      className={classNames('lnsSuggestionPanel__chartWrapper', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'lnsSuggestionPanel__chartWrapper--withLabel': withLabel,
      })}
    >
      {!expression || hasError ? (
        onErrorMessage
      ) : (
        <ExpressionRendererComponent
          className="lnsSuggestionPanel__expressionRenderer"
          padding="s"
          expression={expression}
          debounce={2000}
          renderError={() => {
            return onErrorMessage;
          }}
        />
      )}
    </div>
  );
};

const SuggestionPreview = ({
  preview,
  ExpressionRenderer: ExpressionRendererComponent,
  selected,
  onSelect,
  showTitleAsLabel,
}: {
  onSelect: () => void;
  preview: {
    expression?: Ast | null;
    icon: IconType;
    title: string;
    error?: boolean;
  };
  ExpressionRenderer: ReactExpressionRendererType;
  selected: boolean;
  showTitleAsLabel?: boolean;
}) => {
  return (
    <EuiToolTip content={preview.title}>
      <div data-test-subj={`lnsSuggestion-${camelCase(preview.title)}`}>
        <EuiPanel
          hasBorder
          hasShadow={false}
          className={classNames('lnsSuggestionPanel__button', {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'lnsSuggestionPanel__button-isSelected': selected,
          })}
          paddingSize="none"
          data-test-subj="lnsSuggestion"
          onClick={onSelect}
          aria-current={!!selected}
          aria-label={preview.title}
        >
          {preview.expression || preview.error ? (
            <PreviewRenderer
              ExpressionRendererComponent={ExpressionRendererComponent}
              expression={preview.expression && toExpression(preview.expression)}
              withLabel={Boolean(showTitleAsLabel)}
              hasError={Boolean(preview.error)}
            />
          ) : (
            <span className="lnsSuggestionPanel__suggestionIcon">
              <EuiIcon size="xxl" type={preview.icon} />
            </span>
          )}
          {showTitleAsLabel && (
            <span className="lnsSuggestionPanel__buttonLabel">{preview.title}</span>
          )}
        </EuiPanel>
      </div>
    </EuiToolTip>
  );
};

export function SuggestionPanel({
  activeDatasourceId,
  datasourceMap,
  datasourceStates,
  activeVisualizationId,
  visualizationMap,
  visualizationState,
  frame,
  ExpressionRenderer: ExpressionRendererComponent,
  stagedPreview,
}: SuggestionPanelProps) {
  const dispatchLens = useLensDispatch();

  const currentDatasourceStates = stagedPreview ? stagedPreview.datasourceStates : datasourceStates;
  const currentVisualizationState = stagedPreview
    ? stagedPreview.visualization.state
    : visualizationState;
  const currentVisualizationId = stagedPreview
    ? stagedPreview.visualization.activeId
    : activeVisualizationId;

  const missingIndexPatterns = getMissingIndexPattern(
    activeDatasourceId ? datasourceMap[activeDatasourceId] : null,
    activeDatasourceId ? datasourceStates[activeDatasourceId] : null
  );
  const { suggestions, currentStateExpression, currentStateError } = useMemo(
    () => {
      const newSuggestions = missingIndexPatterns.length
        ? []
        : getSuggestions({
            datasourceMap,
            datasourceStates: currentDatasourceStates,
            visualizationMap,
            activeVisualizationId: currentVisualizationId,
            visualizationState: currentVisualizationState,
            activeData: frame.activeData,
          })
            .filter(
              ({
                hide,
                visualizationId,
                visualizationState: suggestionVisualizationState,
                datasourceState: suggestionDatasourceState,
                datasourceId: suggetionDatasourceId,
              }) => {
                return (
                  !hide &&
                  validateDatasourceAndVisualization(
                    suggetionDatasourceId ? datasourceMap[suggetionDatasourceId] : null,
                    suggestionDatasourceState,
                    visualizationMap[visualizationId],
                    suggestionVisualizationState,
                    frame
                  ) == null
                );
              }
            )
            .slice(0, MAX_SUGGESTIONS_DISPLAYED)
            .map((suggestion) => ({
              ...suggestion,
              previewExpression: preparePreviewExpression(
                suggestion,
                visualizationMap[suggestion.visualizationId],
                datasourceMap,
                currentDatasourceStates,
                frame
              ),
            }));

      const validationErrors = validateDatasourceAndVisualization(
        activeDatasourceId ? datasourceMap[activeDatasourceId] : null,
        activeDatasourceId && currentDatasourceStates[activeDatasourceId]?.state,
        currentVisualizationId ? visualizationMap[currentVisualizationId] : null,
        currentVisualizationState,
        frame
      );

      const newStateExpression =
        currentVisualizationState && currentVisualizationId && !validationErrors
          ? preparePreviewExpression(
              { visualizationState: currentVisualizationState },
              visualizationMap[currentVisualizationId],
              datasourceMap,
              currentDatasourceStates,
              frame
            )
          : undefined;

      return {
        suggestions: newSuggestions,
        currentStateExpression: newStateExpression,
        currentStateError: validationErrors,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentDatasourceStates,
      currentVisualizationState,
      currentVisualizationId,
      activeDatasourceId,
      datasourceMap,
      visualizationMap,
    ]
  );

  const context: ExecutionContextSearch = useMemo(
    () => ({
      query: frame.query,
      timeRange: {
        from: frame.dateRange.fromDate,
        to: frame.dateRange.toDate,
      },
      filters: frame.filters,
    }),
    [frame.query, frame.dateRange.fromDate, frame.dateRange.toDate, frame.filters]
  );

  const contextRef = useRef<ExecutionContextSearch>(context);
  contextRef.current = context;

  const sessionIdRef = useRef<string>(frame.searchSessionId);
  sessionIdRef.current = frame.searchSessionId;

  const AutoRefreshExpressionRenderer = useMemo(() => {
    return (props: ReactExpressionRendererProps) => (
      <ExpressionRendererComponent
        {...props}
        searchContext={contextRef.current}
        searchSessionId={sessionIdRef.current}
      />
    );
  }, [ExpressionRendererComponent]);

  const [lastSelectedSuggestion, setLastSelectedSuggestion] = useState<number>(-1);

  useEffect(() => {
    // if the staged preview is overwritten by a suggestion,
    // reset the selected index to "current visualization" because
    // we are not in transient suggestion state anymore
    if (!stagedPreview && lastSelectedSuggestion !== -1) {
      setLastSelectedSuggestion(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedPreview]);

  if (!activeDatasourceId) {
    return null;
  }

  if (suggestions.length === 0) {
    return null;
  }

  function rollbackToCurrentVisualization() {
    if (lastSelectedSuggestion !== -1) {
      trackSuggestionEvent('back_to_current');
      setLastSelectedSuggestion(-1);
      dispatchLens(rollbackSuggestion());
    }
  }

  return (
    <div className="lnsSuggestionPanel">
      <EuiFlexGroup alignItems="center">
        <EuiFlexItem>
          <EuiTitle className="lnsSuggestionPanel__title" size="xxs">
            <h3>
              <FormattedMessage
                id="xpack.lens.editorFrame.suggestionPanelTitle"
                defaultMessage="Suggestions"
              />
            </h3>
          </EuiTitle>
        </EuiFlexItem>
        {stagedPreview && (
          <EuiFlexItem grow={false}>
            <EuiToolTip
              content={i18n.translate('xpack.lens.suggestion.refreshSuggestionTooltip', {
                defaultMessage: 'Refresh the suggestions based on the selected visualization.',
              })}
            >
              <EuiButtonEmpty
                data-test-subj="lensSubmitSuggestion"
                size="xs"
                iconType="refresh"
                onClick={() => {
                  trackUiEvent('suggestion_confirmed');
                  dispatchLens(submitSuggestion());
                }}
              >
                {i18n.translate('xpack.lens.sugegstion.refreshSuggestionLabel', {
                  defaultMessage: 'Refresh',
                })}
              </EuiButtonEmpty>
            </EuiToolTip>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

      <div className="lnsSuggestionPanel__suggestions">
        {currentVisualizationId && (
          <SuggestionPreview
            preview={{
              error: currentStateError != null,
              expression: currentStateExpression,
              icon:
                visualizationMap[currentVisualizationId].getDescription(currentVisualizationState)
                  .icon || 'empty',
              title: i18n.translate('xpack.lens.suggestions.currentVisLabel', {
                defaultMessage: 'Current visualization',
              }),
            }}
            ExpressionRenderer={AutoRefreshExpressionRenderer}
            onSelect={rollbackToCurrentVisualization}
            selected={lastSelectedSuggestion === -1}
            showTitleAsLabel
          />
        )}
        {suggestions.map((suggestion, index) => {
          return (
            <SuggestionPreview
              preview={{
                expression: suggestion.previewExpression,
                icon: suggestion.previewIcon,
                title: suggestion.title,
              }}
              ExpressionRenderer={AutoRefreshExpressionRenderer}
              key={index}
              onSelect={() => {
                trackUiEvent('suggestion_clicked');
                if (lastSelectedSuggestion === index) {
                  rollbackToCurrentVisualization();
                } else {
                  setLastSelectedSuggestion(index);
                  switchToSuggestion(dispatchLens, suggestion);
                }
              }}
              selected={index === lastSelectedSuggestion}
            />
          );
        })}
      </div>
    </div>
  );
}

interface VisualizableState {
  visualizationState: unknown;
  datasourceState?: unknown;
  datasourceId?: string;
  keptLayerIds?: string[];
}

function getPreviewExpression(
  visualizableState: VisualizableState,
  visualization: Visualization,
  datasources: Record<string, Datasource>,
  frame: FramePublicAPI
) {
  if (!visualization.toPreviewExpression) {
    return null;
  }

  const suggestionFrameApi: FramePublicAPI = {
    ...frame,
    datasourceLayers: { ...frame.datasourceLayers },
  };

  // use current frame api and patch apis for changed datasource layers
  if (
    visualizableState.keptLayerIds &&
    visualizableState.datasourceId &&
    visualizableState.datasourceState
  ) {
    const datasource = datasources[visualizableState.datasourceId];
    const datasourceState = visualizableState.datasourceState;
    const updatedLayerApis: Record<string, DatasourcePublicAPI> = pick(
      frame.datasourceLayers,
      visualizableState.keptLayerIds
    );
    const changedLayers = datasource.getLayers(visualizableState.datasourceState);
    changedLayers.forEach((layerId) => {
      if (updatedLayerApis[layerId]) {
        updatedLayerApis[layerId] = datasource.getPublicAPI({
          layerId,
          state: datasourceState,
        });
      }
    });
  }

  return visualization.toPreviewExpression(
    visualizableState.visualizationState,
    suggestionFrameApi.datasourceLayers
  );
}

function preparePreviewExpression(
  visualizableState: VisualizableState,
  visualization: Visualization,
  datasourceMap: Record<string, Datasource<unknown, unknown>>,
  datasourceStates: Record<string, { isLoading: boolean; state: unknown }>,
  framePublicAPI: FramePublicAPI
) {
  const suggestionDatasourceId = visualizableState.datasourceId;
  const suggestionDatasourceState = visualizableState.datasourceState;

  const expression = getPreviewExpression(
    visualizableState,
    visualization,
    datasourceMap,
    framePublicAPI
  );

  if (!expression) {
    return;
  }

  const expressionWithDatasource = prependDatasourceExpression(
    expression,
    datasourceMap,
    suggestionDatasourceId
      ? {
          ...datasourceStates,
          [suggestionDatasourceId]: {
            isLoading: false,
            state: suggestionDatasourceState,
          },
        }
      : datasourceStates
  );

  return expressionWithDatasource;
}
