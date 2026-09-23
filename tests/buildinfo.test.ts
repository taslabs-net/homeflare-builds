/** Build info is held to the manifest: toolchain, flags, and every pinned module. */
import { expect, test } from 'bun:test';
import { caddy } from '../builds/caddy/build.ts';
import { cloudflareExporter } from '../builds/cloudflare-exporter/build.ts';
import { buildInfoProblems, linkFlagProblems, parseBuildInfo } from '../scripts/lib/buildinfo.ts';

const settings = (tags: string) =>
  [
    '\tbuild\t-buildmode=exe',
    '\tbuild\t-compiler=gc',
    '\tbuild\t-buildvcs=false',
    // ⚠️ no -ldflags line: go omits it under -trimpath (see buildinfo.ts)
    ...(tags === '' ? [] : [`\tbuild\t-tags=${tags}`]),
    '\tbuild\t-trimpath=true',
    '\tbuild\tCGO_ENABLED=0',
    '\tbuild\tGOARCH=arm64',
    '\tbuild\tGOOS=darwin',
    '\tbuild\tGOARM64=v8.0',
  ].join('\n');

const caddyInfo = `/tmp/caddy-x/caddy: go1.26.8
\tpath\tcaddy
\tmod\tcaddy\t(devel)\t
\tdep\tgithub.com/caddy-dns/cloudflare\tv0.2.4\th1:x=
\tdep\tgithub.com/caddyserver/caddy/v2\tv2.11.4\th1:x=
\tdep\tgithub.com/ggicci/caddy-jwt\tv1.4.0\th1:x=
\tdep\tgithub.com/greenpau/caddy-security\tv1.1.64\th1:x=
\tdep\tgithub.com/mholt/caddy-l4\tv0.1.2\th1:x=
${settings('nobadger,nomysql,nopgx')}
`;

test('a build matching its manifest has no problems', () => {
  const info = parseBuildInfo(caddyInfo);
  expect(info.go).toBe('go1.26.8');
  expect(info.path).toBe('caddy');
  expect(info.deps.get('github.com/caddyserver/caddy/v2')).toBe('v2.11.4');
  expect(buildInfoProblems(caddy, info)).toEqual([]);
});

test('⛔ a wrong toolchain, cgo, tag or plugin version is named', () => {
  const bad = caddyInfo
    .replace('go1.26.8', 'go1.26.7')
    .replace('CGO_ENABLED=0', 'CGO_ENABLED=1')
    .replace('nobadger,nomysql,nopgx', 'nobadger')
    .replace('caddy-l4\tv0.1.2', 'caddy-l4\tv0.1.3');
  expect(buildInfoProblems(caddy, parseBuildInfo(bad))).toEqual([
    'go is go1.26.7, expected go1.26.8',
    'CGO_ENABLED is 1, expected 0',
    '-tags is nobadger, expected nobadger,nomysql,nopgx',
    'github.com/mholt/caddy-l4 is v0.1.3, expected v0.1.2',
  ]);
});

test('an upstream clone must record the pinned commit, unmodified', () => {
  const vcs = (revision: string, modified: string) =>
    `/x/cloudflare-exporter: go1.26.8\n\tpath\tgithub.com/lablabs/cloudflare-exporter\n${settings('')}\n\tbuild\tvcs=git\n\tbuild\tvcs.revision=${revision}\n\tbuild\tvcs.modified=${modified}\n`;
  const good = parseBuildInfo(vcs(cloudflareExporter.commit, 'false'));
  expect(buildInfoProblems(cloudflareExporter, good)).toEqual([]);
  const dirty = parseBuildInfo(vcs('0'.repeat(40), 'true'));
  expect(buildInfoProblems(cloudflareExporter, dirty)).toHaveLength(2);
});

test('the link flags are judged by their effect: no build ID, no defined symbols', () => {
  const stripped = '         U ___error\n         U __exit\n';
  expect(linkFlagProblems(caddy, '', stripped)).toEqual([]);
  expect(linkFlagProblems(caddy, 'Zfo/hmb/t_G/sZI\n', '100078930 R $f64.3eb\n')).toEqual([
    'build ID is Zfo/hmb/t_G/sZI, expected none (-buildid=)',
    '1 symbols present, expected none (-s)',
  ]);
});
