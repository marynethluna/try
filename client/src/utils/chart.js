/**
 * Chart theme tokens.
 *
 * Colours come from the CSS custom properties defined in styles.css so the
 * charts switch between light and dark mode together with the rest of the UI.
 */
const TOKEN_NAMES = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];

export const FALLBACK_TOKENS = ['#f28c28', '#2b5d87', '#1c7a4d', '#a2570a', '#6d5bb5', '#9a9a9a'];

/** Reads the live theme tokens from the document root. */
export function chartTokens() {
  if (typeof window === 'undefined') return [...FALLBACK_TOKENS];
  const styles = getComputedStyle(document.documentElement);
  return TOKEN_NAMES.map((name, index) => styles.getPropertyValue(name).trim() || FALLBACK_TOKENS[index]);
}

export function token(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Colour for series index `index`. */
export function seriesColor(index, tokens = chartTokens()) {
  return tokens[index % tokens.length];
}

export const CHART_TYPES = [
  { value: 'pie', label: 'Pie chart' },
  { value: 'donut', label: 'Donut chart' },
  { value: 'bar', label: 'Vertical bar chart' },
  { value: 'horizontal-bar', label: 'Horizontal bar chart' },
  { value: 'line', label: 'Line chart' },
];
