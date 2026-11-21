import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ChartContext = createContext(null);

const STORAGE_KEY = 'ims-chart-types';
const VALID = ['pie', 'donut', 'bar', 'horizontal-bar', 'line'];

function readStoredTypes() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Remembers each dashboard chart's chosen visualisation for the browser
 * session (sessionStorage), so the preference survives page navigation but is
 * forgotten when the tab is closed.
 */
export function ChartProvider({ children }) {
  const [types, setTypes] = useState(readStoredTypes);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(types));
    } catch {
      /* storage unavailable — the choice still works for this page view */
    }
  }, [types]);

  const setChartType = useCallback((chartId, type) => {
    if (!VALID.includes(type)) return;
    setTypes((current) => ({ ...current, [chartId]: type }));
  }, []);

  const getChartType = useCallback((chartId, fallback = 'donut') => types[chartId] || fallback, [types]);

  const value = useMemo(() => ({ getChartType, setChartType }), [getChartType, setChartType]);
  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChartType() {
  const context = useContext(ChartContext);
  if (!context) throw new Error('useChartType must be used within a ChartProvider');
  return context;
}
