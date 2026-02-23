import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'NgRx DevTool',
  tagline: 'Debug NgRx visually. Track actions, effects, and state in real-time.',
  favicon: 'img/favicon.png',

  future: {
    v4: true,
  },

  url: 'https://amadeusitgroup.github.io',
  baseUrl: '/ngrx-devtool/',

  organizationName: 'amadeusitgroup',
  projectName: 'ngrx-devtool',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'NgRx DevTool',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/amadeusitgroup/ngrx-devtool',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Quick Start', to: '/docs/getting-started/quick-start' },
            { label: 'Installation', to: '/docs/getting-started/installation' },
            { label: 'Configuration', to: '/docs/configuration' },
          ],
        },
        {
          title: 'Features',
          items: [
            { label: 'Action Monitoring', to: '/docs/features/action-monitoring' },
            { label: 'Effect Tracking', to: '/docs/features/effect-tracking' },
            { label: 'Performance', to: '/docs/features/performance' },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/amadeusitgroup/ngrx-devtool',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/%40amadeus-it-group%2Fngrx-devtool',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} NgRx DevTool. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['typescript', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
