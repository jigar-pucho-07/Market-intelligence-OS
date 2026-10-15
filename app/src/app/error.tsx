'use client';
// src/app/error.tsx — v4.9 (C4): the page that stands in when something on a page throws. Branded, plain words, a Retry that re-renders
// the segment (reset()), and a way home. The technical message is not shown to the person; its digest is, so support can find it.
import { useEffect } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import { OS } from '@/config/os.config';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('page error', error?.digest ?? '', error?.message); }, [error]);
  return (
    <main className="ux-status" data-testid="error-page">
      <div className="ux-status__card" role="alert">
        <BrandMark size={36} plain sub={undefined} className="" />
        <p className="ux-status__code">Something went wrong</p>
        <h1 className="ux-status__title">This page hit a problem</h1>
        <p className="ux-status__text">It is on our side, not yours, and nothing you saved was lost. Try again; if it keeps happening, tell your {OS.name} admin{error?.digest ? ' and quote the reference below' : ''}.</p>
        <div className="ux-status__actions">
          <button type="button" className="ux-btn ux-btn--primary" onClick={() => reset()} data-testid="error-retry">Retry</button>
          <Link href="/" className="ux-btn">Go to the home page</Link>
        </div>
        {error?.digest && <p className="ux-status__ref">Reference {error.digest}</p>}
      </div>
    </main>
  );
}
