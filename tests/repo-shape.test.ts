/**
 * The gate that keeps the rendered tooling files rendered. A hand edit to ci.yml,
 * security.yml or dependabot.yml fails here; `bun run repo-shape:refresh` is the fix.
 */
import { driftInRepoShape } from '@homeflare/config/repo-shape';
import { expect, test } from 'bun:test';
import { shape } from '../repo-shape.ts';

test('the tooling files are the ones @homeflare/config renders', async () => {
  const report = await driftInRepoShape(`${import.meta.dir}/..`, shape);
  expect(report.problems).toEqual([]);
});

test('⛔ never the mini: a public repository runs on GitHub-hosted runners only', () => {
  expect(shape.runner).toBe('github');
});
