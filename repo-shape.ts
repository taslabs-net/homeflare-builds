/**
 * homeflare-builds' tooling, as one declaration (`@homeflare/config/repo-shape`).
 *
 * ⛔ EDIT THIS FILE, NOT THE FILES IT RENDERS. `bun run repo-shape:refresh` rewrites
 *   .github/workflows/ci.yml, .github/workflows/security.yml and .github/dependabot.yml from
 *   here; `tests/repo-shape.test.ts` fails `bun run check` on a hand edit.
 * ⛔ `.github/workflows/release.yml` IS NOT RENDERED — @homeflare/config renders no release
 *   workflow for any repository yet (its docs/repo-shape.md, "What this does not render yet").
 *   It is this repository's own file, and the only one here with write permissions.
 */
import { type RepoShape, except, extraJob, repoShapeCli } from '@homeflare/config/repo-shape';

export const shape: RepoShape = {
  owner: 'taslabs-net',
  repository: 'homeflare-builds',

  // ⛔ GITHUB-HOSTED ONLY, NEVER THE MINI. This repository is PUBLIC: any fork can open a pull
  //   request, and on a self-hosted runner that pull request's code would run on the mini's
  //   LAN. Hosted minutes are free for public repositories, so the billing lock that put the
  //   private estate on `[self-hosted, homeflare-mini]` (2026-09-22) does not apply here.
  //   homeflare-kit is the precedent: public, `ubuntu-latest` only, zero self-hosted runners.
  //   The mini's daemon refuses a public repository on its own side too (homeflare-mini
  //   src/ci-runner/startup.ts and start.ts), so this line and that check are two locks.
  runner: 'github',

  // ★ Nothing here is an npm package. The binaries are GitHub Release assets.
  publishes: false,

  extraJobs: [
    extraJob({
      id: 'builds',
      name: 'go builds',
      reason:
        'the one repository that builds Go binaries: it installs the pinned, checksum-verified Go, proves the committed Caddy module is exactly what the pinned xcaddy generates, checks the cloudflare-exporter source pins, and cross-builds both darwin/arm64 binaries so a broken pin fails the pull request rather than the release',
      steps: [{ name: 'Verify the build inputs and cross-build', run: 'bun run builds:verify' }],
    }),
  ],

  exceptions: [
    except({
      file: '.changeset/config.json',
      reason:
        'this repository versions no package: its GitHub Releases ARE the binary builds, one immutable release per build tag, and a changesets release of the repository itself would sit among them looking like one',
      since: '2026-09-22',
    }),
  ],
};

if (import.meta.main) {
  process.exit(await repoShapeCli(import.meta.dir, shape, Bun.argv.slice(2)));
}
