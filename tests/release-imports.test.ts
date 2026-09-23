/**
 * ⛔ The release jobs run with no `bun install` (release.yml says why: no third-party code next
 * to a write token and an OIDC token). So everything they execute may import only this
 * repository's own files and `node:` built-ins. An npm import here would pass locally, where
 * node_modules exists, and fail only in the privileged job — this fails first.
 */
import { expect, test } from 'bun:test';
import { Glob } from 'bun';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');

test('scripts/, builds/ and toolchain/ import nothing from npm', async () => {
  const offenders: string[] = [];
  for (const pattern of ['scripts/**/*.ts', 'builds/**/*.ts', 'toolchain/**/*.ts']) {
    for await (const file of new Glob(pattern).scan(root)) {
      const text = await Bun.file(join(root, file)).text();
      for (const match of text.matchAll(/from '([^']+)'/g)) {
        const spec = match[1] ?? '';
        if (!spec.startsWith('.') && !spec.startsWith('node:')) offenders.push(`${file}: ${spec}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});
