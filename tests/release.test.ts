/** Names and packing: computed once, from the manifest, and stable. */
import { expect, test } from 'bun:test';
import { caddy } from '../builds/caddy/build.ts';
import { cloudflareExporter } from '../builds/cloudflare-exporter/build.ts';
import { BUILDS, buildNamed } from '../builds/index.ts';
import { parseChecksums } from '../scripts/lib/checksums.ts';
import {
  archiveName,
  assetUrl,
  memberNames,
  pack,
  releaseTag,
  sourceEpoch,
} from '../scripts/lib/release.ts';
import { sha256 } from '../scripts/lib/run.ts';
import { gunzip, readTar } from '../scripts/lib/tar.ts';

test('tags and asset names, exactly', () => {
  expect(releaseTag(caddy)).toBe('caddy-v2.11.4-r1');
  expect(archiveName(caddy)).toBe('caddy-darwin-arm64-v2.11.4-r1.tar.gz');
  expect(releaseTag(cloudflareExporter)).toBe('cloudflare-exporter-v0.3.0-r1');
  expect(assetUrl(caddy, 'SHA256SUMS')).toBe(
    'https://github.com/taslabs-net/homeflare-builds/releases/download/caddy-v2.11.4-r1/SHA256SUMS',
  );
});

test('⛔ no `/` or `+` in a tag or an asset name — both appear in download URLs', () => {
  for (const build of BUILDS) {
    expect(releaseTag(build)).toMatch(/^[a-z0-9.-]+$/);
    expect(archiveName(build)).toMatch(/^[a-z0-9.-]+$/);
  }
});

test('names are unique and resolvable; an unknown one throws', () => {
  expect(new Set(BUILDS.map((b) => b.name)).size).toBe(BUILDS.length);
  expect(buildNamed('caddy')).toBe(caddy);
  expect(() => buildNamed('caddy2')).toThrow('no build named');
});

test('sourceDate is whole UTC seconds', () => {
  expect(sourceEpoch(caddy)).toBe(Date.UTC(2026, 5, 1, 19, 35, 2) / 1000);
  expect(() => sourceEpoch({ ...caddy, sourceDate: '2026-06-01T19:35:02+02:00' })).toThrow();
});

test('pack: archive line first, then each member; the archive holds exactly those', () => {
  const binary = new TextEncoder().encode('binary');
  const license = new TextEncoder().encode('licence');
  const packed = pack(caddy, binary, license);
  const lines = parseChecksums(packed.checksums);
  expect(lines.map((l) => l.name)).toEqual([archiveName(caddy), ...memberNames(caddy)]);
  expect(lines[0]?.sha256).toBe(sha256(packed.archive));
  const entries = readTar(gunzip(packed.archive));
  expect(entries.map((e) => [e.name, e.mode])).toEqual([
    ['caddy', 0o755],
    ['LICENSE', 0o644],
  ]);
  expect(lines[1]?.sha256).toBe(sha256(binary));
  expect(Buffer.from(pack(caddy, binary, license).archive)).toEqual(Buffer.from(packed.archive));
});
