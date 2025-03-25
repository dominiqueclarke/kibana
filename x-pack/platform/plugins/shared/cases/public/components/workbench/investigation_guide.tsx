/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiMarkdownFormat } from '@elastic/eui';

export const InvestigationGuide: React.FC = () => {
  return (
    <div>
      <EuiMarkdownFormat>
        {`   
## Overview
This runbook provides guidelines for monitoring, troubleshooting, and maintaining an e-commerce application. The application consists of several microservices, including user management, product catalog, order processing, and payment services.

## Monitoring

### Elasticsearch
- **Logs**: Ensure all services are logging to Elasticsearch. Use Kibana to visualize and search logs.
- **Metrics**: Collect application metrics (CPU, memory, response times) and store them in Elasticsearch.
- **Alerts**: Set up alerts for critical metrics (e.g., high error rates, slow response times).

### Uptime Monitoring
- Use synthetic monitoring to check the availability of key endpoints (e.g., homepage, login, checkout).

## Incident Response

### Alert Handling
- **High Error Rate**:
  - Check Elasticsearch logs for error messages.
  - Identify the affected service and investigate recent changes or deployments.
- **Slow Response Times**:
  - Check Elasticsearch metrics for CPU and memory usage.
  - Identify any resource bottlenecks or high load on the service.

### Service Downtime
- **Immediate Actions**:
  - Check Elasticsearch uptime monitoring for the affected service.
  - Restart the service if necessary.
- **Root Cause Analysis**:
  - Review recent deployments or configuration changes.
  - Check Elasticsearch logs for any error messages or stack traces.

## Maintenance

### Regular Backups
- Schedule regular backups of databases and Elasticsearch indices.
- Verify backup integrity and test restore procedures periodically.

### Security Updates
- Regularly apply security patches to all services and dependencies.
- Monitor security advisories for any vulnerabilities affecting the application.

## Deployment

### Continuous Integration/Continuous Deployment (CI/CD)
- Use a CI/CD pipeline to automate testing and deployment.
- Ensure all changes are tested in a staging environment before production deployment.

### Rollback Procedures
- Maintain a rollback plan for each deployment.
- Ensure previous versions of the application are readily available for rollback if needed.

## Performance Tuning

### Database Optimization
- Regularly analyze and optimize database queries.
- Use indexing to improve query performance.

### Caching
- Implement caching for frequently accessed data (e.g., product catalog).
- Use a distributed cache (e.g., Redis) to reduce load on the database.

## Documentation

### Runbook Updates
- Regularly review and update the runbook to reflect changes in the application or infrastructure.
- Ensure all team members are familiar with the runbook and know where to find it.

### Knowledge Sharing
- Conduct regular training sessions for the team on monitoring, incident response, and maintenance procedures.
- Document any lessons learned from incidents and share them with the team.

## Contact Information

- **Primary On-Call**: [Name, Email, Phone]
- **Secondary On-Call**: [Name, Email, Phone]
- **Escalation Contact**: [Name, Email, Phone]

This runbook provides a concise guide for managing the e-commerce application, ensuring it remains reliable, performant, and secure.
            `}
      </EuiMarkdownFormat>
    </div>
  );
};

InvestigationGuide.displayName = 'InvestigationGuide';
