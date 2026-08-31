/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * Temporary probe: one-shot ES|QL event fetch (LIMIT 10000) plus Kibana RLE.
 * Remove before GA with the `_reset_resources` route (rna-program#426).
 */

import { Request } from '@kbn/core-di-server';
import type { KibanaRequest, RouteSecurity } from '@kbn/core-http-server';
import { inject, injectable } from 'inversify';
import { ALERTING_V2_API_PRIVILEGES } from '../../lib/security/privileges';
import { SpanPerfService } from '../../lib/span_perf/span_perf_service';
import { AlertingRouteContext } from '../alerting_route_context';
import { BaseAlertingRoute } from '../base_alerting_route';
import {
  SPAN_PERF_ESQL_PATH,
  spanPerfEsqlRequestSchema,
  spanPerfRouteResponse,
  type SpanPerfEsqlRequest,
} from './span_perf_schemas';

@injectable()
export class EsqlSpansRoute extends BaseAlertingRoute {
  static method = 'post' as const;
  static path = SPAN_PERF_ESQL_PATH;
  static security: RouteSecurity = {
    authz: {
      requiredPrivileges: [ALERTING_V2_API_PRIVILEGES.alerts.read],
    },
  };
  static routeOptions = {
    access: 'internal' as const,
    summary: 'Probe episode status spans via one-shot ES|QL + Kibana RLE (temporary)',
  } as const;
  static schemas = {
    request: {
      body: spanPerfEsqlRequestSchema,
    },
    response: spanPerfRouteResponse,
  };

  protected readonly routeName = 'span perf esql';

  constructor(
    @inject(AlertingRouteContext) ctx: AlertingRouteContext,
    @inject(Request)
    private readonly request: KibanaRequest<unknown, unknown, SpanPerfEsqlRequest, 'post'>,
    @inject(SpanPerfService) private readonly spanPerfService: SpanPerfService
  ) {
    super(ctx);
  }

  protected async execute() {
    const { episode_id: episodeId, include_spans: includeSpans } = this.request.body;

    const body = await this.spanPerfService.measureEsql({
      episodeId,
      includeSpans,
    });

    return this.ctx.response.ok({ body });
  }
}
