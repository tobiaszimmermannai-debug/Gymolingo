/**
 * Lightweight SVG charts (react-native-svg) – line/area and bar charts with a
 * press-and-drag crosshair tooltip. Single-series charts need no legend (the
 * card title names them); two-series charts render a legend.
 */
import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { formatDateDE, formatNumberDE } from '@gymolingo/core';
import { colors, fonts, spacing } from './theme';
import { Text } from './Text';

export interface Point {
  x: string; // ISO date
  y: number;
}

interface Series {
  label: string;
  color: string;
  points: Point[];
  kind?: 'line' | 'dots';
}

const PAD = { top: 14, right: 12, bottom: 22, left: 40 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const d = Math.abs(min) * 0.05 || 1;
    min -= d;
    max += d;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  // include the first tick at or above max so no data point is clipped
  for (let v = start; ticks.length < 12; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
    if (v >= max - 1e-9) break;
  }
  return ticks;
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

function Tooltip({ x, width, title, lines }: { x: number; width: number; title: string; lines: { color: string; text: string }[] }) {
  const boxW = 150;
  const left = Math.max(0, Math.min(width - boxW, x - boxW / 2));
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -4,
        left,
        width: boxW,
        backgroundColor: colors.surface3,
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: colors.borderStrong,
      }}
    >
      <Text variant="caption" tone="secondary">
        {title}
      </Text>
      {lines.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
          <Text variant="smallMedium">{l.text}</Text>
        </View>
      ))}
    </View>
  );
}

