/**
 * The manifests against the files they describe — offline, so it runs in `bun run check`.
 * ★ The network half (regenerate with xcaddy, clone upstream) is `bun run builds:verify`.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { caddy } from '../builds/caddy/build.ts';
import { cloudflareExporter } from '../builds/cloudflare-exporter/build.ts';
import { BUILDS } from '../builds/index.ts';
import { xcaddyArgs } from '../scripts/lib/caddy.ts';

const root = join(import.meta.dir, '..');
const read = (path: string) => Bun.file(join(root, path)).text();

/** `require` lines of a go.mod: module → version, direct only unless `indirect` is true. */
const requires = (goMod: string, indirect: boolean) =>
  new Map(
    [...goMod.matchAll(/^\t(\S+) (v\S+)( \/\/ indirect)?$/gm)]
      .filter((m) => (m[3] !== undefined) === indirect)
      .map((m) => [m[1] ?? '', m[2] ?? '']),
  );

describe('caddy: the committed module is the manifest', () => {
  test('go.mod requires exactly Caddy and the four plugins, at the pinned versions', async () => {
    const direct = requires(await read(`${caddy.moduleDir}/go.mod`), false);
    const expected = [caddy.caddy, ...caddy.plugins].map((p): [string, string] => [
      p.module,
      p.version,
    ]);
    expect([...direct].toSorted()).toEqual(expected.toSorted());
  });

  // ★ `time/tzdata` is xcaddy v0.4.7's (caddyserver/xcaddy PR 287): the IANA database is
  //   embedded, so time zones resolve even where the host has none. v0.4.6 did not add it.
  test('main.go imports tzdata, Caddy, the standard modules and exactly the plugins', async () => {
    const imports = [...(await read(`${caddy.moduleDir}/main.go`)).matchAll(/"([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(imports.toSorted()).toEqual(
      [
        'github.com/caddyserver/caddy/v2/cmd',
        'github.com/caddyserver/caddy/v2/modules/standard',
        'time/tzdata',
        ...caddy.plugins.map((p) => p.module),
      ].toSorted(),
    );
  });

  test('go.sum covers every required module', async () => {
    const goSum = await read(`${caddy.moduleDir}/go.sum`);
    const goMod = await read(`${caddy.moduleDir}/go.mod`);
    for (const [module, version] of [...requires(goMod, false), ...requires(goMod, true)]) {
      expect(goSum).toContain(`${module} ${version}/go.mod h1:`);
    }
  });

  test('xcaddy is called with the pinned Caddy and each plugin, in manifest order', () => {
    expect(xcaddyArgs(caddy)).toEqual([
      'build',
      'v2.11.4',
      '--with',
      'github.com/caddy-dns/cloudflare@v0.2.4',
      '--with',
      'github.com/ggicci/caddy-jwt@v1.4.0',
      '--with',
      'github.com/greenpau/caddy-security@v1.1.64',
      '--with',
      'github.com/mholt/caddy-l4@v0.1.2',
    ]);
  });
});

describe('every manifest is fully pinned', () => {
  test.each(BUILDS.map((b) => [b.name, b] as const))('%s', (_name, build) => {
    expect(build.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Number.isInteger(build.revision) && build.revision >= 1).toBe(true);
    expect(build.licenseSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(build.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(build.flags.ldflags).toContain('-buildid=');
    if (build.kind === 'git') {
      expect(build.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(build.goModSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(build.goSumSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(build.repository).toMatch(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/);
    } else {
      for (const pin of [build.caddy, build.xcaddy, ...build.plugins]) {
        expect(pin.version).toMatch(/^v\d+\.\d+\.\d+$/);
      }
    }
  });

  test('the exporter pin is the commit the mini runs (nixpkgs tag cloudflare-exporter-0.3.0)', () => {
    expect(cloudflareExporter.tag).toBe('cloudflare-exporter-0.3.0');
    expect(cloudflareExporter.commit).toBe('763e5d79f50ed5ce4088c12b9c03a532bad3220c');
  });
});
