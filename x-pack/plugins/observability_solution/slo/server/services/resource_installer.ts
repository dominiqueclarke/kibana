/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  ClusterPutComponentTemplateRequest,
  IndicesPutIndexTemplateRequest,
  IlmPutLifecycleRequest,
  IndicesCreateRequest,
} from '@elastic/elasticsearch/lib/api/types';
import type { ElasticsearchClient, Logger } from '@kbn/core/server';
import { getSLOMappingsTemplate } from '../assets/component_templates/slo_mappings_template';
import { getSLOSettingsTemplate } from '../assets/component_templates/slo_settings_template';
import { getSLOSummaryMappingsTemplate } from '../assets/component_templates/slo_summary_mappings_template';
import { getSLOSummarySettingsTemplate } from '../assets/component_templates/slo_summary_settings_template';
import { getSLOIndexLifecyclePolicy } from '../assets/ilm_policies/slo_ilm_policy';
import {
  SLO_COMPONENT_TEMPLATE_MAPPINGS_NAME,
  SLO_COMPONENT_TEMPLATE_SETTINGS_NAME,
  SLO_DESTINATION_INDEX_NAME,
  SLO_DESTINATION_INITIAL_ROLLOVER_INDEX_NAME,
  SLO_INDEX_TEMPLATE_NAME,
  SLO_INDEX_TEMPLATE_PATTERN,
  SLO_SUMMARY_COMPONENT_TEMPLATE_MAPPINGS_NAME,
  SLO_SUMMARY_COMPONENT_TEMPLATE_SETTINGS_NAME,
  SLO_SUMMARY_DESTINATION_INDEX_NAME,
  SLO_SUMMARY_INDEX_TEMPLATE_NAME,
  SLO_SUMMARY_INDEX_TEMPLATE_PATTERN,
  SLO_SUMMARY_TEMP_INDEX_NAME,
  SLO_LIFECYCLE_POLICY_NAME,
} from '../../common/constants';
import { getSLOIndexTemplate } from '../assets/index_templates/slo_index_templates';
import { getSLOSummaryIndexTemplate } from '../assets/index_templates/slo_summary_index_templates';

import { retryTransientEsErrors } from '../utils/retry';

export interface ResourceInstaller {
  ensureCommonResourcesInstalled(): Promise<void>;
}

export class DefaultResourceInstaller implements ResourceInstaller {
  constructor(private esClient: ElasticsearchClient, private logger: Logger) {}

  public async ensureCommonResourcesInstalled(): Promise<void> {
    try {
      this.logger.info('Installing SLO shared resources');

      await this.createOrUpdateLifecyclePolicy(
        getSLOIndexLifecyclePolicy(SLO_LIFECYCLE_POLICY_NAME)
      );

      await await Promise.all([
        this.createOrUpdateComponentTemplate(
          getSLOMappingsTemplate(SLO_COMPONENT_TEMPLATE_MAPPINGS_NAME)
        ),
        this.createOrUpdateComponentTemplate(
          getSLOSettingsTemplate({
            name: SLO_COMPONENT_TEMPLATE_SETTINGS_NAME,
            lifecyclePolicyName: SLO_LIFECYCLE_POLICY_NAME,
          })
        ),
        this.createOrUpdateComponentTemplate(
          getSLOSummaryMappingsTemplate(SLO_SUMMARY_COMPONENT_TEMPLATE_MAPPINGS_NAME)
        ),
        this.createOrUpdateComponentTemplate(
          getSLOSummarySettingsTemplate(SLO_SUMMARY_COMPONENT_TEMPLATE_SETTINGS_NAME)
        ),
      ]);

      await this.createOrUpdateIndexTemplate(
        getSLOIndexTemplate(SLO_INDEX_TEMPLATE_NAME, SLO_INDEX_TEMPLATE_PATTERN, [
          SLO_COMPONENT_TEMPLATE_MAPPINGS_NAME,
          SLO_COMPONENT_TEMPLATE_SETTINGS_NAME,
        ])
      );

      await this.createOrUpdateIndexTemplate(
        getSLOSummaryIndexTemplate(
          SLO_SUMMARY_INDEX_TEMPLATE_NAME,
          SLO_SUMMARY_INDEX_TEMPLATE_PATTERN,
          [
            SLO_SUMMARY_COMPONENT_TEMPLATE_MAPPINGS_NAME,
            SLO_SUMMARY_COMPONENT_TEMPLATE_SETTINGS_NAME,
          ]
        )
      );

      await this.createIndices();
    } catch (err) {
      this.logger.error(`Error installing resources shared for SLO: ${err.message}`);
      throw err;
    }
  }

  private async doesIndexExist(indexName: string) {
    let indexExists = false;
    try {
      indexExists = await retryTransientEsErrors(
        () => this.esClient.indices.exists({ index: indexName, expand_wildcards: 'all' }),
        {
          logger: this.logger,
        }
      );
    } catch (error) {
      if (error?.statusCode !== 404) {
        this.logger.error(`Error fetching index for ${indexName} - ${error.message}`);
        throw error;
      }
    }

    return indexExists;
  }

