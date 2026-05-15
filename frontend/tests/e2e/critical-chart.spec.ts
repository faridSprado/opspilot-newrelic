import { test, expect } from '@playwright/test';

test('critical timestamp chart contract example', async () => {
  const rows = [{ beginTimeSeconds: 1710000000, endTimeSeconds: 1710000060, 'Response Time ms': 530, 'Throughput RPM': 180 }];
  const yKeys = Object.keys(rows[0]).filter(key => !['beginTimeSeconds', 'endTimeSeconds', 'timestamp', 'time', 'date'].includes(key));
  expect(yKeys).toEqual(['Response Time ms', 'Throughput RPM']);
});
