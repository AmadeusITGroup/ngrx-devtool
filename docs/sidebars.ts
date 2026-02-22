import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/quick-start',
        'getting-started/installation',
        'getting-started/run-locally',
      ],
    },
    'configuration',
    'how-it-works',
    {
      type: 'category',
      label: 'Features',
      collapsed: false,
      items: [
        'features/action-monitoring',
        'features/effect-tracking',
        'features/performance',
        'features/state-visualization',
        'features/diff-viewer',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-issues',
        'troubleshooting/faq',
      ],
    },
  ],
};

export default sidebars;
