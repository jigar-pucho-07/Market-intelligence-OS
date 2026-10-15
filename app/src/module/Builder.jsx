// Builder — a modal for documents made of LINE ITEMS: a quotation, a proforma, an order, a BOM.
// Declared in os.yaml as `kind: builder`. It is the third form shape in the kernel next to the plain
// field form and the stepper, because "pick a catalogue row → its details and price fill in → edit
// specs → quantity × price → discount → rounded total → PDF" is one pattern every machinery,
// trading and services OS needs, and a plain field form cannot express it.
//
//   - id: quote, kind: builder, title: Generate quotation, flow: QUOTATION, action: draft, document: quotation_doc
//     summary: [Customer_Name, Company, City]                  # read-only panel from the source row (the lead)
//     pass: [Lead_ID, Customer_Name, Company, City, State]      # copied into the payload
//     fields: [ { key: Valid_Until, type: date }, { key: Prepared_By, type: select, options_from: team_members.Name } ]
//     lines:
//       label: Machine line items
//       from: { entity: quotation_items, by: Quotation_No }    # edit mode: existing lines of the row
//       pick: { label: Machine / series, entity: machine_models, key: Series_Code, label_column: Series_Title, where: "Active=true" }
//       fill: { Description: Series_Title, Model: Model, Capacity: Capacity, Controller: Controller, Specs: Specs }
//       price: { entity: price_list, key: Series_Code, column: Price_INR, where: "Active=true", fallback: Base_Price_INR }
//       fields: [ { key: Model }, { key: Capacity }, { key: Controller }, { key: Axis_Crowning, type: select, options: [...] } ]
//       specs: { key: Specs, label: Technical specifications }   # "Label: value; Label: value" — editable rows, collapsed
//       quantity: Quantity, unit_price: Unit_Price_INR, line_total: Line_Total_INR
//       item_action: update_item                                 # edit mode: one call per existing line before the main action
//     totals: { subtotal: Subtotal_INR, discount: Discount_Pct, discount_amount: Discount_INR, rounding: 100, total: Total_INR, note: "Ex-Works Sanand + GST 18% applicable" }
//     notes: { key: Notes, label: Terms & notes }
//     submit: Generate quotation PDF
// Rule zero: every number on screen is computed here from the lines; nothing is typed twice.
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, InputNumber, Select, Tooltip } from 'antd';
import { Plus, Trash2, ChevronDown, FileText, Check } from 'lucide-react';
import { toast } from 'sonner';
import Fields, { missingFields, missingText, optionsFor } from './Fields';
import { useFieldErrors, focusField } from './fieldErrors';
import { useT } from '../i18n';
import { humanize } from '../utils/labels';
import DocumentPreview from './DocumentPreview';
import WorkingState from '../components/WorkingState';
import { AnimatePresence } from 'framer-motion';
import { ENTITIES, DOCUMENTS } from '../config/os.config';
import { runAction, callWorkflow } from '../utils/api';
import { where, formatValue } from './formula';
import { selectProps } from '../config/popup';
import { cn } from '../utils/cn';
import { useAuth } from '../context/AuthContext';

const money = (n) => formatValue(Number(n) || 0, 'money');
export const parseSpecs = (s) => String(s ?? '').split(/;\s*|\n/).map((x) => x.trim()).filter(Boolean).map((x) => {
  const i = x.indexOf(':'); if (i > 0) return { k: x.slice(0, i).trim(), v: x.slice(i + 1).trim() };
  const m = x.match(/^(.*?\S)\s+(\d[\s\S]*)$/); return m ? { k: m[1], v: m[2] } : { k: x, v: '' };
});
export const joinSpecs = (rows) => rows.filter((r) => r.k.trim()).map((r) => `${r.k.trim()}: ${r.v.trim()}`).join('; ');
const numberInput = { formatter: (v) => String(v ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ','), parser: (v) => String(v).replace(/[^\d.]/g, '') };

function Static({ label, value, strong }) {
  return <div><p className="text-[11px] text-ink-3 mb-1">{label}</p><div className={cn('h-10 px-3.5 rounded-lg bg-white border border-black/[0.08] inline-flex items-center w-full text-[14px] tabular text-ink', strong && 'font-semibold')}>{value}</div></div>;
}

