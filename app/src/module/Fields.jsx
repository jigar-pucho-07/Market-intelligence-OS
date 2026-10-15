// Fields — one renderer for every declared field (modal forms, stepper steps, drawer edits). Uses kernel `os-control` sizing.
// Layout: `columns: 2` lays fields two per row (a field with `span: 2` or a textarea takes the full row).
// Field kinds: text | textarea | select | date | number | panel | static | file. A `file` uploads to the app's own
// store (/api/files, sign-in only) and keeps the link; `name_to: <key>` also keeps the file's name. A `panel` is a titled box inside
// the form that reacts to another field — the "Regional territory routing" pattern: pick a State, the panel
// looks the matching Region_Mapping row up, shows Region / RM as badges, copies them into the payload and
// hosts its own fields (e.g. the auto-assigned rep, whose options are filtered by `options_where`).
// v4.9: `errors` ({ key: message }) renders each server message INLINE under its field (antd Form.Item validateStatus + help, the
// message element carries data-testid="field-error") and `onClearError(key)` is called when that field is edited. The entity's
// generated `field_rules` / `constraints` (os.config ENTITIES — absent on older OSes) shape the control: no_past disables past
// dates, one_of becomes a Select, type email/phone/gstin gets the right input + a soft hint (the server stays the authority),
// an `integer` number becomes the QuantityStepper, and `default` prefills a create form.
import { useT } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { uploadFile } from '../utils/api';
import { Input, InputNumber, Select, DatePicker, Button, Form } from 'antd';
import dayjs from 'dayjs';
import * as Icons from 'lucide-react';
import AudioRecorder from '../components/AudioRecorder';
import { where } from './formula';
import { ENTITIES } from '../config/os.config';
import { selectProps, pickerProps } from '../config/popup';
import { cn } from '../utils/cn';
import { humanize, labelOf } from '../utils/labels';
import QuantityStepper from '../components/ui/QuantityStepper';

// One upload: PDF or image, into the database (D6). The value is `/api/files/F-…`; a flow gets a 15-minute signed link
// to it when the action runs (lib/fileLinks.ts), never the bare path.
function FileField({ f, value, onPick }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setBusy(true); setErr('');
    try { const r = await uploadFile(file); onPick(r.url, file.name); } catch (x) { setErr(x.message || 'Upload failed'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-1.5" data-os-file={f.key}>
      <label className={cn('os-control os-file flex items-center gap-2.5 h-[var(--control-h)] px-3.5 rounded-lg border border-dashed border-[color:var(--hair-6)] bg-surface-2 cursor-pointer w-full min-w-0 hover:border-primary-400', busy && 'opacity-70 pointer-events-none')}>
        {busy ? <Icons.Loader2 className="w-4 h-4 animate-spin text-ink-3 shrink-0" /> : value ? <Icons.FileCheck2 className="w-4 h-4 text-ok-text shrink-0" /> : <Icons.Upload className="w-4 h-4 text-ink-3 shrink-0" />}
        <span className="text-[13.5px] truncate text-ink-2">{busy ? 'Uploading…' : value ? 'File attached — choose another to replace' : (f.placeholder ?? 'Choose a PDF or photo')}</span>
        <input id={`f-${f.key}`} type="file" accept={f.accept ?? 'application/pdf,image/*'} className="sr-only" onChange={pick} />
      </label>
      {value && <a href={value} target="_blank" rel="noopener noreferrer" className="text-[12px] text-primary-600 hover:underline">Open the attached file</a>}
      {err && <p className="text-[12px] text-bad-text">{err}</p>}
    </div>
  );
}

export function evalWhen(expr, values) { if (!expr) return true; return where([values], expr).length > 0; }
const fill = (tpl, values) => String(tpl ?? '').replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? ''));
export function optionsFor(f, data, entity, values) {
  if (f.options) return f.options.map((o) => ({ value: String(o), label: String(o) }));
  if (f.options_from) {
    const [ent, col] = f.options_from.split('.');
    let rows = data?.[ent] ?? [];
    if (f.options_where && values) { const clause = fill(f.options_where, values); rows = /=\s*$/.test(clause) ? rows : where(rows, clause); }
    return [...new Set(rows.map((r) => r[col]).filter(Boolean))].map((v) => ({ value: v, label: v }));
  }
  if (f.options_status && entity) return (ENTITIES[entity]?.status?.values ?? []).map((v) => ({ value: v, label: v }));
  return [];
}
/** Entities a modal (or any field list) needs loaded: options_from, panel lookups, builder catalogue / price / lines, document items. */
export function modalEntities(m, DOCS = {}) {
  const acc = new Set();
  const walk = (fs) => { for (const f of fs ?? []) { if (f.options_from) acc.add(f.options_from.split('.')[0]); if (f.lookup?.entity) acc.add(f.lookup.entity); if (f.fields) walk(f.fields); } };
  walk(m.fields);
  const L = m.lines ?? {}; for (const e of [L.pick?.entity, L.price?.entity, L.from?.entity]) if (e) acc.add(e);
  walk(L.fields);
  if (m.document && DOCS[m.document]) { acc.add(DOCS[m.document].entity); if (DOCS[m.document].items?.entity) acc.add(DOCS[m.document].items.entity); }
  return [...acc];
}
export function isRequired(f, values) { return f.required || (f.required_when && evalWhen(f.required_when, values)); }
export function flatFields(fields) { return (fields ?? []).flatMap((f) => (f.type === 'panel' ? flatFields(f.fields) : [f])); }
export function missingFields(fields, values) { return flatFields(fields).filter((f) => isRequired(f, values) && !String(values[f.key] ?? '').trim()); }
/** "Please fill: Customer company, Quantity" — the labels a person sees, never the column names. */
export const missingText = (miss, t) => `${t ? t('Please fill') : 'Please fill'}: ${miss.map((f) => labelOf(t, f.key, f.label)).join(', ')}`;


