import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Brand } from '@/components/brand';
import site from '../../site.config.json';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: <Brand />, url: '/' },
    githubUrl: site.repository,
    links: [
      { text: 'Documentation', url: '/docs/', active: 'url' },
      { text: 'Rust', url: '/docs/rust/', active: 'nested-url' },
      { text: 'Go', url: '/docs/go/', active: 'nested-url' },
      { text: 'API reference', url: '/docs/api/' },
      { text: 'Performance', url: '/docs/performance/' },
    ],
    themeSwitch: { mode: 'light-dark-system' },
  };
}
