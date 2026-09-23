/**
 * The smoke test: run the built binary on the platform it is for, before anything is packed.
 *
 * ⛔ darwin/arm64 ONLY — IT EXECUTES THE BINARY. The release job runs on macos-26 (arm64); the
 *   pull-request cross-build on Linux cannot run a Mach-O and relies on build info instead.
 * ★ WHAT IT PROVES, EACH AGAINST A MEASUREMENT OF THE BINARY IT REPLACES:
 *   - it starts and answers (`build.smoke`);
 *   - Caddy lists exactly the 48 non-standard modules the mini's running Caddy lists
 *     (builds/caddy/modules.txt, measured 2026-09-22) — the plugins are really linked in;
 *   - it links only the OS: every `otool -L` entry is under /usr/lib or /System/Library.
 *     The Nix builds it replaces link /nix/store/…-libresolv-96; this is the check that
 *     the reason for this repository holds;
 *   - its code signature verifies (`codesign --verify`): Apple silicon refuses to run an
 *     unsigned or broken-signature binary, and Go's linker signs it ad hoc.
 */
import { join } from 'node:path';
import type { Build } from '../../builds/types.ts';
import { run } from './run.ts';

const SYSTEM = ['/usr/lib/', '/System/Library/'];

/** The `otool -L` load commands of a Mach-O, one path each. */
export const linkedLibraries = (otool: string): string[] =>
  otool
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(' (')[0] ?? '')
    .filter((path) => path !== '');

/** `caddy list-modules --versions --skip-standard` → just the `<module> <version>` lines. */
export const moduleLines = (text: string): string[] =>
  text.split('\n').filter((line) => /^\S+ v\S+$/.test(line));

export const smoke = async (build: Build, binary: string, root: string): Promise<void> => {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    throw new Error('smoke: runs only on darwin/arm64, where the binary can execute');
  }
  const { stdout } = await run([binary, ...build.smoke.args], {
    env: { ...process.env, ...build.smoke.env },
  });
  for (const expected of build.smoke.expect) {
    if (!stdout.includes(expected))
      throw new Error(`smoke: ${build.name} output lacks ${expected}`);
  }
  if (build.kind === 'xcaddy') {
    const listed = await run([binary, 'list-modules', '--versions', '--skip-standard'], {
      echo: false,
    });
    const expected = moduleLines(await Bun.file(join(root, build.modulesFile)).text());
    const actual = moduleLines(listed.stdout);
    if (actual.join('\n') !== expected.join('\n')) {
      const missing = expected.filter((line) => !actual.includes(line));
      const extra = actual.filter((line) => !expected.includes(line));
      throw new Error(
        `smoke: modules differ; missing ${missing.join(', ')}; extra ${extra.join(', ')}`,
      );
    }
    console.log(`smoke: ${String(actual.length)} non-standard modules, as measured on the mini`);
  }
  const libraries = linkedLibraries((await run(['otool', '-L', binary], { echo: false })).stdout);
  const foreign = libraries.filter((path) => !SYSTEM.some((prefix) => path.startsWith(prefix)));
  if (libraries.length === 0 || foreign.length > 0) {
    throw new Error(
      `smoke: links outside the OS: ${foreign.join(', ') || '(no load commands read)'}`,
    );
  }
  console.log(`smoke: links only ${libraries.join(', ')}`);
  await run(['codesign', '--verify', '--strict', '--verbose=2', binary]);
};