// ── v4.9 field rules (guarded: an OS generated before v4.9 has neither map) ──
export const fieldRule = (entity, key) => ENTITIES[entity]?.field_rules?.[key] ?? {};
export const fieldConstraint = (entity, key) => ENTITIES[entity]?.constraints?.[key] ?? {};
// "Today" is the BUSINESS's day, the one the server judges `no_past` / `today` in (lib/validate.ts: DB_TIMEZONE, default Asia/Kolkata) — never the
// browser's clock or zone. The server variable is not readable here, so a different zone is exposed to the client as NEXT_PUBLIC_DB_TIMEZONE.
const BIZ_TZ = (process.env.NEXT_PUBLIC_DB_TIMEZONE || 'Asia/Kolkata').replace(/[^A-Za-z0-9_/+-]/g, '');
/** The business's calendar date, `YYYY-MM-DD`, `plusDays` from today. */
export function bizToday(plusDays = 0) {
  let s; try { s = new Intl.DateTimeFormat('en-CA', { timeZone: BIZ_TZ }).format(new Date()); } catch { s = new Date().toISOString().slice(0, 10); }
  if (!plusDays) return s;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + plusDays)).toISOString().slice(0, 10);
}
const isRelative = (v) => v === 'today' || v === 'tomorrow';
/** A declared default as the form's first value: `{{user}}` = the signed-in person, `today` / `tomorrow` = that day in the business zone, else the literal. */
export function resolveDefault(v, user) {
  if (v === undefined || v === null) return '';
  if (v === '{{user}}') return user?.name ?? '';
  if (isRelative(v)) return bizToday(v === 'tomorrow' ? 1 : 0);
  return v;
}
const defaultOf = (f, entity, create = true) => f.default ?? (create ? fieldRule(entity, f.key).default : undefined);
/** The value a field starts with: the form's own `default`, else (on a create form) the entity rule's `default`.
 *  `defer: true` leaves a `today` / `tomorrow` default empty — use it in useState() so the server render and the first client render agree
 *  (they run on different clocks), and fill it after mount with useRelativeDefaults(). */
