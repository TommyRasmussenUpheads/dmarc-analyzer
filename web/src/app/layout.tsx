import type { ReactNode } from 'react';
export const metadata = { title: 'AI Sandbox Portal' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
