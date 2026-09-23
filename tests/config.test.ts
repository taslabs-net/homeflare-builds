/**
 * ★ WHY THIS EXISTS. `.oxfmtrc.json` and `bunfig.toml` have no `extends`, so adopting
 *   @homeflare/config means COPYING them, and a copy drifts silently. This fails instead.
 * ⛔ checkProject REPORTS, it does not repair. See @homeflare/config/check.
 */
import { checkProject } from '@homeflare/config/check';
import { expect, test } from 'bun:test';

test('this repo still stands on the shared config', async () => {
  expect(await checkProject(process.cwd())).toEqual([]);
});
