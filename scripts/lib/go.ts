/**
 * Install the pinned Go (toolchain/go.ts) and build with it — the only way any Go runs here.
 *
 * ⛔ SIZE AND SHA-256 ARE CHECKED BEFORE A BYTE IS EXTRACTED. A mismatch refuses, naming both
 *   digests; nothing half-verified is left on disk to be picked up by the next run.
 * ⛔ THE ENVIRONMENT IS BUILT, NOT INHERITED. `goEnv` drops every variable that changes what
 *   `go build` produces (GOFLAGS, GOROOT, GOOS/GOARCH, GOEXPERIMENT, CGO_*, GOWORK …) and sets
 *   the ones that pin it. A developer's shell exporting GOFLAGS=-mod=mod must not reach a build.
 * ★ GOPROXY WITHOUT `direct`. Every module comes through proxy.golang.org and is checked
 *   against sum.golang.org; a module the proxy does not have is a failure to look at, not a
 *   silent fetch from its VCS host.
 */
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type Build, TARGET } from '../../builds/types.ts';
import {
  GO_ARCHIVES,
  GO_DOWNLOAD_BASE,
  GO_VERSION,
  type GoHost,
  goHost,
} from '../../toolchain/go.ts';
import { run, sha256 } from './run.ts';

export type Go = { readonly bin: string; readonly host: GoHost };

/** Variables that change a Go build's output. None may leak in from the caller's shell. */
const DROPPED = [
  'GOROOT',
  'GOFLAGS',
  'GOOS',
  'GOARCH',
  'GOARM64',
  'GOAMD64',
  'GOEXPERIMENT',
  'GOTOOLCHAIN',
  'GOWORK',
  'GOPROXY',
  'GOSUMDB',
  'GONOSUMDB',
  'GONOSUMCHECK',
  'GOPRIVATE',
  'GONOPROXY',
  'GOINSECURE',
  'CGO_ENABLED',
  'CGO_CFLAGS',
  'CGO_LDFLAGS',
];

/** The environment every `go` and `xcaddy` invocation here runs in. */
export const goEnv = (
  go: Go,
  extra: Readonly<Record<string, string>> = {},
): Record<string, string | undefined> => {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const name of DROPPED) delete env[name];
  return {
    ...env,
    CGO_ENABLED: '0',
    GOPROXY: 'https://proxy.golang.org',
    GOSUMDB: 'sum.golang.org',
    GOTOOLCHAIN: 'local',
    GOWORK: 'off',
    // ★ First on PATH, so xcaddy's own `go` calls use the pin and not a system Go.
    PATH: `${dirname(go.bin)}:${process.env.PATH ?? ''}`,
    ...extra,
  };
};

const requireVersion = async (go: Go): Promise<void> => {
  const { stdout } = await run([go.bin, 'version'], { echo: false, env: goEnv(go) });
  const expected = `go version go${GO_VERSION} ${go.host.replace('-', '/')}`;
  if (stdout.trim() !== expected) {
    throw new Error(`${go.bin} reports "${stdout.trim()}", expected "${expected}"`);
  }
};

/** Download (or reuse) the pinned Go under `into`; return it once `go version` agrees. */
export const installGo = async (into: string, host: GoHost = goHost()): Promise<Go> => {
  const archive = GO_ARCHIVES[host];
  const root = join(into, `go${GO_VERSION}-${host}`);
  const go: Go = { bin: join(root, 'go', 'bin', 'go'), host };
  // ★ Reuse is a local convenience; only a tree extracted from a verified archive exists here.
  if (await Bun.file(go.bin).exists()) {
    await requireVersion(go);
    return go;
  }
  const url = `${GO_DOWNLOAD_BASE}${archive.file}`;
  console.log(`fetching ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${String(response.status)}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== archive.size) {
    throw new Error(
      `${archive.file}: ${String(bytes.byteLength)} bytes, pinned ${String(archive.size)}`,
    );
  }
  const digest = sha256(bytes);
  if (digest !== archive.sha256) {
    throw new Error(`${archive.file}: SHA-256 ${digest}, pinned ${archive.sha256} — refusing`);
  }
  await rm(root, { force: true, recursive: true });
  await mkdir(root, { recursive: true });
  const file = join(root, archive.file);
  await Bun.write(file, bytes);
  await run(['tar', '-xzf', file, '-C', root], { echo: false });
  await rm(file);
  await requireVersion(go);
  console.log(`go ${GO_VERSION} for ${host}: ${archive.sha256} verified`);
  return go;
};

/** `go build` one package for the target, with exactly the build's flags. */
export const goBuild = async (
  go: Go,
  build: Build,
  sourceDir: string,
  pkg: string,
  out: string,
): Promise<void> => {
  const { flags } = build;
  const argv = [
    go.bin,
    'build',
    '-mod=readonly',
    '-trimpath',
    `-buildvcs=${String(flags.buildvcs)}`,
    `-ldflags=${flags.ldflags.join(' ')}`,
    ...(flags.tags.length === 0 ? [] : [`-tags=${flags.tags.join(',')}`]),
    '-o',
    out,
    pkg,
  ];
  await run(argv, { cwd: sourceDir, env: goEnv(go, { GOARCH: TARGET.goarch, GOOS: TARGET.goos }) });
};
