'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef } from 'react';
import type { ChartSpec } from '@/types';
import { EmptyState } from '@/components/empty-state';
import { formatUtcAxis, formatUtcDateTime } from '@/lib/time';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false, loading: () => <div className="h-80 rounded-2xl bg-white/[.03]" /> }) as any;

type EChartsInstanceRef = { getEchartsInstance: () => { getDataURL: (options: Record<string, unknown>) => string } };

function unitLabel(unit: string) {
  if (unit === 'percent') return '%';
  if (unit === 'ms') return 'ms';
  if (unit === 'rpm') return 'rpm';
  return unit;
}

export function UniversalChart({ spec, onPngReady }: { spec: ChartSpec; onPngReady?: (fn: () => void) => void }) {
  const chartRef = useRef<any>(null);
  const option = useMemo(() => {
    if (!spec.x || !spec.series.length) return null;
    const hasRight = spec.y.some(axis => axis.axis === 'right');
    return {
      backgroundColor: 'transparent',
      grid: { left: 48, right: hasRight ? 56 : 24, top: 34, bottom: 44, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(2,6,23,.96)',
        borderColor: 'rgba(148,163,184,.24)',
        textStyle: { color: '#e2e8f0' },
        formatter: (params: any) => {
          const items = Array.isArray(params) ? params : [params];
          const first = items[0];
          const xValue = Array.isArray(first?.value) ? first.value[0] : first?.axisValue;
          const header = spec.x?.type === 'time' ? formatUtcDateTime(xValue) : String(xValue ?? '');
          const lines = items.map((item: any) => {
            const value = Array.isArray(item.value) ? item.value[1] : item.value;
            return `${item.marker ?? ''} ${item.seriesName}: ${value ?? 'sin dato'}`;
          });
          return [header, ...lines].join('<br/>');
        }
      },
      legend: { top: 0, textStyle: { color: '#94a3b8' } },
      xAxis: {
        type: spec.x.type === 'time' ? 'time' : 'category',
        name: spec.x.type === 'time' ? 'UTC' : undefined,
        axisLine: { lineStyle: { color: 'rgba(148,163,184,.35)' } },
        axisLabel: {
          color: '#94a3b8',
          hideOverlap: true,
          formatter: (value: string | number) => spec.x?.type === 'time' ? formatUtcAxis(value) : String(value)
        }
      },
      yAxis: [
        { type: 'value', name: unitLabel(spec.y[0]?.unit ?? spec.unit), nameTextStyle: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,.12)' } }, axisLabel: { color: '#94a3b8' } },
        ...(hasRight ? [{ type: 'value', name: unitLabel(spec.y.find(y => y.axis === 'right')?.unit ?? ''), nameTextStyle: { color: '#94a3b8' }, splitLine: { show: false }, axisLabel: { color: '#94a3b8' } }] : [])
      ],
      dataZoom: spec.rows.length > 80 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8, borderColor: 'rgba(148,163,184,.2)', textStyle: { color: '#94a3b8' } }] : [],
      series: spec.series.map(series => ({
        name: series.label,
        type: spec.type === 'bar' || spec.type === 'stacked_bar' ? 'bar' : spec.type === 'scatter' ? 'scatter' : 'line',
        smooth: spec.type !== 'bar',
        showSymbol: spec.rows.length < 80,
        yAxisIndex: series.axis === 'right' ? 1 : 0,
        areaStyle: spec.type === 'area' ? {} : undefined,
        stack: spec.type === 'stacked_bar' ? 'total' : undefined,
        data: series.data.map(point => [point.x, point.y])
      }))
    };
  }, [spec]);

  if (!option) return <EmptyState title="No hay gráfica segura" body="El backend no encontró métricas numéricas visualizables. Se muestra la tabla de datos para evitar una visualización engañosa." />;

  return (
    <ReactECharts
      ref={(instance: EChartsInstanceRef | null) => { chartRef.current = instance; if (instance && onPngReady) onPngReady(() => { const url = instance.getEchartsInstance().getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#05070d' }); const a = document.createElement('a'); a.href = url; a.download = `${spec.title}.png`; a.click(); }); }}
      option={option}
      notMerge
      lazyUpdate
      style={{ height: 380, width: '100%' }}
    />
  );
}
