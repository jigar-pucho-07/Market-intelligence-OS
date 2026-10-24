'use client';
// PipelinePdf — the Pipeline page's top half for the Export PDF (os.yaml pipeline `export.section: PipelinePdf`, 24 Oct 2026):
// the latest run (date, status, trigger), the 8 workflow steps with their state, the two safety nets and the workflow
// configuration. Same content as PipelineMap (both read ./lib/pipeline.js); inline styles only, so print looks the same in
// light and dark mode. Rendered by the kernel's ListPdf above its tiles and table; `rows` = every report, newest run first.
import { useMemo } from 'react';
import { pipelineModel } from './lib/pipeline';
import { BRAND } from '../config/os.config';

const TONE = { ok: ['#E7F6EF', '#0B6B4F'], warn: ['#FEF3E2', '#92590A'], bad: ['#FDECEC', '#B42318'], info: ['#E8F1FD', '#1D4ED8'], neutral: ['#F1F3F5', '#4B5563'] };
const statusTone = (s) => (/fail/i.test(s) ? 'bad' : /sent/i.test(s) ? 'ok' : /ready/i.test(s) ? 'info' : 'neutral');

const H = ({ children }) => <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#111827', margin: '0 0 8px' }}>{children}</div>;
const State = ({ tone, children }) => { const [, fg] = TONE[tone] ?? TONE.neutral; return (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: fg, marginTop: 'auto' }}>
    <span style={{ width: 7, height: 7, borderRadius: 999, background: fg, display: 'inline-block', flex: '0 0 auto' }} />{children}</div>); };

export default function PipelinePdf({ rows }) {
  const m = useMemo(() => pipelineModel(rows), [rows]);
  const C = BRAND.color;
  const card = { border: '1px solid #E5E7EB', borderRadius: 10, padding: '9px 11px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 5, breakInside: 'avoid', minHeight: 86 };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#111827' }}>Latest run</span>
        {m.header ? <>
          <span style={{ fontSize: 12, color: '#111827', fontWeight: 700 }}>{m.header.date}</span>
          <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: TONE[statusTone(m.header.status)][0], color: TONE[statusTone(m.header.status)][1] }}>{m.header.status}</span>
          {m.header.trigger && <span style={{ fontSize: 11, color: '#6B7280' }}>Triggered by {m.header.trigger}</span>}
        </> : <span style={{ fontSize: 11, color: '#6B7280' }}>No run recorded yet — the first one starts at 06:00 IST on a weekday.</span>}
      </div>
      {m.simulated && <div style={{ border: '1px solid #F5D9A8', background: '#FEF3E2', color: '#92590A', borderRadius: 8, padding: '6px 10px', fontSize: 10.5, marginBottom: 10 }}>This run was simulated — no source was fetched and nothing was sent.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
        {m.steps.map((s) => (
          <div key={s.key} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, background: C, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{s.step}</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>{s.title}</span>
            </div>
            <div style={{ fontSize: 9.5, color: '#6B7280', lineHeight: 1.4 }}>{s.sub}</div>
            {s.sources && s.sources.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '2px 0' }}>
                {s.sources.map((x) => (
                  <div key={x.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 9.5 }}>
                    <span style={{ color: '#374151' }}><span style={{ width: 5, height: 5, borderRadius: 999, background: (TONE[x.tone] ?? TONE.neutral)[1], display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }} />{x.name}</span>
                    {x.figure && <span style={{ color: x.tone === 'warn' ? '#92590A' : '#6B7280', fontWeight: 700, whiteSpace: 'nowrap' }}>{x.figure}</span>}
                  </div>))}
              </div>
            )}
            {s.note && <div style={{ fontSize: 9.5, color: '#B42318' }}>{s.note}</div>}
            <State tone={s.tone}>{s.state}</State>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {m.branches.map((b) => (
          <div key={b.key} style={{ ...card, minHeight: 0, border: '1px dashed #C7CDD4', background: '#FCFCFD' }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>{b.title}</span>
            <div style={{ fontSize: 9.5, color: '#6B7280' }}>{b.sub}</div>
            <State tone={b.tone}>{b.state}</State>
          </div>))}
      </div>

      <H>Workflow configuration</H>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        {m.config.map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', gap: 10, padding: '6px 11px', background: Math.floor(i / 2) % 2 ? '#F9FAFB' : '#fff', borderTop: i > 1 ? '1px solid #EEF0F2' : 'none' }}>
            <span style={{ flex: '0 0 38%', fontSize: 9.5, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', paddingTop: 1 }}>{k}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#111827' }}>{v}</span>
          </div>))}
      </div>
    </div>
  );
}
