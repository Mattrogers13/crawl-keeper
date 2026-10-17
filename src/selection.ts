// The GM's row selection in the tracker (local to the panel, not saved).
// Pure, so the click rules are unit-tested.

export type Selection = { ids: string[]; anchor: string | null };

export const NO_SELECTION: Selection = { ids: [], anchor: null };

// A click on row `id`, with the rows in the order shown:
// - plain: just that row (clicking the only selected row clears it);
// - Shift: the range from the last clicked row to this one;
// - Cmd / Ctrl: add or remove this row.
export const clickRow = (
  sel: Selection,
  id: string,
  order: string[],
  mods: { shift: boolean; toggle: boolean },
): Selection => {
  if (mods.shift && sel.anchor !== null && order.includes(sel.anchor) && order.includes(id)) {
    const [a, b] = [order.indexOf(sel.anchor), order.indexOf(id)].sort((x, y) => x - y);
    return { ids: order.slice(a, b + 1), anchor: sel.anchor };
  }
  if (mods.toggle) {
    return sel.ids.includes(id) ? { ids: sel.ids.filter((x) => x !== id), anchor: id } : { ids: [...sel.ids, id], anchor: id };
  }
  return sel.ids.length === 1 && sel.ids[0] === id ? NO_SELECTION : { ids: [id], anchor: id };
};

// Opening the menu on a row: inside the selection it acts on the whole
// selection; anywhere else it selects just that row.
export const menuTargets = (sel: Selection, id: string): Selection =>
  sel.ids.includes(id) ? sel : { ids: [id], anchor: id };

// Rows that went away (removed, deleted from the map, hidden) drop out.
export const keepRows = (sel: Selection, order: string[]): Selection => {
  const ids = sel.ids.filter((id) => order.includes(id));
  return ids.length === sel.ids.length ? sel : { ids, anchor: sel.anchor !== null && order.includes(sel.anchor) ? sel.anchor : null };
};
