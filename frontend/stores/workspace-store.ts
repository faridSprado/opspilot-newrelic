'use client';

import { create } from 'zustand';
import type { EntitySummary, TimeRange } from '@/types';
import { absoluteUtcRange, defaultTimeRangeSelection, resolveTimeRange, type TimeRangeSelection } from '@/lib/time';

type WorkspaceState = {
  accountId?: number;
  selectedEntity?: EntitySummary;
  timeRange: TimeRange;
  timeRangeSelection: TimeRangeSelection;
  sidebarCollapsed: boolean;
  setAccountId: (accountId?: number) => void;
  setSelectedEntity: (entity?: EntitySummary) => void;
  setTimeRange: (timeRange: TimeRange) => void;
  setPresetTimeRange: (minutes: number, value?: string, label?: string) => void;
  setCustomTimeRange: (fromLocal: string, toLocal: string, label?: string) => void;
  refreshEffectiveTimeRange: () => TimeRange;
  toggleSidebar: () => void;
};

const defaultSelection = defaultTimeRangeSelection(180);

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  timeRange: absoluteUtcRange(180),
  timeRangeSelection: defaultSelection,
  sidebarCollapsed: false,
  setAccountId: (accountId) => set({ accountId }),
  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setPresetTimeRange: (minutes, value, label) => {
    const selection: TimeRangeSelection = { kind: 'preset', value: value ?? String(minutes), label: label ?? `${minutes} min`, minutes };
    set({ timeRangeSelection: selection, timeRange: resolveTimeRange(selection) });
  },
  setCustomTimeRange: (fromLocal, toLocal, label = 'Personalizado') => {
    const selection: TimeRangeSelection = { kind: 'custom', label, fromLocal, toLocal };
    set({ timeRangeSelection: selection, timeRange: resolveTimeRange(selection) });
  },
  refreshEffectiveTimeRange: () => {
    const nextRange = resolveTimeRange(get().timeRangeSelection);
    set({ timeRange: nextRange });
    return nextRange;
  },
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
}));
