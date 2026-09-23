/**
 * `bun run builds:verify` — the pull request's `go builds` job (ubuntu-latest).
 *
 *   1. installs the pinned Go for this host (checksum-verified);
 *   2. regenerates the Caddy module with the pinned xcaddy and fails on ANY difference from
 *      the committed go.mod, go.sum or main.go;
 *   3. cross-builds every manifest for darwin/arm64, verifying the upstream pins and the
 *      binary's build info, and packs it exactly as the release would;
 *   4. when a release for that exact tag already exists, requires the fresh build to
 *      reproduce its published digests (`reproductionProblems`).
 *
 * ⚠️ NETWORK: proxy.golang.org, sum.golang.org, dl.google.com, github.com. That is why this is
 *   its own CI job and not part of `bun run check`, which stays local-only like every
 *   estate repository's.
 */
import { BUILDS } from '../builds/index.ts';
import type { Build } from '../builds/types.ts';
import { compareCaddyModule } from './lib/caddy.ts';
import { type ChecksumLine, parseChecksums } from './lib/checksums.ts';
import { installGo } from './lib/go.ts';
import { buildOne, repoRoot, toolCache } from './lib/pipeline.ts';
import { CHECKSUMS_FILE, assetUrl, pack, releaseTag } from './lib/release.ts';

/**
 * ★ A PUBLISHED TAG IS A PROMISE ABOUT ITS INPUTS. If the manifest still names a released tag,
 *   building it again must give the same member bytes; a difference means an input changed
 *   without a `revision` bump, and the release no longer describes what this commit builds.
 */
const reproductionProblems = async (build: Build, lines: readonly ChecksumLine[]) => {
  const response = await fetch(assetUrl(build, CHECKSUMS_FILE));
  if (response.status === 404) {
    console.log(`${releaseTag(build)}: not released yet — nothing to reproduce`);
    return [];
  }
  if (!response.ok) return [`${releaseTag(build)}: SHA256SUMS answered ${String(response.status)}`];
  const published = parseChecksums(await response.text());
  const problems = lines
    .filter((line) => published.find((p) => p.name === line.name)?.sha256 !== line.sha256)
    .map((line) => `${releaseTag(build)}: ${line.name} built ${line.sha256}, released otherwise`);
  if (problems.length === 0) console.log(`${releaseTag(build)}: reproduced byte for byte`);
  return problems;
};

const root = repoRoot(import.meta.dir);
const go = await installGo(toolCache(root));
const problems: string[] = [];

for (const build of BUILDS) {
  console.log(`\n── ${build.name} ${build.version} r${String(build.revision)}`);
  if (build.kind === 'xcaddy') problems.push(...(await compareCaddyModule(go, build, root)));
  const built = await buildOne(go, build, root);
  const packed = pack(
    build,
    new Uint8Array(await Bun.file(built.binary).arrayBuffer()),
    new Uint8Array(await Bun.file(built.license).arrayBuffer()),
  );
  console.log(packed.checksums);
  problems.push(...(await reproductionProblems(build, packed.lines)));
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.join('\n✗ ')}`);
  process.exit(1);
}
console.log('\nevery build input verified; every build cross-built');
