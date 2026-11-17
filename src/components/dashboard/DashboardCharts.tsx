import React from 'react';
import {
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DonutDatum, TrendDatum } from '../../shared/types';

interface DonutWithCenterIconProps {
  title: string;
  data: DonutDatum[];
  centerIcon: React.ReactNode;
  size?: number;
  legendCols?: 1 | 2;
  subtitle?: string;
}

export function DonutWithCenterIcon({
  title,
  data,
  centerIcon,
  size = 112,
  legendCols = 1,
  subtitle,
}: DonutWithCenterIconProps) {
  const safeData = data.length > 0 ? data : [{ name: 'No Data', value: 1, color: '#CBD5E1' }];
  const hasRealData = data.length > 0;

  return (
    <div className="flex flex-col items-center min-w-0">
      <div className="text-center mb-1">
        <div className="text-xs sm:text-[13px] font-bold text-[#0F4761] leading-tight">{title}</div>
        {subtitle && <div className="text-[10px] text-slate-500">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2 w-full justify-center">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={safeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={size * 0.26}
                outerRadius={size * 0.45}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
                label={
                  hasRealData
                    ? ({ cx, cy, midAngle = 0, innerRadius, outerRadius, value }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text
                            x={x}
                            y={y}
                            fill="#FFFFFF"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={10}
                            fontWeight={700}
                          >
                            {value}
                          </text>
                        );
                      }
                    : false
                }
                labelLine={false}
              >
                {safeData.map((entry, idx) => (
                  <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                ))}
              </Pie>
              {hasRealData && (
                <Tooltip
                  contentStyle={{
                    fontSize: '11px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '4px 8px',
                  }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#0F4761]">
            {centerIcon}
          </div>
        </div>

        {/* Clean Legend */}
        <ul
          className={`min-w-0 ${
            legendCols === 2 ? 'grid grid-cols-2 gap-x-4 gap-y-1' : 'flex flex-col gap-1'
          }`}
        >
          {hasRealData ? (
            data.map((entry) => (
              <li
                key={entry.name}
                className={`flex items-center gap-1.5 ${
                  legendCols === 2 ? 'text-[9.5px]' : 'text-[10px]'
                } text-slate-800 leading-tight`}
              >
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="whitespace-nowrap" title={`${entry.name} (${entry.value})`}>
                  {entry.name}
                </span>
              </li>
            ))
          ) : (
            <li className="text-[11px] text-slate-400">No records</li>
          )}
        </ul>
      </div>
    </div>
  );
}

interface TrendLineProps {
  title: string;
  data: TrendDatum[];
  height?: number;
  lightHeader?: boolean;
}

export function TrendLineWithRegression({
  title,
  data,
  height = 148,
}: TrendLineProps) {
  return (
    <div className="flex flex-col min-w-0 w-full">
      <div className="text-xs sm:text-[13px] font-bold text-center mb-1 text-[#0F4761]">
        {title}
      </div>
      <div style={{ width: '100%', height }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 18, right: 14, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 71, 97, 0.14)" />
              <XAxis
                dataKey="label"
                padding={{ left: 16, right: 14 }}
                tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }}
                axisLine={{ stroke: 'rgba(15, 71, 97, 0.25)' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(dataMax + 2, 4)]}
                tick={{ fontSize: 10, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: '11px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                }}
              />
              <Line
                type="linear"
                dataKey="trend"
                name="Trendline"
                stroke="#0F4761"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="Records"
                stroke="#0F4761"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#0F4761', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="count"
                  position="top"
                  offset={6}
                  style={{ fontSize: 10, fontWeight: 700, fill: '#0F4761' }}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No monthly trend records
          </div>
        )}
      </div>
    </div>
  );
}

export function AnatomicalBodySilhouette({
  highlightedParts,
}: {
  highlightedParts: string[];
}) {
  const has = (part: string) => highlightedParts.includes(part);
  return (
    <svg
      viewBox="0 0 120 240"
      className="w-[60px] h-[120px] shrink-0"
      role="img"
      aria-label="Affected Body Parts Anatomical Reference"
    >
      {/* Head & Face & Eyes */}
      <circle
        cx="60"
        cy="26"
        r="15"
        fill={has('Head') || has('Face') || has('Eyes') ? '#C2410C' : '#EA580C'}
      />
      {/* Neck */}
      <rect
        x="53"
        y="40"
        width="14"
        height="10"
        rx="3"
        fill={has('Neck') ? '#B91C1C' : '#EA580C'}
      />
      {/* Torso & Back & Shoulder */}
      <path
        d="M36 52 C36 48, 84 48, 84 52 L80 122 C80 126, 40 126, 40 122 Z"
        fill={has('Back') || has('Shoulder') ? '#C2410C' : '#EA580C'}
      />
      {/* Left Arm & Hand */}
      <path
        d="M35 54 L20 112 L28 115 L40 65 Z"
        fill={has('Arms') ? '#B91C1C' : '#EA580C'}
      />
      <circle
        cx="22"
        cy="120"
        r="6"
        fill={has('Hands') || has('Fingers') ? '#991B1B' : '#EA580C'}
      />
      {/* Right Arm & Hand */}
      <path
        d="M85 54 L100 112 L92 115 L80 65 Z"
        fill={has('Arms') ? '#B91C1C' : '#EA580C'}
      />
      <circle
        cx="98"
        cy="120"
        r="6"
        fill={has('Hands') || has('Fingers') ? '#991B1B' : '#EA580C'}
      />
      {/* Legs */}
      <rect
        x="42"
        y="124"
        width="14"
        height="88"
        rx="6"
        fill={has('Legs') ? '#B91C1C' : '#EA580C'}
      />
      <rect
        x="64"
        y="124"
        width="14"
        height="88"
        rx="6"
        fill={has('Legs') ? '#B91C1C' : '#EA580C'}
      />
      {/* Feet */}
      <ellipse
        cx="47"
        cy="218"
        rx="9"
        ry="5"
        fill={has('Feet') ? '#991B1B' : '#EA580C'}
      />
      <ellipse
        cx="73"
        cy="218"
        rx="9"
        ry="5"
        fill={has('Feet') ? '#991B1B' : '#EA580C'}
      />
      {/* Reference callout lines matching uploaded image */}
      <line x1="74" y1="22" x2="118" y2="10" stroke="#9A3412" strokeWidth="1" />
      <line x1="76" y1="220" x2="118" y2="232" stroke="#9A3412" strokeWidth="1" />
    </svg>
  );
}
