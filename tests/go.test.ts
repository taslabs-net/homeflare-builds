/** The Go pin and the environment every build runs in. */
import { expect, test } from 'bun:test';
import { goEnv } from '../scripts/lib/go.ts';
import { GO_ARCHIVES, GO_VERSION, goHost } from '../toolchain/go.ts';

test('every pinned archive is this version, with a digest and a size', () => {
  for (const [host, archive] of Object.entries(GO_ARCHIVES)) {
    expect(archive.file).toBe(`go${GO_VERSION}.${host}.tar.gz`);
    expect(archive.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(archive.size).toBeGreaterThan(50_000_000);
  }
});

test('hosts map to the vendor spelling; an unpinned one throws', () => {
  expect(goHost('darwin', 'arm64')).toBe('darwin-arm64');
  expect(goHost('linux', 'x64')).toBe('linux-amd64');
  expect(() => goHost('win32', 'x64')).toThrow('no pinned Go');
  expect(() => goHost('darwin', 'x64')).toThrow('no pinned Go');
});

test('⛔ goEnv drops what changes a build and pins what must not move', () => {
  const saved = { ...process.env };
  process.env.GOFLAGS = '-mod=mod';
  process.env.GOOS = 'linux';
  process.env.CGO_ENABLED = '1';
  process.env.GOTOOLCHAIN = 'auto';
  try {
    const env = goEnv({ bin: '/opt/go/bin/go', host: 'darwin-arm64' }, { GOOS: 'darwin' });
    expect(env.GOFLAGS).toBeUndefined();
    expect(env.GOOS).toBe('darwin');
    expect(env.CGO_ENABLED).toBe('0');
    expect(env.GOTOOLCHAIN).toBe('local');
    expect(env.GOWORK).toBe('off');
    expect(env.GOPROXY).toBe('https://proxy.golang.org');
    expect(env.PATH?.startsWith('/opt/go/bin:')).toBe(true);
  } finally {
    process.env = saved;
  }
});
