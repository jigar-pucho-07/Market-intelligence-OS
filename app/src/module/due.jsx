// due.js — ONE reading of "when is this record due", shared by cards, the board, the drawer header, table cells,
// the Today queue and the KPI dictionary. An entity declares it once:
//   due: { column: Next_Followup_At, closed: "Status in [Won, Lost]" }
// and every surface shows the same chip: `Overdue 18d` (danger) · `Today` (warning) · `Tomorrow` / `Fri 26 Sep`
// (neutral) · nothing when the record is closed or has no date. The audit's C3: an 18-day-overdue lead was
// invisible on the board because only the table cell knew about the date.
import { differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns';
import { toDate, where } from './formula';

export function dueOf(row, ent) {
  const d = ent?.due; if (!d || !row) return null;
  if (d.closed && where([row], d.closed).length) return { kind: 'closed' };
  const date = toDate(row[d.column]); if (!date) return { kind: 'none' };
  const today = startOfDay(new Date()); const days = differenceInCalendarDays(startOfDay(date), today);
  if (days < 0) return { kind: 'overdue', days: -days, date, label: `Overdue ${-days}d`, tone: 'bad' };
  if (isSameDay(date, today)) return { kind: 'today', days: 0, date, label: 'Today', tone: 'warn' };
  if (days === 1) return { kind: 'soon', days, date, label: 'Tomorrow', tone: 'neutral' };
  return { kind: days <= 7 ? 'soon' : 'later', days, date, label: format(date, days <= 7 ? 'EEE d MMM' : 'd MMM'), tone: 'neutral' };
}

/** Sort key: overdue first (most overdue on top), then today, then by date; undated and closed last. */
export function dueOrder(row, ent) {
  const s = dueOf(row, ent); if (!s || s.kind === 'closed' || s.kind === 'none') return Number.MAX_SAFE_INTEGER;
  return s.date.getTime();
}

const BADGE = { bad: 'badge-danger', warn: 'badge-warning', neutral: 'badge-neutral' };
export function DueChip({ row, ent, className = '', prefix }) {
  const s = dueOf(row, ent);
  if (!s || s.kind === 'closed' || s.kind === 'none') return null;
  return <span className={`badge ${BADGE[s.tone]} tabular ${className}`} data-os-due={s.kind} title={format(s.date, 'dd MMM yyyy')}>{prefix}{s.label}</span>;
}
