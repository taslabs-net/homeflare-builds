/**
 * `bun run catalog <name>` — print the kit catalog entry for a PUBLISHED release, in the shape
 * homeflare-kit's Victoria.Binary catalog pins (`PinnedArchive`, kit PR 138), which the kit's
 * ReleaseBinary generalises.
 *
 * ★ READ FROM THE RELEASE, CROSS-CHECKED THREE WAYS, the chain the kit's catalog test proves:
 *   1. SHA256SUMS is downloaded and parsed strictly; its own digest is recorded;
 *   2. every asset's SHA-256 equals GitHub's `digest` for that asset (the release API);
 *   3. the archive's line in SHA256SUMS equals both.
 *   The archive's size comes from the release API, as the kit's pins do.
 * ⚠️ NETWORK (api.github.com, github.com). Not part of `bun run check`.
 */
import { buildNamed } from '../builds/index.ts';
import { TARGET } from '../builds/types.ts';
import { parseChecksums } from './lib/checksums.ts';
import { CHECKSUMS_FILE, REPOSITORY, archiveName, assetUrl, releaseTag } from './lib/release.ts';
import { sha256 } from './lib/run.ts';

type Asset = { readonly name: string; readonly size: number; readonly digest?: string | null };

const build = buildNamed(Bun.argv[2] ?? '');
const tag = releaseTag(build);
const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/tags/${tag}`, {
  headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
});
if (!response.ok) throw new Error(`${tag}: release API answered ${String(response.status)}`);
const release = (await response.json()) as { assets: Asset[]; immutable?: boolean };

const sumsResponse = await fetch(assetUrl(build, CHECKSUMS_FILE));
if (!sumsResponse.ok) throw new Error(`${tag}: SHA256SUMS answered ${String(sumsResponse.status)}`);
const sumsBytes = new Uint8Array(await sumsResponse.arrayBuffer());
const lines = parseChecksums(new TextDecoder().decode(sumsBytes));

const asset = (name: string): Asset => {
  const found = release.assets.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`${tag}: no asset ${name}`);
  return found;
};
const archive = asset(archiveName(build));
const archiveLine = lines[0];
if (archiveLine?.name !== archive.name)
  throw new Error(`${tag}: SHA256SUMS line 1 is not the archive`);
if (archive.digest !== `sha256:${archiveLine.sha256}`) {
  throw new Error(
    `${tag}: GitHub digest ${String(archive.digest)} ≠ SHA256SUMS ${archiveLine.sha256}`,
  );
}
const sumsDigest = sha256(sumsBytes);
if (asset(CHECKSUMS_FILE).digest !== `sha256:${sumsDigest}`) {
  throw new Error(`${tag}: SHA256SUMS digest differs from GitHub's`);
}
if (release.immutable !== true) throw new Error(`${tag}: the release is not immutable`);

const members = lines
  .slice(1)
  .map((line) => `            ${JSON.stringify(line.name)}: '${line.sha256}',`)
  .join('\n');
console.log(`  // ${tag} — immutable release, attested (gh attestation verify … --repo ${REPOSITORY}).
  '${build.name}': {
    binaries: { '${build.name}': '${build.name}' },
    versions: {
      '${build.version}-r${String(build.revision)}': {
        '${TARGET.platform}': {
          checksums: {
            recorded: '${new Date().toISOString().slice(0, 10)}',
            sha256: '${sumsDigest}',
            url: '${assetUrl(build, CHECKSUMS_FILE)}',
          },
          members: {
${members}
          },
          sha256: '${archiveLine.sha256}',
          size: ${archive.size.toLocaleString('en-US').replaceAll(',', '_')},
          url: '${assetUrl(build, archive.name)}',
        },
      },
    },
  },`);
