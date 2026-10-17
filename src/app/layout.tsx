import site from '../../site.config.json';
import { Provider } from '@/components/provider';
import './global.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: { default: 'Qortoo · Developer documentation', template: '%s | Qortoo' },
  description: 'Build with Qortoo: Rust and Go SDK guides, core concepts, and API documentation.',
  icons: { icon: `${site.basePath}/brand/emblem.png` },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen"><Provider>{children}</Provider></body>
    </html>
  );
}
