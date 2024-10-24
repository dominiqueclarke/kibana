/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import Boom from '@hapi/boom';
import { ROUTE_TAG_CAN_REDIRECT } from '../../../security/server';
import { ReportingCore } from '../';
import { API_BASE_URL } from '../../common/constants';
import { authorizedUserPreRoutingFactory } from './lib/authorized_user_pre_routing';
import { jobsQueryFactory } from './lib/jobs_query';
import {
  deleteJobResponseHandlerFactory,
  downloadJobResponseHandlerFactory,
} from './lib/job_response_handler';

const MAIN_ENTRY = `${API_BASE_URL}/jobs`;

const handleUnavailable = (res: any) => {
  return res.custom({ statusCode: 503, body: 'Not Available' });
};

export function registerJobInfoRoutes(reporting: ReportingCore) {
  const setupDeps = reporting.getPluginSetupDeps();
  const userHandler = authorizedUserPreRoutingFactory(reporting);
  const { router } = setupDeps;

  // list jobs in the queue, paginated
  router.get(
    {
      path: `${MAIN_ENTRY}/list`,
      validate: {
        query: schema.object({
          page: schema.string({ defaultValue: '0' }),
          size: schema.string({ defaultValue: '10' }),
          ids: schema.maybe(schema.string()),
        }),
      },
    },
    userHandler(async (user, context, req, res) => {
      // ensure the async dependencies are loaded
      if (!context.reporting) {
        return handleUnavailable(res);
      }

      const {
        management: { jobTypes = [] },
      } = await reporting.getLicenseInfo();
      const { page: queryPage = '0', size: querySize = '10', ids: queryIds = null } = req.query;
      const page = parseInt(queryPage, 10) || 0;
      const size = Math.min(100, parseInt(querySize, 10) || 10);
      const jobIds = queryIds ? queryIds.split(',') : null;
      const jobsQuery = jobsQueryFactory(reporting);
      const results = await jobsQuery.list(jobTypes, user, page, size, jobIds);

      return res.ok({
        body: results,
        headers: {
          'content-type': 'application/json',
        },
      });
    })
  );

  // return the count of all jobs in the queue
  router.get(
    {
      path: `${MAIN_ENTRY}/count`,
      validate: false,
    },
    userHandler(async (user, context, _req, res) => {
      // ensure the async dependencies are loaded
      if (!context.reporting) {
        return handleUnavailable(res);
      }

      const {
        management: { jobTypes = [] },
      } = await reporting.getLicenseInfo();

      const jobsQuery = jobsQueryFactory(reporting);
      const count = await jobsQuery.count(jobTypes, user);

      return res.ok({
        body: count.toString(),
        headers: {
          'content-type': 'text/plain',
        },
      });
    })
  );

  // return some info about the job
  router.get(
    {
      path: `${MAIN_ENTRY}/info/{docId}`,
      validate: {
        params: schema.object({
          docId: schema.string({ minLength: 2 }),
        }),
      },
    },
    userHandler(async (user, context, req, res) => {
      // ensure the async dependencies are loaded
      if (!context.reporting) {
        return res.custom({ statusCode: 503 });
      }

      const { docId } = req.params;
      const {
        management: { jobTypes = [] },
      } = await reporting.getLicenseInfo();

      const jobsQuery = jobsQueryFactory(reporting);
      const result = await jobsQuery.get(user, docId);

      if (!result) {
        throw Boom.notFound();
      }

      const { jobtype: jobType } = result;

      if (!jobTypes.includes(jobType)) {
        throw Boom.unauthorized(`Sorry, you are not authorized to view ${jobType} info`);
      }

      return res.ok({
        body: result,
        headers: {
          'content-type': 'application/json',
        },
      });
    })
  );

  // trigger a download of the output from a job
  const downloadResponseHandler = downloadJobResponseHandlerFactory(reporting);

  router.get(
    {
      path: `${MAIN_ENTRY}/download/{docId}`,
      validate: {
        params: schema.object({
          docId: schema.string({ minLength: 3 }),
        }),
      },
      options: { tags: [ROUTE_TAG_CAN_REDIRECT] },
    },
    userHandler(async (user, context, req, res) => {
      // ensure the async dependencies are loaded
      if (!context.reporting) {
        return handleUnavailable(res);
      }

      const { docId } = req.params;
      const {
        management: { jobTypes = [] },
      } = await reporting.getLicenseInfo();

      return downloadResponseHandler(res, jobTypes, user, { docId });
    })
  );

  // allow a report to be deleted
  const deleteResponseHandler = deleteJobResponseHandlerFactory(reporting);
  router.delete(
    {
      path: `${MAIN_ENTRY}/delete/{docId}`,
      validate: {
        params: schema.object({
          docId: schema.string({ minLength: 3 }),
        }),
      },
    },
    userHandler(async (user, context, req, res) => {
      // ensure the async dependencies are loaded
      if (!context.reporting) {
        return handleUnavailable(res);
      }

      const { docId } = req.params;
      const {
        management: { jobTypes = [] },
      } = await reporting.getLicenseInfo();

      return deleteResponseHandler(res, jobTypes, user, { docId });
    })
  );
}
