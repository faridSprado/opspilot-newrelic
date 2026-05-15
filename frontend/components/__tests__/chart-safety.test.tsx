import { describe, expect, it } from 'vitest';
import type { ChartSpec } from '@/types';

describe('chart spec safety contract', () => {
  it('does not include timestamp columns as y series', () => {
    const spec: ChartSpec = {
      id: 'test',
      type: 'line',
      title: 'Acceptance',
      unit: 'ms',
      x: { key: 'beginTimeSeconds', type: 'time', label: 'Time' },
      y: [
        { key: 'Response Time ms', label: 'Response Time ms', unit: 'ms', axis: 'left' },
        { key: 'Throughput RPM', label: 'Throughput RPM', unit: 'rpm', axis: 'right' }
      ],
      series: [
        { key: 'Response Time ms', label: 'Response Time ms', unit: 'ms', axis: 'left', data: [{ x: 1710000000, y: 530 }] },
        { key: 'Throughput RPM', label: 'Throughput RPM', unit: 'rpm', axis: 'right', data: [{ x: 1710000000, y: 180 }] }
      ],
      rows: [{ beginTimeSeconds: 1710000000, endTimeSeconds: 1710000060, 'Response Time ms': 530, 'Throughput RPM': 180 }],
      columns: [],
      meta: { excluded_y_columns: ['beginTimeSeconds', 'endTimeSeconds'] }
    };
    expect(spec.x?.key).toMatch(/beginTimeSeconds|endTimeSeconds/);
    expect(spec.y.map(field => field.key)).not.toContain('beginTimeSeconds');
    expect(spec.y.map(field => field.key)).not.toContain('endTimeSeconds');
    expect(spec.series.map(series => series.key)).toEqual(['Response Time ms', 'Throughput RPM']);
  });
});