export function startValue(f, entity, user, { create = true, defer = false } = {}) {
  const d = defaultOf(f, entity, create);
  return defer && isRelative(d) ? '' : resolveDefault(d, user);
}
/** After mount, fill the `today` / `tomorrow` defaults that startValue(…, { defer: true }) left empty (never over something already entered). */
export function useRelativeDefaults(fields, entity, setValues, { create = true } = {}) {
  useEffect(() => {
    const patch = {};
    const walk = (fs) => { for (const f of fs ?? []) { if (f.type === 'panel') walk(f.fields); else if (f.key && isRelative(defaultOf(f, entity, create))) patch[f.key] = resolveDefault(defaultOf(f, entity, create)); } };
    walk(fields);
    if (Object.keys(patch).length) setValues((v) => { const out = { ...v }; for (const k of Object.keys(patch)) if (!out[k]) out[k] = patch[k]; return out; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival
}
const HINTS = {
  email: [(v) => /^\S+@\S+\.\S+$/.test(v), 'Enter a valid email address'],
  phone: [(v) => /^\+?\d{10,13}$/.test(v.replace(/[\s-]/g, '')), 'Enter a phone number with 10 to 13 digits'],
  gstin: [(v) => /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/i.test(v), 'A GSTIN has 15 characters, like 24ABCDE1234F1Z5'],
};
const INPUT_ATTRS = { email: { type: 'email', inputMode: 'email', autoComplete: 'email' }, phone: { type: 'tel', inputMode: 'tel', autoComplete: 'tel' }, gstin: { autoCapitalize: 'characters', maxLength: 15 } };

/** The row a panel's `lookup` resolves to: { entity, match, by } → first row where row[match] == values[by]. */
export function lookupRow(panel, values, data) {
  const l = panel.lookup; if (!l) return null;
  const v = values?.[l.by ?? l.match]; if (!v) return null;
  return (data?.[l.entity] ?? []).find((r) => String(r[l.match] ?? '') === String(v)) ?? null;
}

function Panel({ f, values, setValues, data, entity, recording, setRecording, row: record, errors, onClearError }) {
  const row = lookupRow(f, record ? { ...record, ...values } : values, data);
  const I = Icons[f.icon] || Icons.MapPin;
  // Copy the looked-up columns into the form values so they submit with the payload.
  useEffect(() => {
    if (!f.copy) return;
    const patch = {}; for (const c of f.copy) { const nv = row ? row[c] ?? '' : ''; if ((values[c] ?? '') !== nv) patch[c] = nv; }
    if (Object.keys(patch).length) setValues({ ...values, ...patch });
  }, [row]); // eslint-disable-line react-hooks/exhaustive-deps
  const tone = row ? (f.tone ?? 'brand') : 'neutral';
  const badge = (f.show ?? []).find((s) => s.badge);
  return (
    <section className={cn('rounded-[var(--r-12)] border p-4 space-y-3', row ? 'border-primary-200 bg-primary-50/40' : 'border-[color:var(--hair-6)] bg-surface-2')} data-os-panel={f.key ?? f.title}>
      <div className="flex items-center gap-2">
        <span className={cn('w-7 h-7 rounded-full inline-flex items-center justify-center', row ? 'bg-primary-100 text-primary-700' : 'bg-black/[0.05] text-ink-3')}><I className="w-3.5 h-3.5" /></span>
        <p className="text-[13px] font-semibold text-ink">{f.title}</p>
        {row && badge && <span className={`badge ml-auto ${tone === 'neutral' ? 'badge-neutral' : 'badge-brand'}`} data-os-detected>{fill(badge.label ?? '{v}', { ...row, v: row[badge.key] })}</span>}
      </div>
      {!row && <p className="text-[12px] text-ink-3">{f.empty ?? `Choose ${humanize(f.lookup?.by) || 'a value'} above to detect ${f.title?.toLowerCase() ?? 'details'}.`}</p>}
      {row && f.show?.filter((s) => !s.badge).length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {f.show.filter((s) => !s.badge).map((s) => <div key={s.key}><dt className="text-[11px] text-ink-3">{s.label ?? humanize(s.key)}</dt><dd className="text-[13px] font-medium text-ink truncate">{row[s.key] || '—'}</dd></div>)}
        </dl>
      )}
      {/* the panel's own fields appear once the lookup resolved — an empty "Salesperson" list before a state is chosen is noise (M5) */}
      {f.fields?.length > 0 && (row || !f.lookup || f.always) && <Fields fields={f.fields} values={values} setValues={setValues} data={data} entity={entity} recording={recording} setRecording={setRecording} columns={f.columns ?? 1} row={record} errors={errors} onClearError={onClearError} />}
      {row && f.note && <p className="text-[12px] text-ink-3">{fill(f.note, { ...row, ...values })}</p>}
    </section>
  );
}

export default function Fields({ fields, values, setValues, data, entity, recording, setRecording, columns = 1, row, errors = {}, onClearError }) {
  const t = useT();
  const [touched, setTouched] = useState({});
  const set = (k, v) => { onClearError?.(k); setValues({ ...values, [k]: v }); };
  const scope = row ? { ...row, ...values } : values;      // option filters and panels may read the record the form is about
  const visible = useMemo(() => (fields ?? []).filter((f) => !f.show_when || evalWhen(f.show_when, values)), [fields, values]);
  const full = (f) => f.span === 2 || f.type === 'textarea' || f.type === 'panel';
  return (
    <div className={columns === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4' : 'space-y-4'} data-os-fields>
      {visible.map((f) => {
        if (f.type === 'panel') return <div key={f.key ?? f.title} className={columns === 2 ? 'sm:col-span-2' : ''}><Panel f={f} values={values} setValues={setValues} data={data} entity={entity} recording={recording} setRecording={setRecording} row={row} errors={errors} onClearError={onClearError} /></div>;
        const rule = fieldRule(entity, f.key); const cons = fieldConstraint(entity, f.key);
        const vtype = HINTS[f.type] ? f.type : HINTS[rule.type] ? rule.type : null;                       // email | phone | gstin
        const asSelect = f.type === 'select' || (!!rule.one_of?.length && (!f.type || f.type === 'text'));
        const opts = asSelect ? (() => { const o = optionsFor(f, data, entity, scope); return o.length || !rule.one_of ? o : rule.one_of.map((v) => ({ value: String(v), label: String(v) })); })() : null;
        const asStepper = f.type === 'number' && (cons.integer || rule.integer);
        const err = errors[f.key]; const raw = String(values[f.key] ?? '');
        const hint = !err && vtype && touched[f.key] && raw.trim() && !HINTS[vtype][0](raw.trim()) ? HINTS[vtype][1] : '';
        const label = labelOf(t, f.key, f.label);
        const bad = err ? { 'aria-invalid': true } : {};
        return (
          <div key={f.key} className={cn('min-w-0', columns === 2 && full(f) && 'sm:col-span-2')} data-os-field={f.key} data-invalid={err ? 'true' : undefined}>
            <label htmlFor={`f-${f.key}`}>{label}{isRequired(f, values) && <span className="text-bad-text"> *</span>}</label>
            <Form.Item className="os-fi" validateStatus={err ? 'error' : hint ? 'warning' : undefined}
              help={err ? <span data-testid="field-error" role="alert">{err}</span> : hint ? <span data-testid="field-hint">{t(hint)}</span> : undefined}>
            {f.type === 'textarea' ? (
              <div className="space-y-2">
                {/* The one resizable control in a form: notes grow when the text does. */}
                <Input.TextArea id={`f-${f.key}`} {...bad} rows={f.rows ?? 4} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className="os-control os-textarea w-full" style={{ resize: 'vertical' }} />
                {f.voice && !recording && <Button size="small" icon={<Icons.Mic className="w-3.5 h-3.5" />} onClick={() => setRecording?.(true)}>{t('Record a voice note')}</Button>}
                {f.voice && recording && <AudioRecorder onCancel={() => setRecording(false)} onRecordingComplete={(b64) => { setValues({ ...values, [f.key]: values[f.key] || '(voice note attached)', [`${f.key}_audio`]: b64 }); setRecording(false); }} />}
              </div>
            ) : asSelect ? (
              <Select {...selectProps} id={`f-${f.key}`} className="os-control w-full" value={values[f.key] || undefined} placeholder={f.placeholder ?? `${t('Select')} ${label.toLowerCase()}`} options={opts} onChange={(v) => set(f.key, v)} showSearch={opts.length > 6} filterOption={(input, opt) => `${opt?.label ?? ''} ${opt?.value ?? ''}`.toLowerCase().includes(String(input).toLowerCase())} allowClear disabled={f.disabled_when ? evalWhen(f.disabled_when, values) : false} />
            ) : f.type === 'date' ? (
              <div className="space-y-2">
                {/* Presets ("+2d", "+1w", "+1m") set the date in one tap — the outcome sheet's "next follow-up" never needs the calendar. */}
                {f.presets?.length > 0 && <div className="flex flex-wrap gap-1.5" data-os-presets>{f.presets.map((p) => { const m = String(p).match(/^\+(\d+)([dwm])$/); const lbl = m ? `+${m[1]} ${{ d: m[1] === '1' ? 'day' : 'days', w: m[1] === '1' ? 'week' : 'weeks', m: m[1] === '1' ? 'month' : 'months' }[m[2]]}` : p === 'today' ? 'Today' : p === 'tomorrow' ? 'Tomorrow' : p; const val = () => { const d = dayjs(bizToday()); if (p === 'today') return d; if (p === 'tomorrow') return d.add(1, 'day'); return m ? d.add(Number(m[1]), { d: 'day', w: 'week', m: 'month' }[m[2]]) : null; }; const v = val(); const on = v && values[f.key] === v.format('YYYY-MM-DD'); return <button key={p} type="button" aria-pressed={on ? 'true' : 'false'} className="chip h-8 px-2.5 text-[12px]" onClick={() => v && set(f.key, v.format('YYYY-MM-DD'))}>{t(lbl)}</button>; })}</div>}
                <DatePicker {...pickerProps} id={`f-${f.key}`} {...bad} className="os-control w-full" format="DD MMM YYYY" value={values[f.key] ? dayjs(values[f.key]) : null} onChange={(d) => set(f.key, d ? d.format('YYYY-MM-DD') : '')}
                  disabledDate={rule.no_past ? (d) => !!d && d.format('YYYY-MM-DD') < bizToday() : undefined} />
              </div>
            ) : asStepper ? (
              <QuantityStepper id={`f-${f.key}`} aria-label={label} value={values[f.key]} onChange={(v) => set(f.key, v)} min={cons.min ?? (cons.positive ? 1 : undefined)} max={cons.max} step={rule.step ?? 1} />
            ) : f.type === 'number' ? (
              <InputNumber id={`f-${f.key}`} {...bad} className="os-control w-full" controls={false} value={values[f.key] === '' ? null : values[f.key]} onChange={(v) => set(f.key, v ?? '')} placeholder={f.placeholder} prefix={f.prefix} suffix={f.suffix} />
            ) : f.type === 'file' ? (
              <FileField f={f} value={values[f.key]} onPick={(url, name) => setValues({ ...values, [f.key]: url, ...(f.name_to ? { [f.name_to]: values[f.name_to] || name } : {}) })} />
            ) : f.type === 'static' ? (
              <div className="os-control-static h-10 px-3.5 rounded-lg bg-surface-2 border border-[color:var(--hair-6)] inline-flex items-center w-full text-[14px] text-ink tabular" data-os-static={f.key}>{fill(f.value ?? '{' + f.key + '}', values) || '—'}</div>
            ) : (
              <Input id={`f-${f.key}`} {...bad} {...(vtype ? INPUT_ATTRS[vtype] : {})} className="os-control w-full" value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} onBlur={vtype ? () => setTouched((x) => ({ ...x, [f.key]: true })) : undefined} placeholder={f.placeholder} prefix={f.prefix} />
            )}
            </Form.Item>
            {f.help && <p className="text-xs text-ink-3 mt-1">{t(f.help)}</p>}
          </div>
        );
      })}
    </div>
  );
}
