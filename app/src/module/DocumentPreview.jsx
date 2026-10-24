// DocumentPreview — renders a declared document (os.yaml documents[]) for one record: letterhead, field grid, line-item table with totals, body, signature.
// Print / Save as PDF uses the browser print dialog on an isolated iframe, so page chrome never leaks into the document.
import { useMemo, useRef } from 'react';
import { Button } from 'antd';
import { Printer } from 'lucide-react';
import Modal from '../components/Modal';
import { DOCUMENTS, ENTITIES, OS, BRAND } from '../config/os.config';
import { toNum, toDate } from './formula';
import { format } from 'date-fns';

const fill = (tpl, row) => String(tpl ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => (k === 'today' ? format(new Date(), 'dd MMM yyyy') : row?.[k] ?? ''));
const money = (v) => `₹${toNum(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const cellText = (col, v) => (col.type === 'money' ? money(v) : col.type === 'date' ? (toDate(v) ? format(toDate(v), 'dd MMM yyyy') : '') : String(v ?? ''));

export default function DocumentPreview({ docId, row, data, open, onClose, inline = false }) {
  const doc = DOCUMENTS[docId];
  const ref = useRef(null);
  const items = useMemo(() => (doc?.items ? (data?.[doc.items.entity] ?? []).filter((r) => r[doc.items.by] === row?.[ENTITIES[doc.entity].id.column]) : []), [doc, data, row]);
  if (!doc || !row) return null;
  // 24 Oct 2026: printing from a hidden iframe was silently ignored by some browsers (no dialog, no error), so
  // "Print / Save PDF" did nothing. Now the main window prints, synchronously inside the click (user activation intact):
  // a copy of the document is added as a direct child of <body>, a print-only stylesheet hides everything else (the app,
  // the modal), the page title carries the file name (Save as PDF suggests it), and both are removed after the dialog closes.
  const print = () => {
    const name = fill(doc.file_name ?? doc.title, row);
    document.getElementById('os-print-root')?.remove(); document.getElementById('os-print-style')?.remove();
    const st = document.createElement('style'); st.id = 'os-print-style';
    st.textContent = `@media screen{#os-print-root{display:none!important}}
      @media print{@page{size:A4;margin:16mm} html,body{background:#fff!important;height:auto!important;overflow:visible!important}
      body>*:not(#os-print-root){display:none!important}
      #os-print-root{display:block!important;font-family:Lato,Arial,sans-serif;color:#1f2937;font-size:12px;background:#fff}
      #os-print-root h1{font-size:18px;margin:0}
      #os-print-root .lh{display:flex;justify-content:space-between;border-bottom:3px solid ${BRAND.color};padding-bottom:10px;margin-bottom:16px}
      #os-print-root .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:12px 0} #os-print-root .k{color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:.05em} #os-print-root .v{font-weight:700}
      #os-print-root table{width:100%;border-collapse:collapse;margin:14px 0} #os-print-root th{background:${BRAND.color}15;color:#374151;text-align:left;font-size:10px;text-transform:uppercase;padding:6px;border-bottom:1px solid #e5e7eb} #os-print-root td{padding:6px;border-bottom:1px solid #f1f1f1} #os-print-root .r{text-align:right}
      #os-print-root .tot td{font-weight:700;border-top:2px solid #e5e7eb} #os-print-root .body{white-space:pre-wrap;line-height:1.55;margin:14px 0} #os-print-root .sig{margin-top:48px;display:flex;justify-content:flex-end} #os-print-root .sig div{text-align:center;border-top:1px solid #9ca3af;padding-top:6px;min-width:200px}}`;
    const root = document.createElement('div'); root.id = 'os-print-root'; root.innerHTML = ref.current.innerHTML;
    document.head.appendChild(st); document.body.appendChild(root);
    const pageTitle = document.title; document.title = name;
    let done = false;
    const cleanup = () => { if (done) return; done = true; document.title = pageTitle; root.remove(); st.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    window.print();                                              // blocks until the dialog closes in Chrome / Edge; afterprint covers the others
    setTimeout(cleanup, 10 * 60 * 1000);                         // safety: never leave the print copy behind
  };
  const totals = (doc.items?.totals ?? []).map((t) => ({ label: t.label, value: t.sum ? items.reduce((s, r) => s + toNum(r[t.sum]), 0) : toNum(row[t.column]) }));
  const body = (
      <div className="w-full space-y-4" data-os-document>
        <div className="flex justify-end"><Button type="primary" icon={<Printer className="w-4 h-4" />} onClick={print} data-os-print>Print / Save PDF</Button></div>
        <div className="rounded-2xl border border-surface-border bg-white p-4 sm:p-6 max-h-[60vh] overflow-auto custom-scrollbar" data-os-document-sheet>
          <div ref={ref} className="min-w-0 text-[12px] text-gray-800 break-words">
            <div className="lh" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `3px solid ${BRAND.color}`, paddingBottom: 10, marginBottom: 16, gap: 16 }}>
              <div><h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{doc.letterhead?.name ?? OS.client.split(',')[0]}</h1>{(doc.letterhead?.lines ?? []).map((l, i) => <div key={i} style={{ color: '#6b7280', fontSize: 11 }}>{l}</div>)}</div>
              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, fontSize: 14, color: BRAND.color }}>{fill(doc.heading ?? doc.title, row)}</div><div style={{ fontSize: 11 }}>{fill(doc.subheading ?? '{{today}}', row)}</div></div>
            </div>
            {doc.fields && <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', margin: '12px 0' }}>{doc.fields.map((f) => <div key={f.key}><div className="k" style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{f.label ?? f.key.replace(/_/g, ' ')}</div><div className="v" style={{ fontWeight: 700 }}>{cellText(f, row[f.key]) || '—'}</div></div>)}</div>}
            {doc.body && <div className="body" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, margin: '14px 0' }}>{fill(doc.body, row)}</div>}
            {doc.items && (
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0', tableLayout: 'auto', fontSize: 11 }}>
                <thead><tr>{doc.items.columns.map((c) => <th key={c.key} className={c.type === 'money' || c.type === 'number' ? 'r' : ''} style={{ textAlign: c.type === 'money' || c.type === 'number' ? 'right' : 'left', fontSize: 10, textTransform: 'uppercase', padding: 6, borderBottom: '1px solid #e5e7eb', background: `${BRAND.color}15` }}>{c.label ?? c.key.replace(/_/g, ' ')}</th>)}</tr></thead>
                <tbody>
                  {items.map((it, i) => <tr key={i}>{doc.items.columns.map((c) => <td key={c.key} className={c.type === 'money' || c.type === 'number' ? 'r' : ''} style={{ padding: 6, borderBottom: '1px solid #f1f1f1', textAlign: c.type === 'money' || c.type === 'number' ? 'right' : 'left' }}>{cellText(c, it[c.key])}</td>)}</tr>)}
                  {!items.length && <tr><td colSpan={doc.items.columns.length} style={{ padding: 6, color: '#9ca3af' }}>No items</td></tr>}
                  {totals.map((t) => <tr key={t.label} className="tot"><td colSpan={doc.items.columns.length - 1} className="r" style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>{t.label}</td><td className="r" style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>{money(t.value)}</td></tr>)}
                </tbody>
              </table>
            )}
            {doc.footer && <div className="body" style={{ whiteSpace: 'pre-wrap', color: '#6b7280', fontSize: 11, marginTop: 14 }}>{fill(doc.footer, row)}</div>}
            {doc.signature && <div className="sig" style={{ marginTop: 48, display: 'flex', justifyContent: 'flex-end' }}><div style={{ textAlign: 'center', borderTop: '1px solid #9ca3af', paddingTop: 6, minWidth: 200 }}>{fill(doc.signature, row)}</div></div>}
          </div>
        </div>
      </div>
  );
  if (inline) return <div className="space-y-3"><p className="text-[15px] font-semibold text-ink">{fill(doc.title, row)}</p>{body}<div className="flex justify-end pt-2"><Button onClick={onClose}>Close</Button></div></div>;
  return <Modal isOpen={open} onClose={onClose} title={fill(doc.title, row)} size="lg">{body}</Modal>;
}