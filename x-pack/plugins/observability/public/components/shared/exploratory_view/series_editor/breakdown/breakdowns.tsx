/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiSuperSelect } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { useSeriesStorage } from '../../hooks/use_series_storage';
import {
  LABEL_FIELDS_BREAKDOWN,
  USE_BREAK_DOWN_COLUMN,
  RECORDS_FIELD,
  PERCENTILE,
} from '../../configurations/constants';
import { SeriesConfig, SeriesUrl } from '../../types';

interface Props {
  seriesId: number;
  series: SeriesUrl;
  seriesConfig?: SeriesConfig;
}

export function Breakdowns({ seriesConfig, seriesId, series }: Props) {
  const { setSeries } = useSeriesStorage();

  const selectedBreakdown = series.breakdown;
  const NO_BREAKDOWN = 'no_breakdown';

  const onOptionChange = (optionId: string) => {
    if (optionId === NO_BREAKDOWN) {
      setSeries(seriesId, {
        ...series,
        breakdown: undefined,
      });
    } else {
      setSeries(seriesId, {
        ...series,
        breakdown: selectedBreakdown === optionId ? undefined : optionId,
      });
    }
  };

  if (!seriesConfig) {
    return null;
  }

  const hasUseBreakdownColumn = seriesConfig.xAxisColumn.sourceField === USE_BREAK_DOWN_COLUMN;
  const isRecordsMetric = series.selectedMetricField === RECORDS_FIELD;

  const items = seriesConfig.breakdownFields.map((breakdown) => ({
    id: breakdown,
    label: seriesConfig.labels[breakdown],
  }));

  if (!hasUseBreakdownColumn) {
    items.push({
      id: NO_BREAKDOWN,
      label: NO_BREAK_DOWN_LABEL,
    });
  }

  const options = items
    .map(({ id, label }) => ({
      inputDisplay: label,
      value: id,
      dropdownDisplay: label,
    }))
    .filter(({ value }) => !(value === PERCENTILE && isRecordsMetric));

  let valueOfSelected =
    selectedBreakdown || (hasUseBreakdownColumn ? options[0].value : NO_BREAKDOWN);

  if (selectedBreakdown?.startsWith('labels.')) {
    valueOfSelected = LABEL_FIELDS_BREAKDOWN;
  }

  return (
    <EuiSuperSelect
      options={options}
      valueOfSelected={valueOfSelected}
      onChange={(value) => onOptionChange(value)}
      data-test-subj={'seriesBreakdown'}
    />
  );
}

export const NO_BREAK_DOWN_LABEL = i18n.translate(
  'xpack.observability.exp.breakDownFilter.noBreakdown',
  {
    defaultMessage: 'No breakdown',
  }
);
