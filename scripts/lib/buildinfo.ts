/**
 * Read a built binary's embedded build info (`go version -m`) and hold it to the manifest.
 *
 * ★ THE BINARY TESTIFIES ABOUT ITSELF. Every Go binary carries its toolchain, its build
 *   settings and every module version it was linked from. Checking those — rather than the
 *   flags we meant to pass — catches a wrapper that dropped a flag, a GOFLAGS leak, or a
 *   module graph that is not the one go.sum records. It runs on the cross-build too, where
 *   the darwin binary cannot be executed. The same text goes into the release notes.
 */
import { type Build, TARGET } from '../../builds/types.ts';
import { GO_VERSION } from '../../toolchain/go.ts';
import { type Go, goEnv } from './go.ts';
import { run } from './run.ts';

export type BuildInfo = {
  readonly go: string;
  readonly path: string;
  readonly settings: ReadonlyMap<string, string>;
  /** Module path → version, every `dep` line. */
  readonly deps: ReadonlyMap<string, string>;
  /** The whole `go version -m` text, for the release notes. */
  readonly text: string;
};

/** Parse `go version -m` output. */
export const parseBuildInfo = (text: string): BuildInfo => {
  const [first = '', ...rest] = text.trimEnd().split('\n');
  const go = first.slice(first.lastIndexOf(': ') + 2).trim();
  const settings = new Map<string, string>();
  const deps = new Map<string, string>();
  let path = '';
  for (const line of rest) {
    const [, kind = '', ...fields] = line.split('\t');
    if (kind === 'path') path = fields[0] ?? '';
    if (kind === 'dep') deps.set(fields[0] ?? '', fields[1] ?? '');
    if (kind === 'build') {
      const setting = fields.join('\t');
      const eq = setting.indexOf('=');
      settings.set(setting.slice(0, eq), setting.slice(eq + 1));
    }
  }
  return { deps, go, path, settings, text };
};

/** How a build's info differs from its manifest; empty when it matches. */
export const buildInfoProblems = (build: Build, info: BuildInfo): string[] => {
  const problems: string[] = [];
  const want = (what: string, actual: string | undefined, expected: string) => {
    if (actual !== expected) problems.push(`${what} is ${String(actual)}, expected ${expected}`);
  };
  want('go', info.go, `go${GO_VERSION}`);
  want('CGO_ENABLED', info.settings.get('CGO_ENABLED'), '0');
  want('GOOS', info.settings.get('GOOS'), TARGET.goos);
  want('GOARCH', info.settings.get('GOARCH'), TARGET.goarch);
  want('-trimpath', info.settings.get('-trimpath'), 'true');
  // ⚠️ NO `-ldflags` CHECK HERE: with -trimpath, go does not record -ldflags in build info at
  //   all (measured with go1.26.8: `-trimpath -ldflags=…` → no line; without -trimpath →
  //   `-ldflags="-s -w -buildid="`). The first release run failed on exactly this. Their
  //   EFFECT is checked instead, in `linkFlagProblems`.
  if (build.flags.tags.length > 0)
    want('-tags', info.settings.get('-tags'), build.flags.tags.join(','));
  if (build.kind === 'xcaddy') {
    want(build.caddy.module, info.deps.get(build.caddy.module), build.caddy.version);
    for (const plugin of build.plugins) {
      want(plugin.module, info.deps.get(plugin.module), plugin.version);
    }
  } else if (build.flags.buildvcs) {
    want('vcs.revision', info.settings.get('vcs.revision'), build.commit);
    want('vcs.modified', info.settings.get('vcs.modified'), 'false');
  }
  return problems;
};

/**
 * What the link flags did, read off the binary since build info cannot say (see above):
 * `-buildid=` leaves `go tool buildid` empty, and `-s` leaves `go tool nm` no defined symbol —
 * only the `U` imports from libSystem remain (measured on a go1.26.8 darwin/arm64 build).
 */
export const linkFlagProblems = (build: Build, buildid: string, nm: string): string[] => {
  const problems: string[] = [];
  if (build.flags.ldflags.includes('-buildid=') && buildid.trim() !== '') {
    problems.push(`build ID is ${buildid.trim()}, expected none (-buildid=)`);
  }
  const defined = nm.split('\n').filter((line) => line.trim() !== '' && !/^\s+U /.test(line));
  if (build.flags.ldflags.includes('-s') && defined.length > 0) {
    problems.push(`${String(defined.length)} symbols present, expected none (-s)`);
  }
  return problems;
};

/** Read `binary`'s build info with the pinned Go and refuse one that disagrees. */
export const verifyBuildInfo = async (go: Go, build: Build, binary: string): Promise<BuildInfo> => {
  const { stdout } = await run([go.bin, 'version', '-m', binary], { echo: false, env: goEnv(go) });
  const info = parseBuildInfo(stdout);
  const tool = (name: string) =>
    run([go.bin, 'tool', name, binary], { echo: false, env: goEnv(go) }).then((r) => r.stdout);
  const problems = [
    ...buildInfoProblems(build, info),
    ...linkFlagProblems(build, await tool('buildid'), await tool('nm')),
  ];
  if (problems.length > 0) throw new Error(`${build.name} build info:\n  ${problems.join('\n  ')}`);
  console.log(`${build.name}: build info matches (${String(info.deps.size)} modules)`);
  return info;
};
