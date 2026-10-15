// src/app/not-found.tsx — v4.9 (C4): the 404 every unknown address lands on (the catch-all calls notFound()). The client's own mark,
// plain words, one way home — never a blank page or a framework message.
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import { OS } from '@/config/os.config';

export default function NotFound() {
  return (
    <main className="ux-status" data-testid="not-found">
      <div className="ux-status__card">
        <BrandMark size={36} plain sub={undefined} className="" />
        <p className="ux-status__code">Error 404</p>
        <h1 className="ux-status__title">We can’t find that page</h1>
        <p className="ux-status__text">The address may have a typo, or the page may have moved. Nothing is wrong with your account or your data. Head back to {OS.name} and pick up from there.</p>
        <div className="ux-status__actions">
          <Link href="/" className="ux-btn ux-btn--primary" data-testid="not-found-home">Go to the home page</Link>
        </div>
      </div>
    </main>
  );
}
