/**
 * Build one manifest into a verified binary — the path the release job and the PR job share.
 *
 * ★ ONE PIPELINE, TWO HOSTS. The release job runs it on macos-26 and then smoke-tests and
 *   packs; the PR job runs it on ubuntu-latest as a cross-build. Same steps, same flags, same
 *   build-info check, so a pull request that goes green has built what the release will build.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Build } from '../../builds/types.ts';
import { type BuildInfo, verifyBuildInfo } from './buildinfo.ts';
import { caddyLicense } from './caddy.ts';
import { type Go, goBuild } from './go.ts';
import { prepareUpstream } from './upstream.ts';

export type Built = {
  readonly binary: string;
  readonly license: string;
  readonly info: BuildInfo;
};

/** Build `build` for darwin/arm64 with `go`, from the repository at `root`. */
export const buildOne = async (go: Go, build: Build, root: string): Promise<Built> => {
  const work = await mkdtemp(join(tmpdir(), `${build.name}-`));
  const binary = join(work, build.name);
  let license: string;
  if (build.kind === 'xcaddy') {
    // ★ Built in the committed module itself: its go.sum is the one that must hold.
    await goBuild(go, build, join(root, build.moduleDir), '.', binary);
    license = await caddyLicense(go, build, root);
  } else {
    const source = join(work, 'source');
    license = await prepareUpstream(build, source);
    await goBuild(go, build, source, build.package, binary);
  }
  const info = await verifyBuildInfo(go, build, binary);
  return { binary, info, license };
};

/** Where the pinned Go lives: the runner's temp directory in Actions, `.cache/` locally. */
export const toolCache = (root: string): string => process.env.RUNNER_TEMP ?? join(root, '.cache');

/** The repository root, from a script under scripts/. */
export const repoRoot = (scriptDir: string): string => join(scriptDir, '..');

/** Append `key=value` lines to $GITHUB_OUTPUT when running in Actions; print them either way. */
export const setOutputs = async (outputs: Readonly<Record<string, string>>): Promise<void> => {
  const text = Object.entries(outputs)
    .map(([key, value]) => {
      if (value.includes('\n')) throw new Error(`output ${key} must be one line`);
      return `${key}=${value}\n`;
    })
    .join('');
  process.stdout.write(text);
  const file = process.env.GITHUB_OUTPUT;
  if (file !== undefined && file !== '') {
    const previous = (await Bun.file(file).exists()) ? await Bun.file(file).text() : '';
    await Bun.write(file, previous + text);
  }
};
