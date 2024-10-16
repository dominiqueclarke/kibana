/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { setMockActions, setMockValues } from '../../../../../__mocks__/kea_logic';

import React from 'react';

import { shallow } from 'enzyme';

import {
  EuiButton,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiPopover,
  EuiResizeObserver,
} from '@elastic/eui';

import { mountWithIntl } from '../../../../../test_helpers';
import { CrawlerDomain } from '../../types';

import { ManageCrawlsPopover } from './manage_crawls_popover';

const MOCK_ACTIONS = {
  closePopover: jest.fn(),
  reApplyCrawlRules: jest.fn(),
  togglePopover: jest.fn(),
};

const MOCK_VALUES = {
  isOpen: false,
};

const MOCK_DOMAIN = { url: 'https://elastic.co' } as CrawlerDomain;

describe('ManageCrawlsPopover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockActions(MOCK_ACTIONS);
    setMockValues(MOCK_VALUES);
  });

  it('renders', () => {
    const wrapper = shallow(<ManageCrawlsPopover />);

    expect(wrapper.is(EuiPopover)).toBe(true);
    expect(wrapper.prop('closePopover')).toEqual(MOCK_ACTIONS.closePopover);
    expect(wrapper.dive().find(EuiButton).prop('onClick')).toEqual(MOCK_ACTIONS.togglePopover);
  });

  it('is closed by default', () => {
    const wrapper = shallow(<ManageCrawlsPopover />);

    expect(wrapper.find(EuiContextMenuPanel)).toHaveLength(0);
  });

  it('includes a context menu when open', () => {
    setMockValues({
      ...MOCK_VALUES,
      isOpen: true,
    });

    const wrapper = mountWithIntl(<ManageCrawlsPopover domain={MOCK_DOMAIN} />);

    const menuItems = wrapper
      .find(EuiContextMenuPanel)
      .find(EuiResizeObserver)
      .find(EuiContextMenuItem);

    expect(menuItems).toHaveLength(1);

    menuItems.first().simulate('click');
    expect(MOCK_ACTIONS.reApplyCrawlRules).toHaveBeenCalledWith(MOCK_DOMAIN);
  });
});
