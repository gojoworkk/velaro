import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './admin.css';

export const metadata: Metadata = { title: 'Velaro — админка', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
