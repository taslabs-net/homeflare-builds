/**
 * The one Go toolchain every build here uses, pinned by the vendor's own digests.
 *
 * ★ GROUND TRUTH: https://go.dev/dl/?mode=json&include=all, read 2026-09-22. Each entry below
 *   is that listing's `filename`, `sha256` and `size`, copied — never computed from a download
 *   of our own, which would only prove that we downloaded something.
 * ★ WHY 1.26.8 AND NOT 1.27.1 (both current on 2026-09-22). Caddy v2.11.4 was released by a
 *   workflow that installs Go `~1.26.0` (its .github/workflows/release.yml at the tag), and
 *   the mini's running Caddy and exporter are both go1.26.7 (`go version -m`, measured).
 *   1.26.8 is the newest patch on that line. A new Go MINOR is its own reviewed change, and a
 *   `revision` bump on every build it touches.
 * ⛔ NOT actions/setup-go. It installs GitHub's repackaging (actions/go-versions) and gives a
 *   workflow no digest to pin. scripts/lib/go.ts downloads the vendor's archive and refuses
 *   one whose size or SHA-256 differs from these lines.
 * ⛔ GOTOOLCHAIN=local EVERYWHERE (scripts/lib/go.ts `goEnv`). Without it, a `go` or
 *   `toolchain` line newer than this in any go.mod makes the go command DOWNLOAD a different
 *   toolchain and build with that — silently replacing the pin.
 */

export const GO_VERSION = '1.26.8';

/** Where the vendor serves its archives (go.dev/dl/<file> redirects here). */
export const GO_DOWNLOAD_BASE = 'https://dl.google.com/go/';

/** A host this repository builds on: the release runner and the CI runner. */
export type GoHost = 'darwin-arm64' | 'linux-amd64' | 'linux-arm64';

export type GoArchive = {
  readonly file: string;
  readonly sha256: string;
  readonly size: number;
};

export const GO_ARCHIVES: Readonly<Record<GoHost, GoArchive>> = {
  // macos-26 (arm64): the release build.
  'darwin-arm64': {
    file: 'go1.26.8.darwin-arm64.tar.gz',
    sha256: 'a012b25b571bd0138a03dcd25375ceba866fe5ca822f426d2c66a4de56fd3f4b',
    size: 64_626_620,
  },
  // ubuntu-latest (x64): the pull-request cross-build.
  'linux-amd64': {
    file: 'go1.26.8.linux-amd64.tar.gz',
    sha256: 'd0f743b33e8d8945e6b1f432edd15785c70507121d6e2a723b21285eddf8b57b',
    size: 66_897_291,
  },
  // ubuntu-24.04-arm, should the cross-build ever move there.
  'linux-arm64': {
    file: 'go1.26.8.linux-arm64.tar.gz',
    sha256: '211ffced9dcb9633a55eac6364816ec0ddd951389a740e88fa8b3337971bdda0',
    size: 63_811_405,
  },
};

/** This process's host in the vendor's spelling; throws on one with no pinned archive. */
export const goHost = (platform = process.platform, arch = process.arch): GoHost => {
  const os = platform === 'darwin' ? 'darwin' : platform === 'linux' ? 'linux' : undefined;
  const cpu = arch === 'arm64' ? 'arm64' : arch === 'x64' ? 'amd64' : undefined;
  const host = os === undefined || cpu === undefined ? undefined : `${os}-${cpu}`;
  if (host === undefined || !(host in GO_ARCHIVES)) {
    throw new Error(`no pinned Go archive for ${platform}/${arch}`);
  }
  return host as GoHost;
};
