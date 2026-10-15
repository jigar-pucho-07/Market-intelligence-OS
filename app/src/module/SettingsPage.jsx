'use client';
// SettingsPage — "Profile & settings": the signed-in person's own things — photo, display name, password. One page, reached
// from the account menu at the bottom-left of the shell (Haresh review Oct 2026, UI 3: Profile and Settings were two menu
// items opening one page). People and roles are administered on the Users & roles page (kind: users, UI 4). The data
// source (database, wired flows, inbound token) is not shown to anyone here (UI 5 / S2): an administrator reads it from
// /api/health, which answers in full only to an admin session.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button, Input } from 'antd';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DESC, ROLE_PERMISSIONS } from '../config/roles';
import ProfileAvatar from '../components/ProfileAvatar';
import Modal from '../components/Modal';
import { CARD, SECTION_TITLE } from './Charts';
import { pageVariants } from './Kpis';
import { cn } from '../utils/cn';

export const FIELD_LABEL = 'block text-[13px] font-semibold text-gray-700 mb-1.5';

export default function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [pwOpen, setPwOpen] = useState(false); const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  useEffect(() => setName(user?.name || ''), [user]);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-6 max-w-3xl">
      <div className={`${CARD} p-6 space-y-4`}>
        <h3 className={SECTION_TITLE}>Profile</h3>
        <div className="flex items-center gap-4"><ProfileAvatar size={56} /><div><p className="font-semibold text-gray-900">{user?.name}</p><p className="text-xs text-gray-500">{user?.email}</p><span className="badge badge-neutral mt-1" data-os-role-chip><span className={cn('w-2 h-2 rounded-full shrink-0', ROLE_COLORS[user?.role])} aria-hidden />{ROLE_LABELS[user?.role]}</span></div></div>
        <p className="text-xs text-ink-3" data-os-role-desc>{ROLE_DESC[user?.role] || `This role opens ${(ROLE_PERMISSIONS[user?.role] ?? []).filter((p) => p !== '*').length || 'all'} pages.`}</p>
        <div><label className={FIELD_LABEL}>Display name</label><Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" /></div>
        <div className="flex gap-2"><Button type="primary" className="rounded-full bg-primary-500 border-0" onClick={async () => { const r = await updateProfile({ name: name.trim() }); if (r?.ok === false) return toast.error(r.message); toast.success('Profile updated'); }}>Save</Button><Button icon={<KeyRound className="w-4 h-4" />} className="rounded-xl" onClick={() => setPwOpen(true)}>Change password</Button></div>
      </div>

      <Modal isOpen={pwOpen} onClose={() => setPwOpen(false)} title="Change password" size="sm">
        <div className="space-y-3">
          {['current', 'next', 'confirm'].map((k) => <div key={k}><label className={FIELD_LABEL}>{k === 'current' ? 'Current password' : k === 'next' ? 'New password' : 'Confirm new password'}</label><Input.Password value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} className="rounded-xl" /></div>)}
          <Button type="primary" block className="rounded-full bg-primary-500 border-0" onClick={async () => { if (pw.next !== pw.confirm) return toast.error('Passwords do not match'); const r = await changePassword(user?.email, pw.current, pw.next); if (!r.success) return toast.error(r.message); setPwOpen(false); setPw({ current: '', next: '', confirm: '' }); toast.success('Password changed'); }}>Save</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