  async createIndex({ index, aliases }: IndicesCreateRequest) {
    this.logger.debug(`Checking existence of index - ${index}`);

    // check if index exists
    const indexExists = await this.doesIndexExist(index);
    // return if index already created
    if (indexExists) {
      return;
    }

    this.logger.info(`Creating index - ${index}`);
    try {
      await retryTransientEsErrors(() => this.esClient.indices.create({ index, aliases }), {
        logger: this.logger,
      });
    } catch (error) {
      if (error?.meta?.body?.error?.type !== 'resource_already_exists_exception') {
        this.logger.error(`Error creating index ${index} - ${error.message}`);
        throw error;
      }
    }
  }

  async createIndices() {
    await Promise.all([
      this.createIndex({
        index: SLO_DESTINATION_INITIAL_ROLLOVER_INDEX_NAME,
        aliases: {
          [SLO_DESTINATION_INDEX_NAME]: {
            is_write_index: true,
          },
        },
      }),
      this.createIndex({ index: SLO_SUMMARY_DESTINATION_INDEX_NAME }),
      this.createIndex({ index: SLO_SUMMARY_TEMP_INDEX_NAME }),
    ]);
  }

  async deleteIndex(indexName: string) {
    const indexExists = this.doesIndexExist(indexName);
    if (!indexExists) {
      return;
    }
    return retryTransientEsErrors(() => this.esClient.indices.delete({ index: indexName }));
  }

  async deleteIndices() {
    await Promise.all([
      this.deleteIndex(SLO_SUMMARY_DESTINATION_INDEX_NAME),
      this.deleteIndex(SLO_DESTINATION_INDEX_NAME),
    ]);
  }

  private async createOrUpdateComponentTemplate(template: ClusterPutComponentTemplateRequest) {
    const currentVersion = await fetchComponentTemplateVersion(
      template.name,
      this.logger,
      this.esClient
    );
    if (template._meta?.version && currentVersion === template._meta.version) {
      this.logger.info(`SLO component template found with version [${template._meta.version}]`);
    } else {
      this.logger.info(`Installing SLO component template [${template.name}]`);
      return this.execute(() => this.esClient.cluster.putComponentTemplate(template));
    }
  }

  private async createOrUpdateLifecyclePolicy(request: IlmPutLifecycleRequest) {
    const currentVersion = await fetchILMPolicyVersion(request.name, this.logger, this.esClient);
    if (request.policy?._meta?.version && currentVersion === request.policy?._meta.version) {
      this.logger.info(`SLO lifecycle policy found with version [${request.policy._meta.version}]`);
    } else {
      this.logger.info(`Installing SLO lifecycle policy [${request.name}]`);
      return this.execute(() => this.esClient.ilm.putLifecycle(request));
    }
  }

  private async createOrUpdateIndexTemplate(template: IndicesPutIndexTemplateRequest) {
    const currentVersion = await fetchIndexTemplateVersion(
      template.name,
      this.logger,
      this.esClient
    );

    if (template._meta?.version && currentVersion === template._meta.version) {
      this.logger.info(`SLO index template found with version [${template._meta.version}]`);
    } else {
      this.logger.info(`Installing SLO index template [${template.name}]`);
      return this.execute(() => this.esClient.indices.putIndexTemplate(template));
    }
  }

  private async execute<T>(esCall: () => Promise<T>): Promise<T> {
    return await retryTransientEsErrors(esCall, { logger: this.logger });
  }
}

async function fetchComponentTemplateVersion(
  name: string,
  logger: Logger,
  esClient: ElasticsearchClient
) {
  const getTemplateRes = await retryTransientEsErrors(
    () =>
      esClient.cluster.getComponentTemplate(
        {
          name,
        },
        {
          ignore: [404],
        }
      ),
    { logger }
  );

  return getTemplateRes?.component_templates?.[0]?.component_template?._meta?.version || null;
}

async function fetchILMPolicyVersion(name: string, logger: Logger, esClient: ElasticsearchClient) {
  const getPolicyRes = await retryTransientEsErrors(
    () =>
      esClient.ilm.getLifecycle(
        {
          name,
        },
        {
          ignore: [404],
        }
      ),
    { logger }
  );

  return getPolicyRes?.[name]?.policy?._meta?.version || null;
}

async function fetchIndexTemplateVersion(
  name: string,
  logger: Logger,
  esClient: ElasticsearchClient
) {
  const getTemplateRes = await retryTransientEsErrors(
    () =>
      esClient.indices.getIndexTemplate(
        {
          name,
        },
        {
          ignore: [404],
        }
      ),
    { logger }
  );

  return getTemplateRes?.index_templates?.[0]?.index_template?._meta?.version || null;
}
