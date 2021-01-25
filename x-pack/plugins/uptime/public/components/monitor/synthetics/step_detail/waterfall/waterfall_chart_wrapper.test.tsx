/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React from 'react';
import { act, fireEvent } from '@testing-library/react';
import { WaterfallChartWrapper } from './waterfall_chart_wrapper';

import { render } from '../../../../../lib/helper/rtl_helpers';

import { extractItems, isHighlightedItem } from './data_formatting';

import 'jest-canvas-mock';
import { BAR_HEIGHT } from '../../waterfall/components/constants';
import { MimeType } from './types';

const getHighLightedItems = (query: string, filters: string[]) => {
  return NETWORK_EVENTS.events.filter((item) => isHighlightedItem(item, query, filters));
};

describe('waterfall chart wrapper', () => {
  jest.useFakeTimers();

  it('renders the correct sidebar items', () => {
    const { getAllByTestId } = render(
      <WaterfallChartWrapper data={extractItems(NETWORK_EVENTS.events)} total={1000} />
    );

    const sideBarItems = getAllByTestId('middleTruncatedTextSROnly');

    expect(sideBarItems).toHaveLength(5);
  });

  it('search by query works', () => {
    const { getAllByTestId, getByTestId } = render(
      <WaterfallChartWrapper data={extractItems(NETWORK_EVENTS.events)} total={1000} />
    );

    const filterInput = getByTestId('waterfallFilterInput');

    const searchText = '.js';

    act(() => {
      fireEvent.change(filterInput, { target: { value: searchText } });
    });

    // inout has debounce effect so hence the timer
    act(() => {
      jest.advanceTimersByTime(300);
    });

    const highlightedItemsLength = getHighLightedItems(searchText, []).length;

    expect(getAllByTestId('sideBarHighlightedItem')).toHaveLength(highlightedItemsLength);

    expect(getAllByTestId('sideBarDimmedItem')).toHaveLength(
      NETWORK_EVENTS.events.length - highlightedItemsLength
    );

    const SIDE_BAR_ITEMS_HEIGHT = NETWORK_EVENTS.events.length * BAR_HEIGHT;
    expect(getByTestId('wfSidebarContainer')).toHaveAttribute('height', `${SIDE_BAR_ITEMS_HEIGHT}`);

    expect(getByTestId('wfDataOnlyBarChart')).toHaveAttribute('height', `${SIDE_BAR_ITEMS_HEIGHT}`);
  });

  it('search by mime type works', () => {
    const { getAllByTestId, getByText } = render(
      <WaterfallChartWrapper data={extractItems(NETWORK_EVENTS.events)} total={1000} />
    );

    const sideBarItems = getAllByTestId('middleTruncatedTextSROnly');

    expect(sideBarItems).toHaveLength(5);

    const xhrBtn = getByText('XHR');

    act(() => {
      fireEvent.click(xhrBtn);
    });

    // inout has debounce effect so hence the timer
    act(() => {
      jest.advanceTimersByTime(300);
    });

    const highlightedItemsLength = getHighLightedItems('', [MimeType.XHR]).length;

    expect(getAllByTestId('sideBarHighlightedItem')).toHaveLength(highlightedItemsLength);
    expect(getAllByTestId('sideBarDimmedItem')).toHaveLength(
      NETWORK_EVENTS.events.length - highlightedItemsLength
    );
  });
});

const NETWORK_EVENTS = {
  events: [
    {
      timestamp: '2021-01-21T10:31:21.537Z',
      method: 'GET',
      url:
        'https://apv-static.minute.ly/videos/v-c2a526c7-450d-428e-1244649-a390-fb639ffead96-s45.746-54.421m.mp4',
      status: 206,
      mimeType: 'video/mp4',
      requestSentTime: 241114127.474,
      requestStartTime: 241114129.214,
      loadEndTime: 241116573.402,
      timings: {
        total: 2445.928000001004,
        queueing: 1.7399999778717756,
        blocked: 0.391999987186864,
        receive: 2283.964000031119,
        connect: 91.5709999972023,
        wait: 28.795999998692423,
        proxy: -1,
        dns: 36.952000024029985,
        send: 0.10000000474974513,
        ssl: 64.28900000173599,
      },
    },
    {
      timestamp: '2021-01-21T10:31:22.174Z',
      method: 'GET',
      url: 'https://dpm.demdex.net/ibs:dpid=73426&dpuuid=31597189268188866891125449924942215949',
      status: 200,
      mimeType: 'image/gif',
      requestSentTime: 241114749.202,
      requestStartTime: 241114750.426,
      loadEndTime: 241114805.541,
      timings: {
        queueing: 1.2240000069141388,
        receive: 2.218999987235293,
        proxy: -1,
        dns: -1,
        send: 0.14200000441633165,
        blocked: 1.033000007737428,
        total: 56.33900000248104,
        wait: 51.72099999617785,
        ssl: -1,
        connect: -1,
      },
    },
    {
      timestamp: '2021-01-21T10:31:21.679Z',
      method: 'GET',
      url: 'https://dapi.cms.mlbinfra.com/v2/content/en-us/sel-t119-homepage-mediawall',
      status: 200,
      mimeType: 'application/json',
      requestSentTime: 241114268.04299998,
      requestStartTime: 241114270.184,
      loadEndTime: 241114665.609,
      timings: {
        total: 397.5659999996424,
        dns: 29.5429999823682,
        wait: 221.6830000106711,
        queueing: 2.1410000044852495,
        connect: 106.95499999565072,
        ssl: 69.06899999012239,
        receive: 2.027999988058582,
        blocked: 0.877000013133511,
        send: 23.719999997410923,
        proxy: -1,
      },
    },
    {
      timestamp: '2021-01-21T10:31:21.740Z',
      method: 'GET',
      url: 'https://platform.twitter.com/embed/embed.runtime.b313577971db9c857801.js',
      status: 200,
      mimeType: 'application/javascript',
      requestSentTime: 241114303.84899998,
      requestStartTime: 241114306.416,
      loadEndTime: 241114370.361,
      timings: {
        send: 1.357000001007691,
        wait: 40.12299998430535,
        receive: 16.78500001435168,
        ssl: -1,
        queueing: 2.5670000177342445,
        total: 66.51200001942925,
        connect: -1,
        blocked: 5.680000002030283,
        proxy: -1,
        dns: -1,
      },
    },
    {
      timestamp: '2021-01-21T10:31:21.740Z',
      method: 'GET',
      url: 'https://platform.twitter.com/embed/embed.modules.7a266e7acfd42f2581a5.js',
      status: 200,
      mimeType: 'application/javascript',
      requestSentTime: 241114305.939,
      requestStartTime: 241114310.393,
      loadEndTime: 241114938.264,
      timings: {
        wait: 51.61500000394881,
        dns: -1,
        ssl: -1,
        receive: 506.5750000067055,
        proxy: -1,
        connect: -1,
        blocked: 69.51599998865277,
        queueing: 4.453999979887158,
        total: 632.324999984121,
        send: 0.16500000492669642,
      },
    },
  ],
};
