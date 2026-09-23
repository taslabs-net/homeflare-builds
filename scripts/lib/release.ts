/**
 * Names and the packing step: what a build's release is called, and what it contains.
 *
 * ⛔ EVERY NAME IS COMPUTED FROM THE MANIFEST, IN ONE PLACE. The build job, the publish job and
 *   the tests all call these; nothing retypes a tag or an asset name.
 * ★ TAG `<name>-v<version>-r<revision>`, ASSET `<name>-darwin-arm64-v<version>-r<revision>.tar.gz`.
 *   The asset repeats the version so a downloaded file still says what it is, and follows the
 *   `<package>-<os>-<arch>-v<version>` order VictoriaMetrics uses, which ReleaseBinary's first
 *   catalog already reads. No `/` or `+` in either: both appear in download URLs.
 */
import { type Build, TARGET } from '../../builds/types.ts';
import { type ChecksumLine, renderChecksums } from './checksums.ts';
import { sha256 } from './run.ts';
import { type TarEntry, gzip, writeTar } from './tar.ts';

export const REPOSITORY = 'taslabs-net/homeflare-builds';
export const CHECKSUMS_FILE = 'SHA256SUMS';
export const NOTES_FILE = 'notes.md';
/** ★ The upstream licence ships inside every archive, under this name. */
export const LICENSE_MEMBER = 'LICENSE';

export const releaseTag = (build: Build): string =>
  `${build.name}-v${build.version}-r${String(build.revision)}`;

export const archiveName = (build: Build): string =>
  `${build.name}-${TARGET.platform}-v${build.version}-r${String(build.revision)}.tar.gz`;

export const releaseTitle = (build: Build): string =>
  `${build.name} ${build.version} for ${TARGET.platform} (r${String(build.revision)})`;

export const assetUrl = (build: Build, file: string): string =>
  `https://github.com/${REPOSITORY}/releases/download/${releaseTag(build)}/${file}`;

/** The release's asset names, in upload order. */
export const releaseAssets = (build: Build): readonly string[] => [
  archiveName(build),
  CHECKSUMS_FILE,
];

/** The archive members, in archive order: the binary, then its licence. */
export const memberNames = (build: Build): readonly string[] => [build.name, LICENSE_MEMBER];

/** `sourceDate` as the whole seconds every archive entry carries. */
export const sourceEpoch = (build: Build): number => {
  const ms = Date.parse(build.sourceDate);
  if (!Number.isFinite(ms) || !build.sourceDate.endsWith('Z')) {
    throw new Error(`${build.name}: sourceDate ${build.sourceDate} is not an ISO-8601 UTC time`);
  }
  return Math.floor(ms / 1000);
};

export type Packed = {
  readonly archive: Uint8Array<ArrayBuffer>;
  readonly checksums: string;
  readonly lines: readonly ChecksumLine[];
};

/** Pack a built binary and its licence; the checksum file lists the archive, then each member. */
export const pack = (build: Build, binary: Uint8Array, license: Uint8Array): Packed => {
  const entries: TarEntry[] = [
    { bytes: binary, mode: 0o755, name: build.name },
    { bytes: license, mode: 0o644, name: LICENSE_MEMBER },
  ];
  const archive = gzip(writeTar(entries, sourceEpoch(build)));
  const lines: ChecksumLine[] = [
    { name: archiveName(build), sha256: sha256(archive) },
    ...entries.map((entry) => ({ name: entry.name, sha256: sha256(entry.bytes) })),
  ];
  return { archive, checksums: renderChecksums(lines), lines };
};
