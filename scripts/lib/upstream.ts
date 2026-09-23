/**
 * An upstream Go program's source: cloned at its tag, and refused unless every pin agrees.
 *
 * ⛔ THE COMMIT IS THE PIN, THE TAG IS ONLY HOW TO FIND IT. Tags move — upstream can delete and
 *   re-push one, and lablabs' tag names already mean two different things (build.ts). The
 *   clone is refused unless the tag resolves to exactly the pinned commit.
 * ⛔ go.mod, go.sum AND LICENSE ARE PINNED BY DIGEST TOO. The commit already fixes them; the
 *   digests make the pin readable in a diff and fail loudly on a clone that is somehow not the
 *   one the commit names. `go build -mod=readonly` then refuses any module that does not match
 *   the pinned go.sum — upstream's go.sum is the one committed dependency record here.
 */
import { join } from 'node:path';
import type { GitBuild } from '../../builds/types.ts';
import { requireDigest, run } from './run.ts';

/** Clone `build` into `dir` and verify it; return the path of its LICENSE. */
export const prepareUpstream = async (build: GitBuild, dir: string): Promise<string> => {
  await run([
    'git',
    '-c',
    'advice.detachedHead=false',
    'clone',
    '--quiet',
    '--depth',
    '1',
    '--single-branch',
    '--branch',
    build.tag,
    build.repository,
    dir,
  ]);
  const { stdout } = await run(['git', '-C', dir, 'rev-parse', 'HEAD'], { echo: false });
  if (stdout.trim() !== build.commit) {
    throw new Error(
      `${build.repository} tag ${build.tag} is ${stdout.trim()}, pinned ${build.commit} — refusing`,
    );
  }
  await requireDigest(join(dir, 'go.mod'), build.goModSha256, `${build.name} go.mod`);
  await requireDigest(join(dir, 'go.sum'), build.goSumSha256, `${build.name} go.sum`);
  const license = join(dir, 'LICENSE');
  await requireDigest(license, build.licenseSha256, `${build.name} LICENSE`);
  console.log(`${build.name}: ${build.tag} = ${build.commit}; go.mod, go.sum, LICENSE verified`);
  return license;
};
