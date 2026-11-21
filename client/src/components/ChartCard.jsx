import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartColumn, ChartLine, ChartPie, CircleDashed, Rows3 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useChartType } from '../context/ChartContext';
import { CHART_TYPES, chartTokens, token } from '../utils/chart';
import { formatNumber } from '../utils/format';

const TYPE_ICONS = {
  pie: ChartPie,
  donut: CircleDashed,
  bar: ChartColumn,
  'horizontal-bar': Rows3,
  line: ChartLine,
};

function ChartTooltip({ active, payload, label, suffix, total = 0 }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label !== undefined && label !== null && <div className="ct-head">{label}</div>}
      {payload.map((entry) => (
        <div className="ct-row" key={`${entry.dataKey || entry.name}`}>
          <span className="ct-dot" style={{ background: entry.color || entry.payload?.fill || 'var(--orange)' }} />
          <span className="ct-name">{entry.name || entry.payload?.name || 'Quantity'}:</span>
          <strong>
            {formatNumber(entry.value)}
            {suffix ? ` ${suffix}` : ''}
            {total > 0 ? ` · ${Math.round((Number(entry.value) / total) * 100)}%` : ''}
          </strong>
        </div>
      ))}
    </div>
  );
}

/**
 * One chart renderer for five visualisations.
 *
 * @param {string}   chartId   Stable id used to remember the chosen type.
 * @param {Array}    data      Rows — { name, value } for single series,
 *                             `series` keys for multi-series.
 * @param {Array}    series    Multiple series definition [{ key, label }].
 * @param {string}   nameKey   Category label key (default "name").
 * @param {string}   dataKey   Value key for single-series charts (default "value").
 */
export function ChartCard({
  chartId,
  title,
  description,
  icon: Icon,
  data = [],
  series,
  nameKey = 'name',
  dataKey = 'value',
  suffix = '',
  height = 250,
  defaultType = 'donut',
  actions,
  showPieLegend = true,
}) {
  const { theme } = useTheme();
  const { getChartType, setChartType } = useChartType();
  const type = getChartType(chartId, defaultType);

  // Re-read the tokens whenever the theme changes so charts follow the palette.
  const tokens = useMemo(() => chartTokens(), [theme]);
  const grid = token('--chart-grid', '#e8e8e8');
  const axis = token('--chart-axis', '#7a7a7a');
  const cursor = token('--chart-cursor', 'rgba(242,140,40,0.08)');

  const multi = Array.isArray(series) && series.length > 0;
  const seriesList = multi ? series : [{ key: dataKey, label: title || 'Quantity' }];
  const hasData = data.some((row) => seriesList.some((entry) => Number.isFinite(Number(row[entry.key])) && Number(row[entry.key]) > 0));
  const showLegend = multi && data.length > 0;
  const isPie = type === 'pie' || type === 'donut';
  const renderLegend = isPie ? hasData && showPieLegend : showLegend;
  const pieData = isPie
    ? data.map((row) => ({
        ...row,
        chartValue: multi
          ? seriesList.reduce((sum, entry) => sum + (Number.isFinite(Number(row[entry.key])) ? Number(row[entry.key]) : 0), 0)
          : Number.isFinite(Number(row[dataKey]))
            ? Number(row[dataKey])
            : 0,
      }))
    : [];
  const pieTotal = pieData.reduce((sum, row) => sum + row.chartValue, 0);

  const axisProps = {
    tick: { fontSize: 10.5, fill: axis },
    axisLine: false,
    tickLine: false,
  };

  const renderChart = () => {
    if (!data.length) {
      return <div className="chart-empty">No data recorded for this period yet.</div>;
    }

    if (isPie) {
      const inner = type === 'donut' ? '58%' : 0;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="chartValue"
              nameKey={nameKey}
              innerRadius={inner}
              outerRadius="82%"
              paddingAngle={type === 'donut' ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              label={false}
              isAnimationActive
              animationDuration={320}
              animationEasing="ease-out"
            >
              {pieData.map((entry, index) => (
                <Cell key={`${entry[nameKey]}-${index}`} fill={tokens[index % tokens.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip suffix={suffix} total={pieTotal} />} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'horizontal-bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={grid} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey={nameKey} width={104} {...axisProps} />
            <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ fill: cursor }} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />}
            {seriesList.map((entry, index) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.label}
                fill={tokens[index % tokens.length]}
                radius={[0, 3, 3, 0]}
                maxBarSize={18}
                isAnimationActive
                animationDuration={320}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
            <XAxis dataKey={nameKey} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip content={<ChartTooltip suffix={suffix} />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />}
            {seriesList.map((entry, index) => (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.label}
                stroke={tokens[index % tokens.length]}
                strokeWidth={2}
                dot={{ r: 2.5, strokeWidth: 0, fill: tokens[index % tokens.length] }}
                activeDot={{ r: 4 }}
                isAnimationActive
                animationDuration={320}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 12, left: -18, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
          <XAxis dataKey={nameKey} {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ fill: cursor }} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />}
          {seriesList.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              fill={tokens[index % tokens.length]}
              radius={[3, 3, 0, 0]}
              maxBarSize={26}
              isAnimationActive
              animationDuration={320}
              animationEasing="ease-out"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <section className="card chart-card">
      <div className="chart-card-head">
        <div>
          <h2 style={{ fontSize: 14.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
            {Icon && <Icon size={16} style={{ color: 'var(--orange-deep)' }} />}
            {title}
          </h2>
          {description && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{description}</p>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {actions}
          <div className="chart-switcher" role="group" aria-label={`${title} chart type`}>
            {CHART_TYPES.map((option) => {
              const TypeIcon = TYPE_ICONS[option.value] || ChartColumn;
              return (
                <button
                  type="button"
                  key={option.value}
                  aria-pressed={type === option.value}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setChartType(chartId, option.value)}
                >
                  <TypeIcon size={14} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="chart-box" style={{ height }}>
        {hasData ? renderChart() : <div className="chart-empty">No data recorded yet.</div>}
      </div>

      {renderLegend && (
        <div className={`chart-legend ${isPie ? 'chart-data-legend' : ''}`}>
          {isPie
            ? pieData.map((entry, index) => (
                <span className="legend-item" key={`${entry[nameKey]}-${index}`}>
                  <span className="legend-dot" style={{ background: tokens[index % tokens.length] }} />
                  <span className="chart-legend-name">{entry[nameKey]}</span>
                  <strong>{formatNumber(entry.chartValue)}</strong>
                  {pieTotal > 0 && <small>{Math.round((entry.chartValue / pieTotal) * 100)}%</small>}
                </span>
              ))
            : seriesList.map((entry, index) => (
                <span className="legend-item" key={entry.key}>
                  <span className="legend-dot" style={{ background: tokens[index % tokens.length] }} />
                  {entry.label}
                </span>
              ))}
        </div>
      )}
    </section>
  );
}

export default ChartCard;
