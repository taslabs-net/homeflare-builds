/** The parsing half of the smoke test (the running half needs darwin/arm64 and a binary). */
import { expect, test } from 'bun:test';
import { linkedLibraries, moduleLines } from '../scripts/lib/smoke.ts';

test('otool -L: one path per load command, the header line skipped', () => {
  const otool = `/tmp/caddy:
\t/usr/lib/libSystem.B.dylib (compatibility version 0.0.0, current version 0.0.0)
\t/System/Library/Frameworks/Security.framework/Versions/A/Security (compatibility version 0.0.0, current version 0.0.0)
`;
  expect(linkedLibraries(otool)).toEqual([
    '/usr/lib/libSystem.B.dylib',
    '/System/Library/Frameworks/Security.framework/Versions/A/Security',
  ]);
});

test('list-modules: module lines only, not the blank line or the count', () => {
  const text = 'layer4 v0.1.2\nsecurity v1.1.64\n\n  Non-standard modules: 2\n';
  expect(moduleLines(text)).toEqual(['layer4 v0.1.2', 'security v1.1.64']);
});

test('the measured module list has 48 sorted lines — the mini, 2026-09-22', async () => {
  const lines = moduleLines(
    await Bun.file(`${import.meta.dir}/../builds/caddy/modules.txt`).text(),
  );
  expect(lines).toHaveLength(48);
  expect(lines).toEqual(lines.toSorted());
});
