// PublicLayout — pages marked `public: true` (no login): the client's mark, centred content, global powered-by badge.
import { Link } from '../lib/router';
import BrandMark, { PoweredBy } from '../components/BrandMark';

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen app-canvas flex flex-col" data-os-public>
      <header className="border-b" style={{ background: 'var(--surface)', borderColor: 'var(--line-soft)' }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <BrandMark size={28} plain />
          <Link to="/login" className="text-xs font-semibold text-primary-600 whitespace-nowrap">Staff sign in</Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-8 pb-20">{children}</main>
      <PoweredBy />
    </div>
  );
}
