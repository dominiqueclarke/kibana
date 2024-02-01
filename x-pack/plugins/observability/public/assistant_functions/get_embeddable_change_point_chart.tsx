/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import {
  RegisterRenderFunctionDefinition,
  RenderFunction,
} from '@kbn/observability-ai-assistant-plugin/public/types';
import React, { useEffect, useState, useRef } from 'react';
import { DataView } from '@kbn/data-views-plugin/common';
import { useKibana } from '../utils/kibana_react';

import type {
  GetSLOChangePointArguments,
  GetSLOChangePointFunctionResponse,
} from '../../server/assistant_functions/get_slo_change_point';
import { ObservabilityPublicPluginsStart } from '../plugin';

const fnList = ['avg', 'sum', 'min', 'max'];

interface SLOChangePointChart {
  metricField: string;
  fn?: 'avg' | 'min' | 'max' | 'sum';
  dataView?: DataView;
  from?: string;
  to?: string;
}

// eslint-disable-next-line import/no-default-export
export default function SLOChangePointChart({
  metricField,
  from = 'now-24h',
  to = 'now',
  dataView,
  fn = 'avg',
}: SLOChangePointChart) {
  const [embeddable, setEmbeddable] = useState<any>();
  const { embeddable: embeddablePlugin } = useKibana<ObservabilityPublicPluginsStart>().services;
  const embeddableRoot: React.RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function setupEmbeddable() {
      const factory = embeddablePlugin?.getEmbeddableFactory('aiopsChangePointChart');
      const input = {
        id: 'sloChangePointDetectionChart',
        dataViewId: dataView.id,
        timeRange: {
          from,
          to,
        },
        fn,
        metricField,
      };

      const embeddableObject = await factory?.create(input);

      setEmbeddable(embeddableObject);
    }

    setupEmbeddable();
    // Set up exactly once after the component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // We can only render after embeddable has already initialized
  useEffect(() => {
    if (embeddableRoot.current && embeddable) {
      embeddable.render(embeddableRoot.current);
    }
  }, [embeddable, embeddableRoot]);

  return <div data-test-subj="changePointDetectionEmbeddable" ref={embeddableRoot} />;
}

export function registerSLOChangePointChartFunction({
  registerRenderFunction,
}: {
  registerRenderFunction: RegisterRenderFunctionDefinition;
}) {
  registerRenderFunction('get_slo_change_point', (parameters) => {
    const {
      response: { content, data },
    } = parameters as Parameters<
      RenderFunction<GetSLOChangePointArguments, GetSLOChangePointFunctionResponse>
    >[0];

    const nonStationaryMetrics = content.changes
      .filter((change) => !Object.keys(change.typeOfChange).includes('stationary'))
      .map((change) => change.fieldName);

    return nonStationaryMetrics.length ? (
      <div>
        {nonStationaryMetrics.map((metric, index) => {
          return (
            <SLOChangePointChart
              key={`${metric}${index}`}
              dataView={data.dataView}
              from={content.observedPeriodStart}
              to={content.observedPeriodEnd}
              metricField={metric}
              fn={content.metricOperation}
            />
          );
        })}
      </div>
    ) : null;
  });
}

// TODO: render an error when data view is adhoc, link to where you can create a dataview
