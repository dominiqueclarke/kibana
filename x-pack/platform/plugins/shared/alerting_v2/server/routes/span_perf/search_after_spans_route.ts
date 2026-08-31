/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * Temporary probe: page `.rule-events` with Query DSL `search_after` and
 * derive status spans in Kibana. Remove before GA with the `_reset_resources`
 * route (rna-program#426).
 */

import { Request } from '@kbn/core-di-server';
import type { KibanaRequest, RouteSecurity } from '@kbn/core-http-server';
import { inject, injectable } from 'inversify';
import { ALERTING_V2_API_PRIVILEGES } from '../../lib/security/privileges';
import { SpanPerfService } from '../../lib/span_perf/span_perf_service';
import { AlertingRouteContext } from '../alerting_route_context';
import { BaseAlertingRoute } from '../base_alerting_route';
import {
  SPAN_PERF_SEARCH_AFTER_PATH,
  spanPerfRouteResponse,
  spanPerfSearchAfterRequestSchema,
  type SpanPerfSearchAfterRequest,
} from './span_perf_schemas';

@injectable()
export class SearchAfterSpansRoute extends BaseAlertingRoute {
  static method = 'post' as const;
  static path = SPAN_PERF_SEARCH_AFTER_PATH;
  static security: RouteSecurity = {
    authz: {
      requiredPrivileges: [ALERTING_V2_API_PRIVILEGES.alerts.read],
    },
  };
  static routeOptions = {
    access: 'internal' as const,
    summary: 'Probe episode status spans via search_after (temporary)',
  } as const;
  static schemas = {
    request: {
      body: spanPerfSearchAfterRequestSchema,
    },
    response: spanPerfRouteResponse,
  };

  protected readonly routeName = 'span perf search_after';

  constructor(
    @inject(AlertingRouteContext) ctx: AlertingRouteContext,
    @inject(Request)
    private readonly request: KibanaRequest<unknown, unknown, SpanPerfSearchAfterRequest, 'post'>,
    @inject(SpanPerfService) private readonly spanPerfService: SpanPerfService
  ) {
    super(ctx);
  }

  protected async execute() {
    const {
      episode_id: episodeId,
      page_size: pageSize,
      max_events: maxEvents,
      include_spans: includeSpans,
    } = this.request.body;

    const body = await this.spanPerfService.measureSearchAfter({
      episodeId,
      pageSize,
      maxEvents,
      includeSpans,
    });

    return this.ctx.response.ok({ body });
  }
}
