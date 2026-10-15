'use client';
// UsersPage — "Users & roles", its own page in the Setup group, administrators only (Haresh review Oct 2026, UI 4; it used to
// sit inside Settings). Compulsory per standards §6: create, deactivate, reactivate, reset password, change role — every rule
// is enforced by the Server Actions (nobody edits their own role, the last administrator is protected); the UI only offers
// what is allowed. The scaffold adds this page (`kind: users`) to every OS and to the admin role when the yaml does not.
import { selectProps } from '../config/popup';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button, Input, Select, Tooltip } from 'antd';
import { KeyRound, UserPlus, UserX, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, ROLE_COLORS, ROLE_PERMISSIONS, ROLE_DESC } from '../config/roles';
import * as actions from '../app/actions';
import Modal from '../components/Modal';
import { CARD } from './Charts';
import { pageVariants } from './Kpis';
import { FIELD_LABEL } from './SettingsPage';
import { cn } from '../utils/cn';

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

export default function UsersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [users, setUsers] = useState([]);
  const refresh = async () => { if (!isAdmin) return; const r = await actions.listUsers(); if (r.ok) setUsers(r.users); else toast.error(r.message); };
  useEffect(() => { refresh(); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  const [addOpen, setAddOpen] = useState(false); const [nu, setNu] = useState({ name: '', email: '', password: '', role: ROLE_OPTIONS.find((r) => r.value !== 'admin')?.value ?? 'admin' });
  const [resetFor, setResetFor] = useState(null); const [resetPw, setResetPw] = useState('');
  const act = async (fn, okMsg) => { const r = await fn(); if (!r.ok) return toast.error(r.message); toast.success(okMsg); refresh(); };
  const active = users.filter((u) => u.is_active).length;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-6 max-w-5xl">
      <div className={CARD}>
        <div className="p-4 border-b border-gray-100/50 flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="text-[13px] font-semibold text-ink">People</p><p className="text-[12px] text-ink-3">{users.length ? `${active} active · ${users.length - active} inactive` : 'Everyone who can sign in, and what each role may open.'}</p></div>
          {isAdmin && <Button type="primary" icon={<UserPlus className="w-4 h-4" />} className="rounded-lg bg-primary-500 border-0 h-9" data-os-action="add-user" onClick={() => setAddOpen(true)}>Add user</Button>}
        </div>
        <div className="divide-y divide-surface-border" data-os-users>
          {!isAdmin && <div className="px-4 py-3 text-sm text-ink-3">Only an administrator manages people. Your role: <strong>{ROLE_LABELS[user?.role]}</strong> — {ROLE_DESC[user?.role] || `${(ROLE_PERMISSIONS[user?.role] ?? []).filter((p) => p !== '*').length || 'all'} pages`}.</div>}
          {users.map((u) => (
            <div key={u.id} className={cn('px-4 py-3 flex items-center gap-4', !u.is_active && 'opacity-60')}>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900">{u.name}</p><p className="text-xs text-gray-500">{u.email}</p></div>
              {u.id === user?.id || !isAdmin ? <span className="badge badge-neutral"><span className={cn('w-2 h-2 rounded-full shrink-0', ROLE_COLORS[u.role])} aria-hidden />{ROLE_LABELS[u.role]}</span>
                : <Select {...selectProps} size="small" className="w-36" value={u.role} options={ROLE_OPTIONS} aria-label={`Role of ${u.name}`} onChange={(role) => act(() => actions.setUserRole({ id: u.id, role }), 'Role changed — they sign in again')} />}
              <span className="text-[12px] text-ink-3 hidden md:block w-72 truncate" title={ROLE_DESC[u.role] || (ROLE_PERMISSIONS[u.role] ?? []).join(', ')}>{ROLE_DESC[u.role] || `${(ROLE_PERMISSIONS[u.role] ?? []).filter((p) => p !== '*').length || 'All'} pages`}</span>
              {!u.is_active && <span className="badge badge-neutral">Inactive</span>}
              {u.must_change_password && u.is_active && <span className="badge badge-neutral" title="Must set a new password at next sign-in">Temporary password</span>}
              {isAdmin && u.id !== user?.id && <Tooltip title="Reset password"><Button size="small" icon={<KeyRound className="w-3.5 h-3.5" />} className="rounded-lg" aria-label={`Reset password of ${u.name}`} onClick={() => { setResetFor(u); setResetPw(''); }} /></Tooltip>}
              {isAdmin && u.id !== user?.id && (u.is_active
                ? <Tooltip title="Deactivate"><Button size="small" danger icon={<UserX className="w-3.5 h-3.5" />} className="rounded-lg" aria-label={`Deactivate ${u.name}`} onClick={() => act(() => actions.setUserActive({ id: u.id, active: false }), 'User deactivated — their sessions ended')} /></Tooltip>
                : <Tooltip title="Reactivate"><Button size="small" icon={<UserCheck className="w-3.5 h-3.5" />} className="rounded-lg" aria-label={`Reactivate ${u.name}`} onClick={() => act(() => actions.setUserActive({ id: u.id, active: true }), 'User reactivated')} /></Tooltip>)}
            </div>
          ))}
        </div>
      </div>

      <div className={`${CARD} p-4`} data-os-roles>
        <p className="text-[13px] font-semibold text-ink mb-2">Roles</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ROLE_OPTIONS.map((r) => <div key={r.value} className="flex items-start gap-3 rounded-[var(--r-8)] border border-surface-border px-3 py-2"><span className="badge badge-neutral shrink-0 mt-0.5"><span className={cn('w-2 h-2 rounded-full shrink-0', ROLE_COLORS[r.value])} aria-hidden />{r.label}</span><p className="text-[12px] text-ink-3 min-w-0">{ROLE_DESC[r.value] || `${(ROLE_PERMISSIONS[r.value] ?? []).filter((p) => p !== '*').length || 'All'} pages`}</p></div>)}
        </div>
      </div>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add user" size="sm">
        <div className="space-y-3">
          <div><label className={FIELD_LABEL}>Name</label><Input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} className="rounded-xl" /></div>
          <div><label className={FIELD_LABEL}>Email</label><Input value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} className="rounded-xl" /></div>
          <div><label className={FIELD_LABEL}>Temporary password <span className="font-normal text-ink-3">(they set their own at first sign-in; leave empty to sign in by one-time code)</span></label><Input.Password value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} className="rounded-xl" /></div>
          <div><label className={FIELD_LABEL}>Role</label><Select {...selectProps} className="w-full" value={nu.role} options={ROLE_OPTIONS} onChange={(v) => setNu({ ...nu, role: v })} /></div>
          <Button type="primary" block className="rounded-full bg-primary-500 border-0" onClick={async () => {
            if (!nu.name || !nu.email) return toast.error('Name and email are required');
            const r = await actions.createUser({ name: nu.name, email: nu.email, role: nu.role, ...(nu.password ? { password: nu.password } : {}) });
            if (!r.ok) return toast.error(r.message);
            setAddOpen(false); setNu({ name: '', email: '', password: '', role: nu.role }); toast.success('User added'); refresh(); }}>Add</Button>
        </div>
      </Modal>
      <Modal isOpen={!!resetFor} onClose={() => setResetFor(null)} title={`Reset password — ${resetFor?.name ?? ''}`} size="sm">
        <div className="space-y-3">
          <div><label className={FIELD_LABEL}>Temporary password</label><Input.Password value={resetPw} onChange={(e) => setResetPw(e.target.value)} className="rounded-xl" /></div>
          <Button type="primary" block className="rounded-full bg-primary-500 border-0" onClick={async () => { const r = await actions.resetUserPassword({ id: resetFor.id, password: resetPw }); if (!r.ok) return toast.error(r.message); setResetFor(null); toast.success('Password reset — their sessions ended; they must choose a new one'); refresh(); }}>Reset</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
