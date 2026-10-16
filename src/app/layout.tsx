import { Provider } from '@/components/provider';
import './global.css';
import type { ReactNode } from 'react';

export const metadata = { title: { default: 'Qortoo', template: '%s | Qortoo' } };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen"><Provider>{children}</Provider></body>
    </html>
  );
}
