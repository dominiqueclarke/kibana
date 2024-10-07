/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import dedent from 'dedent';
import { i18n } from '@kbn/i18n';
import { EntityWithSource, LogPattern, Investigation } from '@kbn/investigation-shared';
import React, { useCallback } from 'react';
import { useKibana } from '../../../../hooks/use_kibana';
import { useInvestigation } from '../../contexts/investigation_context';
import { useFetchEntities } from '../../../../hooks/use_fetch_entities';
import { useFetchLogPatterns } from '../../../../hooks/use_fetch_log_patterns';
import { getScreenContext } from '../../../../hooks/use_screen_context';
export interface InvestigationContextualInsight {
  key: string;
  description: string;
  data: unknown;
}

export function AssistantHypothesis({
  investigation,
  start,
  end,
}: {
  investigation: Investigation;
  start: string;
  end: string;
}) {
  const { alert } = useInvestigation();
  const {
    dependencies: {
      start: {
        observabilityAIAssistant: {
          ObservabilityAIAssistantContextualInsight,
          getContextualInsightMessages,
        },
      },
    },
  } = useKibana();
  const serviceName = alert?.['service.name'] ? `${alert?.['service.name']}` : undefined;
  const serviceEnvironment = alert?.['service.environment']
    ? `${alert?.['service.environment']}`
    : undefined;
  const hostName = alert?.['host.name'] ? `${alert?.['host.name']}` : undefined;
  const containerId = alert?.['container.id'] ? `${alert?.['container.id']}` : undefined;
  const { data: entitiesData } = useFetchEntities({
    investigationId: investigation.id,
    serviceName,
    serviceEnvironment,
    hostName,
    containerId,
  });
  const { data: logPatternsData } = useFetchLogPatterns({
    investigationId: investigation.id,
    sources:
      entitiesData?.entities.map((entity) => ({
        index: entity.sources.map((source) => source.dataStream).join(','),
        serviceName,
        serviceEnvironment,
        containerId,
        hostName,
      })) ?? [],
    start,
    end,
  });

  const getInvestigationContextMessages = useCallback(async () => {
    if (!getContextualInsightMessages || !alert || !investigation) {
      return [];
    }

    const entities = entitiesData?.entities ?? [];
    const logPatterns = logPatternsData?.logPatterns ?? [];
    const instructions = dedent(`
      ${getScreenContext({ alert, investigation })}
      
## Current task:
${getLogPatternContext(logPatterns)}
      
## Additional information:
${getEntityContext(entities)}

## Additional requests:
I do not have the alert details or entity details in front of me. Always include the alert reason and the entity metrics in your response. 

## Formatting
The entity metrics should be listed in a table format.
When referencing the log patterns or services, please include the name of the log pattern or service in a code block.
   `);

    return getContextualInsightMessages({
      message: `I am investigating a failure in my system. I was made aware of the failure by an alert and I am trying to understand the root cause of the issue.`,
      instructions,
    });
  }, [
    alert,
    getContextualInsightMessages,
    entitiesData?.entities,
    logPatternsData?.logPatterns,
    investigation,
  ]);

  if (!ObservabilityAIAssistantContextualInsight) {
    return null;
  }

  return alert && entitiesData && logPatternsData ? (
    <ObservabilityAIAssistantContextualInsight
      title={i18n.translate(
        'xpack.investigateApp.assistantHypothesis.observabilityAIAssistantContextualInsight.helpMeInvestigateThisLabel',
        { defaultMessage: 'Help me investigate this failure' }
      )}
      messages={getInvestigationContextMessages}
    />
  ) : null;
}

const formatEntityMetrics = (entity: EntityWithSource): string => {
  const entityMetrics = Object.entries(entity.metrics)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  const entitySources = entity.sources.map((source) => source.dataStream).join(', ');
  return dedent(`
    Entity name: ${entity.displayName}; 
    Entity type: ${entity.type}; 
    Entity metrics: ${entityMetrics}; 
    Entity data streams: ${entitySources}
  `);
};

const formatLogPatterns = (logPattern: Record<string, string>): string => {
  return dedent(`
    ### Log pattern: ${logPattern.terms}
    Change type: ${logPattern?.change?.type}; 
    Change time: ${logPattern?.change?.timestamp}; 
    Change correlation coefficient: ${logPattern?.change?.correlationCoefficient};
    Document count: ${logPattern?.documentCount};
  `);
};

const getLogPatternContext = (logPatterns: LogPattern[]): string => {
  return logPatterns?.length
    ? dedent(`
  I found the following new patterns in the logs. Can you correlate these patterns across the stack, explain the relationships and narrow down the root cause based on the evidence? Please include an evidence-based hypothesis for what's causing the outage and list the most critical patterns first.

  Below is the list of the log patterns I detected across the stack. Feel free to exclude irrelevant messages that do not indicate a problem.
        
  ${logPatterns
    .map((logPattern, index) => {
      return dedent(`
        ## Log Patterns for ${logPattern.index}:
        ${logPattern.impactingPatterns.map((pattern) => formatLogPatterns(pattern)).join('\n\n')};
      `);
    })
    .join('\n\n')}`)
    : '';
};

const getEntityContext = (entities: EntityWithSource[]): string => {
  const entityContext = entities?.length
    ? `
  Alerts can optionally be associated with entities. Entities can be services, hosts, containers, or other resources. Entities can have metrics associated with them. 

  When displaying the entity metrics, please convert the metrics to a human-readable format. For example, convert "logRate" to "Log Rate" and "errorRate" to "Error Rate".
  
  The alert that triggered this investigation is associated with the following entities: 
  
  ${entities
    .map((entity, index) => {
      return dedent(`
        ## Entity ${index + 1}:
        ${formatEntityMetrics(entity)};
      `);
    })
    .join('/n/n')}`
    : '';

  return entityContext;
};
