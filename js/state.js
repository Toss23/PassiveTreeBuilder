import { DEFAULT_CONFIG } from './config.js';

export const state = {
  nodes: [],
  links: [],
  notes: [],
  palette: [],
  tags: [],
  stats: [
    { id: 'str',      name: 'Сила',           types: { flat: true, percent: false, more: false }, flatFormat: 'number' },
    { id: 'atkspd',   name: 'Скорость атаки', types: { flat: true, percent: true,  more: false }, flatFormat: 'number' },
    { id: 'crit',     name: 'Шанс крита',     types: { flat: true, percent: true,  more: true  }, flatFormat: 'number' },
    { id: 'xp_bonus', name: 'Бонус опыта',    types: { flat: true, percent: true,  more: true  }, flatFormat: 'number' },
  ],
  selectedIds: new Set(),
  selectedNoteId: null,
  mode: 'edit',
  acquired: new Set(),
  linking: null,
  search: { query: '' },
  clipboard: null,
  dirty: false,
  config: { ...DEFAULT_CONFIG },
};

export const view = { x: 0, y: 0, k: 1 };

export const uid = () => Math.random().toString(36).slice(2, 10);
export const getNode = (id) => state.nodes.find(n => n.id === id);
export const getStat = (id) => state.stats.find(s => s.id === id);
export const childrenOf = (id) => state.nodes.filter(n => n.parentId === id);

export const getSelectedNodes = () =>
  state.nodes.filter(n => state.selectedIds.has(n.id));

export const isSelected = (id) => state.selectedIds.has(id);

export const setSelection = (ids) => {
  state.selectedIds = new Set(ids);
};

export const toggleSelection = (id) => {
  if (state.selectedIds.has(id)) state.selectedIds.delete(id);
  else state.selectedIds.add(id);
};

export const clearSelection = () => {
  state.selectedIds.clear();
};