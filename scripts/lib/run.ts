/**
 * Subprocesses and digests — the two things every build step does.
 *
 * ⛔ A COMMAND THAT FAILS THROWS, NAMING ITSELF AND ITS STDERR. Nothing here returns a failed
 *   exit code for a caller to forget to check: a build that half-ran must not reach `pack`.
 * ★ argv, NEVER A SHELL STRING. No quoting to get wrong, and nothing in a pin can be read as
 *   shell syntax.
 */

export type RunOptions = {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Echo the command before running it (CI logs read better with it). Default true. */
  readonly echo?: boolean;
};

export type RunResult = { readonly stdout: string; readonly stderr: string };

/** Run argv to completion; throw unless it exits 0. */
export const run = async (
  argv: readonly string[],
  options: RunOptions = {},
): Promise<RunResult> => {
  if (options.echo !== false) console.log(`$ ${argv.join(' ')}`);
  const child = Bun.spawn([...argv], {
    cwd: options.cwd,
    env: options.env === undefined ? process.env : { ...options.env },
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) {
    throw new Error(`${argv.join(' ')} exited ${String(code)}\n${stderr.trim() || stdout.trim()}`);
  }
  return { stderr, stdout };
};

/** Lower-case hex SHA-256 of some bytes. */
export const sha256 = (bytes: Uint8Array | ArrayBuffer): string =>
  new Bun.CryptoHasher('sha256').update(bytes).digest('hex');

/** Lower-case hex SHA-256 of a file. */
export const sha256File = async (path: string): Promise<string> =>
  sha256(await Bun.file(path).arrayBuffer());

/** Throw unless a file's digest is the pinned one, naming both. */
export const requireDigest = async (path: string, pinned: string, what: string): Promise<void> => {
  const actual = await sha256File(path);
  if (actual !== pinned) {
    throw new Error(`${what}: ${path} has SHA-256 ${actual}, pinned ${pinned} — refusing`);
  }
};
