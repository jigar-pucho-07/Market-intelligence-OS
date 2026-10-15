import { selectProps } from '../config/popup';
import { useNarrow } from '../hooks/useNarrow';
import { useEffect, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Select, Tooltip } from 'antd';
import { useT } from '../i18n';
import { humanize, fillT } from '../utils/labels';
import { motion } from 'framer-motion';
import { D, E, prefersReducedMotion } from '../config/motion';
import { cn } from '../utils/cn';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useRevealStagger } from '../hooks/useGsapMotion';

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200];

export default function DataTable({
  data,
  columns,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  loading = false,
  emptyMessage = 'No data found',
  onRowClick,
  searchValue,
  onSearchChange,
  pager = true,        // false: every row on one page and no footer (grouped views, short lists)
  cards = false,       // true: always the stacked card layout (a drawer's related rows), not only on phones
  selectable = false,  // row checkboxes; `selected` (Set of ids) + `onSelect(set)` + `rowId(row)` drive a bulk bar outside
  selected, onSelect, rowId,
  sticky = true,       // the first column stays put while a wide table scrolls sideways (H1)
}) {
  const t = useT();
  const [sorting, setSorting] = useState([]);
  const idOf = rowId ?? ((r) => r.id ?? JSON.stringify(r));
  const toggle = (r) => { if (!onSelect) return; const s = new Set(selected ?? []); const k = idOf(r); s.has(k) ? s.delete(k) : s.add(k); onSelect(s); };
  const pageRows = () => table.getRowModel().rows.map((r) => r.original);
  const allOn = () => { const rows = pageRows(); return rows.length > 0 && rows.every((r) => selected?.has(idOf(r))); };
  const toggleAll = () => { if (!onSelect) return; const s = new Set(selected ?? []); const on = allOn(); for (const r of pageRows()) on ? s.delete(idOf(r)) : s.add(idOf(r)); onSelect(s); };
  // Below 640px rows render as cards: a table never scrolls sideways on a phone (gate: ui_check --mobile)
  const narrowVp = useNarrow();
  const narrow = cards || narrowVp;

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: pager ? pageSize : Math.max(data.length, 1) } },
  });

  useEffect(() => { if (!pager) table.setPageSize(Math.max(data.length, 1)); }, [pager, data.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const tbodyRef = useRevealStagger(
    [data, pageIndex, currentPageSize, sorting],
    { y: 10, stagger: 0.03, duration: 0.35, selector: 'tr' }
  );

  return (
    <div className="overflow-hidden">
      {onSearchChange && (
        <div className="p-4 border-b border-surface-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-secondary border border-surface-border rounded-full text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-500" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-ink-4" strokeWidth={1.5} />
            </div>
            <p className="text-base font-semibold text-text-primary">{t(emptyMessage)}</p>
          </div>
        ) : narrow ? (
          <div ref={tbodyRef} className="divide-y divide-surface-border" data-os-cards>
            {table.getRowModel().rows.map((row) => {
              const cells = row.getVisibleCells();
              const actions = cells.filter((c) => c.column.id === '_actions');
              const data = cells.filter((c) => c.column.id !== '_actions');
              const [head, ...rest] = data;
              return (
                <div key={row.id} data-os-card onClick={() => onRowClick?.(row.original)} className={cn('p-4 space-y-2', onRowClick && 'cursor-pointer active:bg-primary-50/60')}>
                  {head && <div className="text-[14px] font-semibold text-text-primary min-w-0 break-words">{flexRender(head.column.columnDef.cell, head.getContext())}</div>}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {rest.map((cell) => (
                      <div key={cell.id} className="min-w-0">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-ink-3 truncate">{typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : humanize(cell.column.id)}</dt>
                        <dd className="text-[13px] text-text-primary min-w-0 break-words [&_*]:max-w-full">{flexRender(cell.column.columnDef.cell, cell.getContext())}</dd>
                      </div>
                    ))}
                  </dl>
                  {actions.length > 0 && <div className="flex justify-end -mr-2 pt-1" onClick={(e) => e.stopPropagation()}>{actions.map((c) => <div key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</div>)}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <table className={cn('w-full text-left', sticky && 'os-sticky-first')} data-os-selectable={selectable ? 'true' : undefined}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-black/[0.07]">
                  {selectable && <th className="pl-4 pr-1 py-3 w-8"><input type="checkbox" aria-label={t('Select all rows on this page')} className="os-check" checked={allOn()} onChange={toggleAll} /></th>}
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        'px-4 py-3 text-[12px] font-medium uppercase tracking-[0.04em] text-ink-3 whitespace-nowrap',
                        header.column.getCanSort() && 'cursor-pointer hover:text-ink select-none',
                        header.column.columnDef.meta?.priority === 'low' && 'hidden 2xl:table-cell'
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-3.5 h-3.5" />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody ref={tbodyRef} className="divide-y divide-surface-border">
              {table.getRowModel().rows.map((row) => {
                // A surviving row glides to its new position so the eye can follow it through a
                // filter change. Off past 60 rows, and off entirely under reduced motion.
                const animate = !prefersReducedMotion() && table.getRowModel().rows.length <= 60;
                const Row = animate ? motion.tr : 'tr';
                const anim = animate
                  ? { layout: true, transition: { duration: D.QUICK, ease: E.STANDARD } }
                  : {};
                return (
                <Row
                  key={row.id}
                  {...anim}
                  onClick={() => onRowClick?.(row.original)}
                  data-selected={selected?.has(idOf(row.original)) ? 'true' : undefined}
                  className={cn(
                    'hover:bg-black/[0.02] transition-colors',
                    onRowClick && 'cursor-pointer',
                    selected?.has(idOf(row.original)) && 'bg-primary-50/60'
                  )}
                >
                  {selectable && <td className="pl-4 pr-1 py-2.5 w-8" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={t('Select row')} className="os-check" checked={!!selected?.has(idOf(row.original))} onChange={() => toggle(row.original)} /></td>}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn('px-4 py-2.5 text-text-primary text-[13px] whitespace-nowrap align-middle', cell.column.columnDef.meta?.priority === 'low' && 'hidden 2xl:table-cell')}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </Row>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && pager && data.length > 0 && (
        <div className="px-4 py-3 border-t border-surface-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-xs text-text-tertiary">
            {fillT(t('Showing {from} to {to} of {total} entries'), { from: table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1, to: Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length), total: data.length })}
          </span>
          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2 text-xs font-medium text-text-secondary shrink-0">
              <Select
                {...selectProps}
                value={table.getState().pagination.pageSize}
                onChange={(value) => table.setPageSize(Number(value))}
                options={PAGE_SIZE_OPTIONS.map((size) => ({ value: size, label: String(size) }))}
                aria-label={t('Rows per page')}
                className="w-[76px] shrink-0"
                popupMatchSelectWidth={false}
              />
              <span className="text-text-tertiary whitespace-nowrap">{t('per page')}</span>
            </div>
            <Tooltip title={t('Previous page')}><span className="inline-flex"><button
              onClick={() => table.previousPage()}
              aria-label={t('Previous page')}
              disabled={!table.getCanPreviousPage()}
              className="w-11 h-11 shrink-0 sm:w-auto sm:h-auto sm:p-2 flex items-center justify-center rounded-lg border border-surface-border hover:border-primary-300 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </button></span></Tooltip>
            <span className="text-xs font-medium text-ink tabular whitespace-nowrap">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Tooltip title={t('Next page')}><span className="inline-flex"><button
              onClick={() => table.nextPage()}
              aria-label={t('Next page')}
              disabled={!table.getCanNextPage()}
              className="w-11 h-11 shrink-0 sm:w-auto sm:h-auto sm:p-2 flex items-center justify-center rounded-lg border border-surface-border hover:border-primary-300 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </button></span></Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}
