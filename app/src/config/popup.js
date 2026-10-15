// Popup placement — one rule for every antd Select / DatePicker in the kernel: the list opens
// BELOW its field, always. antd's default flips a dropdown upward when the viewport is short,
// which reads as two different behaviours across a form ("some open up, some open down").
// Instead of flipping, `ensureRoomBelow` scrolls the nearest scroll panel (a modal, the page
// main) so that there is room under the field before the popup measures itself.
import { getPopupContainer } from './popupContainer';

const DOWN = { overflow: { adjustX: true, adjustY: false, shiftY: false }, htmlRegion: 'visible', dynamicInset: true };
export const PLACEMENTS = {
  bottomLeft: { ...DOWN, points: ['tl', 'bl'], offset: [0, 4] },
  bottomRight: { ...DOWN, points: ['tr', 'br'], offset: [0, 4] },
  // top* are aliased to bottom* so nothing in the tree can opt back into opening upward.
  topLeft: { ...DOWN, points: ['tl', 'bl'], offset: [0, 4] },
  topRight: { ...DOWN, points: ['tr', 'br'], offset: [0, 4] },
};

export const LIST_HEIGHT = 176;                      // 5.5 options — the same on every select
const SLACK = 24;                                    // list + shadow + breathing room

/** Scroll the field's panel so `need` px are free under it. Runs on mousedown/focus, before the popup aligns. */
export function ensureRoomBelow(el, need = LIST_HEIGHT + SLACK) {
  if (!el || typeof window === 'undefined') return;
  const r = el.getBoundingClientRect();
  const deficit = r.bottom + need - window.innerHeight;
  if (deficit <= 0) return;
  const panel = el.closest('[data-modal-panel], [data-os-drawer-body], main') || document.scrollingElement;
  if (!panel) return;
  const canScroll = panel.scrollHeight - panel.clientHeight - panel.scrollTop;
  if (canScroll < deficit) {
    // Give the panel the slack it lacks (extra bottom padding) so the scroll can actually happen.
    const cur = parseFloat(panel.dataset.osSlack || '0');
    const add = deficit - Math.max(canScroll, 0);
    panel.dataset.osSlack = String(cur + add);
    panel.style.paddingBottom = `calc(${getComputedStyle(panel).paddingBottom} + ${add}px)`;
  }
  panel.scrollTop += deficit;
}

// antd bubbles a mousedown inside the (portalled) popup back to the Select, so only the press that OPENS
// the list may scroll — scrolling while an option is under the pointer would move it before the click lands.
const opening = (e) => !e.target?.closest?.('.ant-select-dropdown, .ant-picker-dropdown') && !e.currentTarget?.classList?.contains('ant-select-open') && !e.currentTarget?.classList?.contains('ant-picker-focused');

/** Props shared by every Select. Spread first so a caller can still override `className` etc. */
export const selectProps = {
  placement: 'bottomLeft',
  builtinPlacements: PLACEMENTS,
  listHeight: LIST_HEIGHT,
  getPopupContainer,
  onMouseDown: (e) => { if (opening(e)) ensureRoomBelow(e.currentTarget); },
  onFocus: (e) => { if (opening(e)) ensureRoomBelow(e.currentTarget); },
};
/** Props shared by every DatePicker (calendar is ~300px tall). */
export const pickerProps = {
  placement: 'bottomLeft',
  builtinPlacements: PLACEMENTS,
  getPopupContainer,
  onMouseDown: (e) => { if (opening(e)) ensureRoomBelow(e.currentTarget, 320); },
  onFocus: (e) => { if (opening(e)) ensureRoomBelow(e.currentTarget, 320); },
};
