/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getCases } from '../../containers/api';

export const CasesFetch: React.FC = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getCases({
          filterOptions: {
            search: '',
            searchFields: [],
            severity: [],
            assignees: [],
            reporters: [],
            status: [],
            tags: [],
            owner: ['observability'],
            category: [],
            customFields: {},
          },
        });
        setData(response);
        console.log('response', response);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>{'Loading...'}</div>;
  if (error)
    return (
      <div>
        {'Error: '}
        {error.message}
      </div>
    );

  return (
    <div>
      <h1>{'Cases'}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

CasesFetch.displayName = 'CasesFetch';
