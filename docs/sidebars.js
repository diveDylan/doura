/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

//@ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'introduction',
    {
      type: 'category',
      label: 'Getting Stared',
      items: ['installation', 'playground'],
      collapsed: false,
      collapsible: false,
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'core-concepts/store',
        'core-concepts/state',
        'core-concepts/actions',
        'core-concepts/views',
        'core-concepts/plugins',
      ],
      collapsed: false,
      collapsible: false,
    },
    {
      type: 'category',
      label: 'React integration',
      items: [
        'react/component-state',
        'react/global-store',
        'react/multiple-stores',
      ],
      collapsed: false,
      collapsible: false,
    },
    {
      type: 'category',
      label: 'Guides',
      items: ['guides/compose-model', 'guides/optimize-views', 'guides/hmr'],
      collapsed: true,
      collapsible: true,
    },
  ],
}

module.exports = sidebars
