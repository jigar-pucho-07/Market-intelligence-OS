// record.js — how a record names itself. An entity may declare `title: Customer_Name` and `subtitle: [Company]`;
// otherwise the first column that looks like a name is used, never the collection name (the audit's C2:
// a drawer headed "leads"). The same answer feeds the drawer, the detail header, the queue and search results.
const NAMEY = /name|title|customer|company|subject|series_title|state|rep\b/i;

export function titleColumn(ent, spec) {
  if (spec?.title_column) return spec.title_column;
  if (spec?.title && typeof spec.title === 'string' && ent?.columns?.includes(spec.title)) return spec.title;
  if (ent?.title) return ent.title;
  const cols = ent?.columns ?? []; const idc = ent?.id?.column;
  return cols.find((c) => c !== idc && NAMEY.test(c)) ?? cols.find((c) => c !== idc) ?? idc;
}
export function titleOf(row, ent, spec) {
  const c = titleColumn(ent, spec); const v = row?.[c];
  return (v !== undefined && v !== null && String(v).trim() !== '') ? String(v) : (row?.[ent?.id?.column] ?? '');
}
export function subtitleOf(row, ent, spec) {
  const cols = spec?.subtitle ?? ent?.subtitle ?? [];
  return cols.map((c) => row?.[c]).filter((v) => v !== undefined && v !== null && String(v).trim() !== '').join(' · ');
}
