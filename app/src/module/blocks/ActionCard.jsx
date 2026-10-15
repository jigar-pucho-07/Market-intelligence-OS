// ActionCard — one big verb with state (HR "Punch in / Punch out", "Apply leave"). Reads its state from a row when `state` is declared.
import { useState } from 'react';
import { Button } from 'antd';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { runAction } from '../../utils/api';
import { where } from '../formula';
import { icon } from '../Kpis';
import { CARD } from '../Charts';
import ActionModal from '../ActionModal';

export default function ActionCard({ block, data, reload, user }) {
  const [busy, setBusy] = useState(false); const [modal, setModal] = useState(null);
  const rows = data[block.entity] ?? [];
  const mine = block.state?.where ? where(rows, block.state.where, user) : [];
  // No matching row → the card's own text and button (not checked in yet); a row → the first state whose `when` it satisfies.
  const state = mine.length ? (block.state.states.find((s) => !s.when || where(mine, s.when, user).length) ?? null) : null;
  // A state may say `button: false` — after check-in the card collapses to a status line and the page's other verb becomes primary (M11).
  const btn = state?.button === false ? null : (state?.button ?? block.button);
  const fill = (t) => String(t ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => { const v = mine[0]?.[k]; if (v === undefined) return ''; const d = /_At$/.test(k) ? new Date(v) : null; return d && !isNaN(d) ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : String(v); });
  const I = icon(block.icon);
  const go = async () => {
    if (btn.fields?.length) return setModal(btn);
    setBusy(true);
    try { await runAction(btn, { ...(btn.context ?? {}), user: user?.name }); toast.success(btn.success ?? 'Done'); reload?.(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className={`${CARD} p-5 flex flex-col sm:flex-row sm:items-center gap-5`} data-os-action-card>
      <div className="w-12 h-12 rounded-full bg-black/[0.04] text-ink flex items-center justify-center shrink-0"><I className="w-6 h-6" strokeWidth={1.75} /></div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[17px] font-semibold text-ink">{block.title}</h3>
        <p className="text-[13px] text-ink-3">{fill(state?.text ?? block.text)}</p>
      </div>
      {btn && <Button data-os-action={block.id} type="primary" size="large" loading={busy} onClick={go}>{btn.title}</Button>}
      {!btn && state && <span className="badge badge-success" data-os-action-card-done>{state.label ?? 'Done'}</span>}
      {modal && <ActionModal spec={{ entity: block.entity, ...modal }} row={null} open onClose={() => setModal(null)} data={data} onDone={reload} />}
    </motion.div>
  );
}