export default function Builder({ spec, row, data, onClose, onDone }) {
  const L = spec.lines ?? {}; const T = spec.totals ?? {};
  const qtyK = L.quantity ?? 'Quantity', priceK = L.unit_price ?? 'Unit_Price_INR', totalK = L.line_total ?? 'Line_Total_INR', specK = L.specs?.key ?? 'Specs';
  const catalogue = useMemo(() => where(data?.[L.pick?.entity] ?? [], L.pick?.where), [data, L.pick]);
  const ent = ENTITIES[spec.entity]; const idc = ent?.id?.column;
  // The record being built (a quotation) is usually not the page's entity (the lead): it is the document's entity, or `target:`.
  const targetName = spec.target ?? DOCUMENTS[spec.document]?.entity ?? spec.entity; const target = ENTITIES[targetName] ?? ent; const tid = target?.id?.column;
  const edit = !!(L.from && row && row[L.from.by ?? idc] !== undefined && (data?.[L.from.entity] ?? []).some((it) => it[L.from.by] === row[idc]));
  const existing = useMemo(() => (edit ? (data[L.from.entity] ?? []).filter((it) => it[L.from.by] === row[idc]) : []), [edit, data, L.from, row, idc]);

  const { user } = useAuth(); const t = useT(); const fe = useFieldErrors();
  const dflt = (v) => (v === '{{user}}' ? (user?.name ?? '') : v);        // `default: "{{user}}"` = the signed-in person
  const [values, setValues] = useState({});
  const [lines, setLines] = useState([]);
  const [open, setOpen] = useState({});
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  // Price lookup: price list row for the code (latest effective, active) else the catalogue's fallback column.
  const priceFor = (code, cat) => {
    if (L.price?.entity) {
      const rows = where(data?.[L.price.entity] ?? [], L.price.where).filter((r) => r[L.price.key] === code);
      const pick = rows.sort((a, b) => String(b.Effective_From ?? '').localeCompare(String(a.Effective_From ?? '')))[0];
      if (pick) return Number(pick[L.price.column]) || 0;
    }
    return Number(cat?.[L.price?.fallback ?? 'Base_Price_INR']) || 0;
  };
  const blank = () => ({ id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, code: '', fields: {}, specs: [], qty: 1, price: 0 });
  const fromCatalogue = (l, code) => {
    const cat = catalogue.find((c) => c[L.pick.key] === code); if (!cat) return { ...l, code };
    const fields = { ...l.fields }; for (const [k, src] of Object.entries(L.fill ?? {})) fields[k] = cat[src] ?? '';
    return { ...l, code, fields, specs: parseSpecs(fields[specK] ?? cat[specK] ?? ''), price: priceFor(code, cat) };
  };

  useEffect(() => {
    const init = {}; for (const f of spec.fields ?? []) init[f.key] = row?.[f.key] || dflt(f.default) || '';
    for (const f of spec.fields ?? []) if (String(init[f.key] ?? '').startsWith('+') && f.type === 'date') { const d = new Date(); d.setDate(d.getDate() + parseInt(init[f.key], 10)); init[f.key] = d.toISOString().slice(0, 10); }
    setValues(init);
    setDiscount(Number(row?.[T.discount ?? 'Discount_Pct']) || 0);
    setNotes(row?.[spec.notes?.key ?? 'Notes'] ?? spec.notes?.default ?? '');
    if (edit) setLines(existing.map((it) => ({ id: it[ENTITIES[L.from.entity]?.id?.column ?? 'Item_ID'], code: it[L.pick?.key] ?? '', fields: Object.fromEntries((L.fields ?? []).map((f) => [f.key, it[f.key] ?? ''])), specs: parseSpecs(it[specK]), qty: Number(it[qtyK]) || 1, price: Number(it[priceK]) || 0, desc: it.Description })));
    else { const first = blank(); const pre = row?.[L.pick?.key] && catalogue.some((c) => c[L.pick.key] === row[L.pick.key]) ? fromCatalogue(first, row[L.pick.key]) : first; setLines([pre]); }
  }, [spec.id, row?.[idc], catalogue.length, existing.length]); // eslint-disable-line react-hooks/exhaustive-deps -- keyed on identity (the page re-creates `spec` every render) and re-run once the catalogue / existing lines arrive

  const upd = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const updField = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, fields: { ...l.fields, [k]: v } } : l)));
  const updSpec = (i, k, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, specs: l.specs.map((s, x) => (x === k ? { ...s, ...patch } : s)) } : l)));
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const discountAmt = Math.round(subtotal * (discount / 100));
  const rounding = T.rounding ?? 1;
  const total = Math.round((subtotal - discountAmt) / rounding) * rounding;
  const descOf = (l) => l.fields.Description || l.desc || catalogue.find((c) => c[L.pick.key] === l.code)?.[L.pick.label_column] || l.code;

  const composed = () => {
    const head = { ...(spec.context ?? {}), ...(row ? Object.fromEntries((spec.pass ?? []).map((k) => [k, row[k]])) : {}), ...values };
    if (edit && idc) head[idc] = row[idc];
    const items = lines.map((l, i) => ({ [L.pick?.key ?? 'Code']: l.code, Description: descOf(l), ...l.fields, [specK]: joinSpecs(l.specs), [qtyK]: l.qty, [priceK]: l.price, [totalK]: l.qty * l.price, _id: l.id, _index: i + 1 }));
    const first = lines[0] ? { [L.pick?.key ?? 'Code']: lines[0].code, Description: descOf(lines[0]), ...Object.fromEntries(Object.entries(lines[0].fields).filter(([k]) => target?.columns?.includes(k))) } : {};
    const tpl = (v) => String(v ?? '').replace(/\{(\w+)\}/g, (_, k) => String(items[0]?.[k] ?? head[k] ?? ''));
    const set = Object.fromEntries(Object.entries(spec.fill ?? {}).map(([k, v]) => [k, tpl(v)]));   // fill: { Machine_Series: "{Description}" }
    return { ...head, ...first, ...set, lines: items, [T.subtotal ?? 'Subtotal_INR']: subtotal, [T.discount ?? 'Discount_Pct']: discount, [T.discount_amount ?? 'Discount_INR']: discountAmt, [T.total ?? 'Total_INR']: total, [qtyK]: lines.reduce((s, l) => s + l.qty, 0), [priceK]: lines[0]?.price ?? 0, [spec.notes?.key ?? 'Notes']: notes };
  };

  const submit = async () => {
    const miss = missingFields(spec.fields, values); if (miss.length) { focusField(miss[0].key); return toast.error(missingText(miss, t)); }
    fe.reset();
    if (!lines.length || lines.some((l) => !l.code)) return toast.error(`Choose a ${L.pick?.label?.toLowerCase() ?? 'catalogue item'} on every line`);
    setBusy(true);
    try {
      const payload = composed();
      if (edit && L.item_action) for (const it of payload.lines) if (!String(it._id).startsWith('new-')) await callWorkflow(spec.flow, L.item_action, { [ENTITIES[L.from.entity]?.id?.column ?? 'Item_ID']: it._id, [L.from.by]: row[idc], ...Object.fromEntries(Object.entries(it).filter(([k]) => !k.startsWith('_'))) });
      const res = await runAction(spec, payload);
      const id = res?.[tid] ?? (edit ? row[tid] : undefined) ?? `${target?.id?.prefix ?? ''}DRAFT`;
      // The line items are written by whoever owns the action: the wired flow, or the app's own effect (`lines:` in FLOW_ACTIONS) — never twice.
      toast.success(spec.success ?? `${spec.title} done`);
      onDone?.(res);
      if (spec.document && DOCUMENTS[spec.document]) setDone({ row: { ...(edit ? row : {}), ...(target?.created && !edit ? { [target.created]: new Date().toISOString() } : {}), ...payload, [tid]: id }, items: payload.lines.map((it) => ({ ...it, [L.from?.by ?? tid]: id })) });
      else onClose();
    } catch (e) {
      if (e.code === 'NOT_WIRED') toast.error(t('This workflow is not connected yet'));
      else { const { rest } = fe.apply(e, spec.fields); if (rest) toast.error(rest); }   // v4.9 C2: a refused header field shows inline; a line-level or non-field error is a toast
    }
    finally { setBusy(false); }
  };

  if (done) {
    const docEnt = DOCUMENTS[spec.document].items?.entity;
    return (
      <div className="space-y-4" data-os-builder-done>
        <div className="rounded-xl bg-ok-soft text-ok-text px-4 py-3 text-[13px] font-medium inline-flex items-center gap-2"><Check className="w-4 h-4" /> {spec.success ?? 'Saved'} — preview and print below.</div>
        <DocumentPreview docId={spec.document} row={done.row} data={{ ...data, ...(docEnt ? { [docEnt]: done.items } : {}) }} open inline onClose={onClose} />
      </div>
    );
  }

  const pickOptions = catalogue.map((c) => ({ value: c[L.pick.key], label: c[L.pick.label_column ?? L.pick.key] }));
  return (
    <div className="os-form space-y-5 w-full" data-os-form data-os-builder data-os-columns={2}>
      {row && spec.summary?.length > 0 && (
        <div className="rounded-xl bg-surface-2 border border-[color:var(--hair-5)] p-4 grid grid-cols-2 sm:grid-cols-4 gap-3" data-os-summary>
          {spec.summary.map((k) => <div key={k} className="min-w-0"><p className="text-[11px] text-ink-3">{t(humanize(k))}</p><p className="font-medium text-ink text-[13px] truncate">{row[k] || '—'}</p></div>)}
        </div>
      )}
      {spec.fields?.length > 0 && <Fields fields={spec.fields} values={values} setValues={setValues} data={data} entity={spec.entity} columns={2} errors={fe.errors} onClearError={fe.clear} />}

      <section className="space-y-3" data-os-lines>
        <div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-ink">{L.label ?? 'Line items'}</p><span className="text-[12px] text-ink-3">{lines.length} {lines.length === 1 ? 'item' : 'items'}</span></div>
        {lines.map((l, i) => (
          <div key={l.id} className="rounded-xl border border-[color:var(--hair-6)] bg-surface-2 p-4 space-y-3" data-os-line={i + 1}>
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-black/[0.05] text-ink-2 text-[12px] font-semibold inline-flex items-center justify-center shrink-0 mt-6">{i + 1}</span>
              <div className="min-w-0 flex-1" data-os-field="pick">
                <label>{L.pick?.label ?? 'Item'} <span className="text-bad-text">*</span></label>
                <Select {...selectProps} className="os-control w-full" value={l.code || undefined} placeholder={`Select ${(L.pick?.label ?? 'item').toLowerCase()}`} options={pickOptions} showSearch optionFilterProp="label" onChange={(v) => upd(i, fromCatalogue(l, v))} />
              </div>
              {lines.length > 1 && <Tooltip title="Remove line"><button type="button" className="no-pill w-9 h-9 mt-6 rounded-[var(--r-8)] inline-flex items-center justify-center text-ink-3 hover:text-bad-text hover:bg-bad-soft transition-colors shrink-0" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button></Tooltip>}
            </div>
            {L.fields?.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {L.fields.map((f) => (
                  <div key={f.key} data-os-field={f.key}>
                    <label>{t(f.label ?? humanize(f.key))}</label>
                    {f.type === 'select' ? <Select {...selectProps} className="os-control w-full" value={l.fields[f.key] || undefined} options={optionsFor(f, data, spec.entity, l.fields)} placeholder={f.placeholder ?? 'Select'} onChange={(v) => updField(i, f.key, v)} allowClear />
                      : <Input className="os-control w-full" value={l.fields[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => updField(i, f.key, e.target.value)} disabled={f.readonly} />}
                  </div>
                ))}
              </div>
            )}
            {L.specs && (
              <div className="rounded-lg bg-white border border-[color:var(--hair-6)]">
                <button type="button" className="no-pill w-full flex items-center gap-2 px-3 py-2.5 text-left" onClick={() => setOpen({ ...open, [l.id]: !open[l.id] })} aria-expanded={!!open[l.id]}>
                  <ChevronDown className={cn('w-4 h-4 text-ink-4 transition-transform', !open[l.id] && '-rotate-90')} />
                  <span className="text-[12px] font-medium text-ink-2">{L.specs.label ?? 'Specifications'}</span>
                  <span className="badge badge-neutral ml-auto">{l.specs.length} fields</span>
                </button>
                {open[l.id] && (
                  <div className="px-3 pb-3 space-y-2" data-os-specs>
                    {l.specs.map((s, k) => (
                      <div key={k} className="grid grid-cols-[minmax(0,2fr)_auto_minmax(0,3fr)_auto] items-center gap-2">
                        <Input className="os-control w-full" value={s.k} placeholder="Label" onChange={(e) => updSpec(i, k, { k: e.target.value })} aria-label={`Spec ${k + 1} label`} />
                        <span className="text-ink-3 text-[13px]">:</span>
                        <Input className="os-control w-full" value={s.v} placeholder="Value" onChange={(e) => updSpec(i, k, { v: e.target.value })} aria-label={`Spec ${k + 1} value`} />
                        <Tooltip title="Remove spec"><button type="button" className="no-pill w-9 h-9 rounded-[var(--r-8)] inline-flex items-center justify-center text-ink-3 hover:text-bad-text hover:bg-bad-soft transition-colors" aria-label="Remove spec" onClick={() => upd(i, { specs: l.specs.filter((_, j) => j !== k) })}><Trash2 className="w-4 h-4" /></button></Tooltip>
                      </div>
                    ))}
                    <button type="button" className="btn-ghost -ml-2 text-[13px] text-primary-600" onClick={() => upd(i, { specs: [...l.specs, { k: '', v: '' }] })}><Plus className="w-3.5 h-3.5" /> Add specification</button>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div data-os-field={qtyK}><p className="text-[11px] text-ink-3 mb-1">Quantity</p><InputNumber className="os-control w-full" min={1} controls={false} value={l.qty} onChange={(v) => upd(i, { qty: Number(v) || 1 })} /></div>
              <div data-os-field={priceK}><p className="text-[11px] text-ink-3 mb-1">Unit price (₹)</p><InputNumber className="os-control w-full" min={0} step={1000} controls={false} value={l.price} onChange={(v) => upd(i, { price: Number(v) || 0 })} {...numberInput} /></div>
              <Static label="Line total (₹)" value={money(l.qty * l.price)} strong />
            </div>
          </div>
        ))}
        <button type="button" className="btn-ghost -ml-2 text-[13px] text-primary-600" onClick={() => setLines([...lines, blank()])} data-os-add-line><Plus className="w-3.5 h-3.5" /> Add another {(L.pick?.label ?? 'item').toLowerCase().split(' / ')[0]}</button>
      </section>

      <section className="rounded-xl border border-[color:var(--hair-6)] bg-surface-2 p-4" data-os-discount>
        <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-ink-3 mb-3">Discount & rounding</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><p className="text-[11px] text-ink-3 mb-1">Discount (%)</p><InputNumber className="os-control w-full" min={0} max={T.max_discount ?? 50} controls={false} value={discount} onChange={(v) => setDiscount(Number(v) || 0)} /></div>
          <Static label="Discount amount (₹)" value={`− ${money(discountAmt)}`} />
          <Static label={`Rounded to nearest ₹${rounding}`} value={money(total)} strong />
        </div>
      </section>

      <section className="rounded-xl border border-[color:var(--hair-6)] p-4 space-y-2" data-os-totals>
        <div className="flex items-center justify-between text-[13px]"><span className="text-ink-2">Subtotal ({lines.length} {lines.length === 1 ? 'item' : 'items'})</span><span className="font-semibold tabular text-ink">{money(subtotal)}</span></div>
        {discountAmt > 0 && <div className="flex items-center justify-between text-[13px]"><span className="text-ink-2">Discount {discount}%</span><span className="tabular text-ink">− {money(discountAmt)}</span></div>}
        <div className="flex items-center justify-between border-t border-[color:var(--hair-5)] pt-2"><div><p className="text-[13px] text-ink-2">{T.label ?? 'Rounded final total'}</p>{T.note && <p className="text-[12px] text-primary-600">{T.note}</p>}</div><span className="text-[24px] font-semibold tabular text-ink" data-os-total>{money(total)}</span></div>
      </section>

      {spec.notes && (
        <div data-os-field={spec.notes.key ?? 'Notes'}>
          <label>{spec.notes.label ?? 'Notes'}</label>
          <Input.TextArea rows={spec.notes.rows ?? 3} value={notes} onChange={(e) => setNotes(e.target.value)} className="os-control os-textarea w-full" style={{ resize: 'vertical' }} placeholder={spec.notes.placeholder} />
        </div>
      )}
      <AnimatePresence>{busy && <WorkingState spec={spec} active={busy} />}</AnimatePresence>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-[color:var(--hair-5)]">
        <Button onClick={onClose} disabled={busy}>{t('Cancel')}</Button>
        <Button type="primary" size="large" loading={busy} onClick={submit} icon={<FileText className="w-4 h-4" />} data-os-submit>{busy ? (spec.pending ?? 'Working…') : (spec.submit ?? (edit ? 'Save changes' : 'Generate'))}</Button>
      </div>
    </div>
  );
}
