/**
 * lablabs/cloudflare-exporter at the commit the mini runs — upstream ships no binary at all.
 *
 * ★ MEASURED 2026-09-22. The mini runs `/nix/store/…-cloudflare-exporter-0.3.0` (two
 *   launchd jobs, ports 9198/9199). Its derivation's source is nixpkgs'
 *   `fetchFromGitHub { owner = "lablabs"; tag = "cloudflare-exporter-0.3.0"; }`, and a clone
 *   of that tag is byte-identical to the store source (`diff -r`, .git excluded).
 * ⚠️ "0.3.0" IS A HELM CHART TAG, NOT AN APP RELEASE. Upstream tags its app `0.2.3` (no
 *   prefix; docker-release.yaml builds Linux images from those) and its chart
 *   `cloudflare-exporter-X`. `cloudflare-exporter-0.3.0` is a release made by hand on master
 *   (0 assets; charts/cloudflare-exporter/Chart.yaml at that commit still says 0.2.2) — and
 *   it is what nixpkgs packages. The code is master of 2025-11-08, 57 commits past app 0.2.3.
 *   This pins the COMMIT, so the name confusion cannot move what gets built.
 * ⚠️ NO VENDOR BINARY FOR DARWIN/ARM64, OR AT ALL. Releases carry no assets; go-build.yml
 *   targets linux/amd64, darwin/amd64 and linux/arm64 on release creation and attached
 *   nothing to this one. nixpkgs marks the package `platforms.linux` — conservatively, not
 *   because of any Linux-only code: it is pure Go (the house override notes it builds and
 *   runs on aarch64-darwin, 125 series against the live API). It needs no darwin patch.
 */
import type { GitBuild } from '../types.ts';

export const cloudflareExporter: GitBuild = {
  kind: 'git',
  name: 'cloudflare-exporter',
  version: '0.3.0',
  revision: 1,
  sourceDate: '2025-11-08T17:18:40Z',
  license: 'Apache-2.0',
  licenseSha256: '5baa859f70aa8559ce0db45ec507bfaefa6318b63154aac09e87c41b63e9282d',
  repository: 'https://github.com/lablabs/cloudflare-exporter.git',
  tag: 'cloudflare-exporter-0.3.0',
  commit: '763e5d79f50ed5ce4088c12b9c03a532bad3220c',
  goModSha256: '6da3b53aab8833fe19d545f780903bee5649bf7ce8e6b7da400c5dacd95a601c',
  goSumSha256: '10cec53e434eba06b6d23e2c1797459f903ac2e202e52ba197a8e7e1da3822ca',
  package: '.',
  flags: {
    tags: [],
    // ★ nixpkgs builds it with `-buildid=` and -trimpath; upstream's Makefile adds -s -w.
    ldflags: ['-s', '-w', '-buildid='],
    buildvcs: true,
  },
  // There is no --version; cobra's --help exits 0 and lists every flag the launchd jobs pass.
  smoke: { args: ['--help'], expect: ['--listen', '--scrape_interval'] },
};
