/**
 * `bun run catalog <name>` — print the kit data-set entry for a PUBLISHED release, in the shape
 * homeflare-kit's Release.Binary data sets pin (`CatalogPackage` → `PinnedArchive`: repo, tag,
 * asset, size, sha256, members, checksums — kit PR 138, src/release/catalog.ts, read 2026-09-22).
 *
 * ★ READ FROM THE RELEASE, CROSS-CHECKED, the walk-down the kit's
 *   docs/release-binary-catalogs.md asks of any new version:
 *   1. the release API: exact asset names, sizes, GitHub's `digest` of each, and `immutable`;
 *   2. SHA256SUMS fetched and parsed strictly; its own SHA-256 must equal GitHub's digest of it,
 *      and its archive line must equal GitHub's digest of the archive;
 *   3. the archive is downloaded, gunzipped and read with this repository's strict tar reader:
 *      root-level regular files, exactly the listed members, each matching its line.
 * ⚠️ NETWORK (api.github.com, github.com). Not part of `bun run check`.
 */
import { buildNamed } from '../builds/index.ts';
import { TARGET } from '../builds/types.ts';
import { parseChecksums } from './lib/checksums.ts';
import {
  CHECKSUMS_FILE,
  REPOSITORY,
  archiveName,
  assetUrl,
  memberNames,
  releaseTag,
} from './lib/release.ts';
import { sha256 } from './lib/run.ts';
import { gunzip, readTar } from './lib/tar.ts';

type Asset = { readonly name: string; readonly size: number; readonly digest?: string | null };

const build = buildNamed(Bun.argv[2] ?? '');
const tag = releaseTag(build);
const fail = (why: string): never => {
  throw new Error(`${tag}: ${why}`);
};
const download = async (file: string): Promise<Uint8Array<ArrayBuffer>> => {
  const response = await fetch(assetUrl(build, file));
  if (!response.ok) fail(`${file} answered ${String(response.status)}`);
  return new Uint8Array(await response.arrayBuffer());
};

const api = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/tags/${tag}`, {
  headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
});
if (!api.ok) fail(`release API answered ${String(api.status)}`);
const release = (await api.json()) as { assets: Asset[]; immutable?: boolean };
if (release.immutable !== true) fail('the release is not immutable');
const asset = (name: string): Asset =>
  release.assets.find((candidate) => candidate.name === name) ?? fail(`no asset ${name}`);

// 2. SHA256SUMS: strict, and agreeing with GitHub's own digests.
const sumsBytes = await download(CHECKSUMS_FILE);
const sumsDigest = sha256(sumsBytes);
if (asset(CHECKSUMS_FILE).digest !== `sha256:${sumsDigest}`) fail('SHA256SUMS ≠ GitHub digest');
const lines = parseChecksums(new TextDecoder().decode(sumsBytes));
const archive = asset(archiveName(build));
const archiveLine = lines[0] ?? fail('SHA256SUMS is empty');
if (archiveLine.name !== archive.name) fail('SHA256SUMS line 1 is not the archive');
if (archive.digest !== `sha256:${archiveLine.sha256}`) fail('archive line ≠ GitHub digest');

// 3. The archive itself, read strictly, members against their lines.
const archiveBytes = await download(archive.name);
if (archiveBytes.byteLength !== archive.size || sha256(archiveBytes) !== archiveLine.sha256) {
  fail('the downloaded archive is not the one the release lists');
}
const entries = readTar(gunzip(archiveBytes));
if (entries.map((entry) => entry.name).join(',') !== memberNames(build).join(',')) {
  fail(`archive holds ${entries.map((entry) => entry.name).join(', ')}`);
}
for (const entry of entries) {
  const line = lines.find((candidate) => candidate.name === entry.name);
  if (line?.sha256 !== sha256(entry.bytes)) fail(`${entry.name} ≠ its SHA256SUMS line`);
}

const members = lines
  .slice(1)
  .map((line) => `              '${line.name}': '${line.sha256}',`)
  .join('\n');
const size = String(archive.size).replaceAll(/\B(?=(\d{3})+(?!\d))/g, '_');
console.log(`    // ${tag}: immutable release; SLSA attestation over every SHA256SUMS line.
    '${build.name}': {
      binaries: { '${build.name}': '${build.name}' },
      versions: {
        '${build.version}-r${String(build.revision)}': {
          '${TARGET.platform}': {
            asset: '${archive.name}',
            checksums: {
              recorded: '${new Date().toLocaleDateString('en-CA')}',
              sha256: '${sumsDigest}',
              url: '${assetUrl(build, CHECKSUMS_FILE)}',
            },
            members: {
${members}
            },
            repo: '${REPOSITORY}',
            sha256: '${archiveLine.sha256}',
            size: ${size},
            tag: '${tag}',
          },
        },
      },
    },`);
