/**
 * `bun run builds:build <name> [--out dist]` — the release build, on darwin/arm64.
 *
 * Installs the pinned Go, builds, checks build info, smoke-tests the binary on the platform
 * it is for, packs it with its licence, and writes to `<out>/<name>/`:
 *   <archive>.tar.gz   SHA256SUMS   notes.md
 *
 * ⛔ IT PUBLISHES NOTHING AND HOLDS NO WRITE TOKEN. release.yml runs it in a job with
 *   `contents: read`; a separate job, after re-verifying these files, attests and publishes.
 */
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { buildNamed } from '../builds/index.ts';
import { goHost } from '../toolchain/go.ts';
import { installGo } from './lib/go.ts';
import { renderNotes } from './lib/notes.ts';
import { buildOne, repoRoot, toolCache } from './lib/pipeline.ts';
import { CHECKSUMS_FILE, NOTES_FILE, archiveName, pack } from './lib/release.ts';
import { smoke } from './lib/smoke.ts';

const [name = '', ...rest] = Bun.argv.slice(2);
const outFlag = rest.indexOf('--out');
const out = outFlag === -1 ? 'dist' : (rest[outFlag + 1] ?? 'dist');

const root = repoRoot(import.meta.dir);
const build = buildNamed(name);
const go = await installGo(toolCache(root));
const built = await buildOne(go, build, root);
await smoke(build, built.binary, root);

const packed = pack(
  build,
  new Uint8Array(await Bun.file(built.binary).arrayBuffer()),
  new Uint8Array(await Bun.file(built.license).arrayBuffer()),
);
const dir = join(out, build.name);
await rm(dir, { force: true, recursive: true });
await mkdir(dir, { recursive: true });
await Bun.write(join(dir, archiveName(build)), packed.archive);
await Bun.write(join(dir, CHECKSUMS_FILE), packed.checksums);
const server = process.env.GITHUB_SERVER_URL;
const runId = process.env.GITHUB_RUN_ID;
await Bun.write(
  join(dir, NOTES_FILE),
  renderNotes(build, packed.lines, built.info, {
    commit: process.env.GITHUB_SHA ?? 'local',
    host: goHost(),
    runner: `${process.env.ImageOS ?? 'local'} ${process.env.ImageVersion ?? ''}`.trim(),
    ...(server === undefined || runId === undefined
      ? {}
      : { runUrl: `${server}/${process.env.GITHUB_REPOSITORY ?? ''}/actions/runs/${runId}` }),
  }),
);
console.log(`\n${CHECKSUMS_FILE}:\n${packed.checksums}`);