export function LineChart({
  series,
  height = 180,
  unit = '',
  decimals = 1,
  area = true,
  yMin,
  targetLine,
  testID,
}: {
  series: Series[];
  height?: number;
  unit?: string;
  decimals?: number;
  area?: boolean;
  yMin?: number;
  targetLine?: { value: number; label: string };
  testID?: string;
}) {
  const [width, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);

  const allX = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(), [series]);
  const values = series.flatMap((s) => s.points.map((p) => p.y)).concat(targetLine ? [targetLine.value] : []);
  const hasData = allX.length > 0 && values.length > 0;

  const geo = useMemo(() => {
    if (!hasData || width === 0) return null;
    const lo = Math.min(...values, yMin ?? Infinity);
    const hi = Math.max(...values);
    const ticks = niceTicks(lo, hi);
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const xIndex = new Map(allX.map((x, i) => [x, i]));
    const xOf = (x: string) => PAD.left + (allX.length === 1 ? innerW / 2 : ((xIndex.get(x) ?? 0) / (allX.length - 1)) * innerW);
    const yOf = (y: number) => PAD.top + innerH - ((y - min) / (max - min || 1)) * innerH;
    return { ticks, xOf, yOf, innerW, innerH, min, max };
  }, [hasData, width, height, values.join(','), allX.join(','), yMin]);

  const onTouch = (e: GestureResponderEvent) => {
    if (!geo || !allX.length) return;
    const lx = e.nativeEvent.locationX - PAD.left;
    const i = allX.length === 1 ? 0 : Math.round((lx / geo.innerW) * (allX.length - 1));
    setSel(Math.max(0, Math.min(allX.length - 1, i)));
  };

  return (
    <View testID={testID} onLayout={onLayout} style={{ height: height + (series.length > 1 ? 24 : 0) }}>
      {!hasData ? (
        <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
          <Text tone="muted" variant="small">
            Noch keine Daten im Zeitraum
          </Text>
        </View>
      ) : (
        geo && (
          <View
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={onTouch}
            onResponderMove={onTouch}
            onResponderRelease={() => setTimeout(() => setSel(null), 1800)}
            accessibilityRole="image"
            accessibilityLabel={`Diagramm ${series.map((s) => s.label).join(', ')}`}
          >
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={series[series.length - 1].color} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={series[series.length - 1].color} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {geo.ticks.map((t) => (
                <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={geo.yOf(t)} y2={geo.yOf(t)} stroke={colors.border} strokeWidth={1} />
              ))}
              {geo.ticks.map((t) => (
                <SvgText key={`l${t}`} x={PAD.left - 6} y={geo.yOf(t) + 4} fontSize={10} fill={colors.textMuted} textAnchor="end" fontFamily={fonts.medium}>
                  {formatNumberDE(t, Math.abs(geo.max - geo.min) < 10 ? 1 : 0)}
                </SvgText>
              ))}
              {targetLine && (
                <Line x1={PAD.left} x2={width - PAD.right} y1={geo.yOf(targetLine.value)} y2={geo.yOf(targetLine.value)} stroke={colors.textSecondary} strokeDasharray="4 4" strokeWidth={1} />
              )}
              {series.map((s, si) => {
                const pts = s.points.filter((p) => Number.isFinite(p.y));
                if (!pts.length) return null;
                if (s.kind === 'dots') {
                  return pts.map((p) => <Circle key={`${si}-${p.x}`} cx={geo.xOf(p.x)} cy={geo.yOf(p.y)} r={3} fill={s.color} />);
                }
                const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${geo.xOf(p.x).toFixed(1)},${geo.yOf(p.y).toFixed(1)}`).join(' ');
                const isLast = si === series.length - 1;
                return (
                  <G key={si}>
                    {area && isLast && pts.length > 1 && (
                      <Path
                        d={`${d} L${geo.xOf(pts[pts.length - 1].x).toFixed(1)},${PAD.top + geo.innerH} L${geo.xOf(pts[0].x).toFixed(1)},${PAD.top + geo.innerH} Z`}
                        fill="url(#areaGrad)"
                      />
                    )}
                    <Path d={d} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                    {pts.length === 1 && <Circle cx={geo.xOf(pts[0].x)} cy={geo.yOf(pts[0].y)} r={4} fill={s.color} />}
                  </G>
                );
              })}
              <SvgText x={PAD.left} y={height - 6} fontSize={10} fill={colors.textMuted} fontFamily={fonts.medium}>
                {formatDateDE(allX[0])}
              </SvgText>
              {allX.length > 1 && (
                <SvgText x={width - PAD.right} y={height - 6} fontSize={10} fill={colors.textMuted} textAnchor="end" fontFamily={fonts.medium}>
                  {formatDateDE(allX[allX.length - 1])}
                </SvgText>
              )}
              {sel !== null && (
                <>
                  <Line x1={geo.xOf(allX[sel])} x2={geo.xOf(allX[sel])} y1={PAD.top} y2={PAD.top + geo.innerH} stroke={colors.textSecondary} strokeWidth={1} />
                  {series.map((s, si) => {
                    const p = s.points.find((q) => q.x === allX[sel]);
                    return p ? <Circle key={si} cx={geo.xOf(p.x)} cy={geo.yOf(p.y)} r={5} fill={s.color} stroke={colors.surface} strokeWidth={2} /> : null;
                  })}
                </>
              )}
            </Svg>
            {sel !== null && (
              <Tooltip
                x={geo.xOf(allX[sel])}
                width={width}
                title={formatDateDE(allX[sel], true)}
                lines={series
                  .map((s) => ({ s, p: s.points.find((q) => q.x === allX[sel]) }))
                  .filter((o) => o.p)
                  .map(({ s, p }) => ({ color: s.color, text: `${series.length > 1 ? s.label + ': ' : ''}${formatNumberDE(p!.y, decimals)}${unit ? ' ' + unit : ''}` }))}
              />
            )}
          </View>
        )
      )}
      {series.length > 1 && hasData && <Legend items={series.map((s) => ({ label: s.label, color: s.color, dot: s.kind === 'dots' }))} />}
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dot?: boolean }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: 6, flexWrap: 'wrap' }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: i.dot ? 8 : 14, height: i.dot ? 8 : 3, borderRadius: 4, backgroundColor: i.color }} />
          <Text variant="small" tone="secondary">
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function BarChart({
  data,
  height = 160,
  color = colors.accent,
  unit = '',
  decimals = 0,
  target,
  highlightLast = false,
  labelFormat = (x: string) => formatDateDE(x),
  testID,
}: {
  data: Point[];
  height?: number;
  color?: string;
  unit?: string;
  decimals?: number;
  target?: number;
  highlightLast?: boolean;
  labelFormat?: (x: string) => string;
  testID?: string;
}) {
  const [width, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const hasData = data.some((d) => d.y > 0);
  const max = Math.max(...data.map((d) => d.y), target ?? 0, 1);
  const ticks = niceTicks(0, max, 3);
  const top = ticks[ticks.length - 1];
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const yOf = (v: number) => PAD.top + innerH - (v / top) * innerH;

  const onTouch = (e: GestureResponderEvent) => {
    if (!data.length || slot === 0) return;
    const i = Math.floor((e.nativeEvent.locationX - PAD.left) / slot);
    setSel(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <View testID={testID} onLayout={onLayout} style={{ height }}>
      {!hasData ? (
        <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
          <Text tone="muted" variant="small">
            Noch keine Daten im Zeitraum
          </Text>
        </View>
      ) : (
        width > 0 && (
          <View
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={onTouch}
            onResponderMove={onTouch}
            onResponderRelease={() => setTimeout(() => setSel(null), 1800)}
            accessibilityRole="image"
          >
            <Svg width={width} height={height}>
              {ticks.map((t) => (
                <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={yOf(t)} y2={yOf(t)} stroke={colors.border} strokeWidth={1} />
              ))}
              {ticks.map((t) => (
                <SvgText key={`l${t}`} x={PAD.left - 6} y={yOf(t) + 4} fontSize={10} fill={colors.textMuted} textAnchor="end" fontFamily={fonts.medium}>
                  {t >= 10000 ? `${formatNumberDE(t / 1000, 0)}k` : formatNumberDE(t, 0)}
                </SvgText>
              ))}
              {data.map((d, i) => {
                const h = Math.max(d.y > 0 ? 3 : 0, innerH - (yOf(d.y) - PAD.top));
                const x = PAD.left + i * slot + (slot - barW) / 2;
                const active = sel === i || (highlightLast && i === data.length - 1);
                const hit = target !== undefined && d.y >= target;
                return (
                  <Rect
                    key={d.x}
                    x={x}
                    y={PAD.top + innerH - h}
                    width={barW}
                    height={h}
                    rx={Math.min(4, barW / 2)}
                    fill={color}
                    opacity={sel === null ? (hit || target === undefined ? 1 : 0.55) : active ? 1 : 0.35}
                  />
                );
              })}
              {target !== undefined && (
                <Line x1={PAD.left} x2={width - PAD.right} y1={yOf(target)} y2={yOf(target)} stroke={colors.textSecondary} strokeDasharray="4 4" strokeWidth={1} />
              )}
              <SvgText x={PAD.left} y={height - 6} fontSize={10} fill={colors.textMuted} fontFamily={fonts.medium}>
                {data.length ? labelFormat(data[0].x) : ''}
              </SvgText>
              {data.length > 1 && (
                <SvgText x={width - PAD.right} y={height - 6} fontSize={10} fill={colors.textMuted} textAnchor="end" fontFamily={fonts.medium}>
                  {labelFormat(data[data.length - 1].x)}
                </SvgText>
              )}
            </Svg>
            {sel !== null && data[sel] && (
              <Tooltip
                x={PAD.left + sel * slot + slot / 2}
                width={width}
                title={labelFormat(data[sel].x)}
                lines={[{ color, text: `${formatNumberDE(data[sel].y, decimals)}${unit ? ' ' + unit : ''}` }]}
              />
            )}
          </View>
        )
      )}
    </View>
  );
}
