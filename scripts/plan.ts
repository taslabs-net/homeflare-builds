/**
 * `bun run scripts/plan.ts` — which builds release.yml builds, as `builds=<json>` and `count=<n>`.
 *
 * - pull_request: every build, to prove each still builds and smoke-tests natively. Nothing
 *   is published from a pull request (release.yml's publish job requires a push to main).
 * - push to main / workflow_dispatch: every build whose tag has NO published release yet.
 *   Merging a revision bump is therefore what releases it — no tag is pushed by hand.
 *
 * ⛔ A TAG WITHOUT A RELEASE STOPS THE PLAN. Immutable releases lock a tag once published and
 *   forbid reusing its name; a bare tag means a publish half-happened, and building "over" it
 *   would hide that. Bump `revision` and say why in the pull request.
 */
import { BUILDS } from '../builds/index.ts';
import { setOutputs } from './lib/pipeline.ts';
import { REPOSITORY, releaseTag } from './lib/release.ts';

type State = 'published' | 'absent' | 'tag-only';

const api = async (path: string): Promise<number> => {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
  });
  if (response.status !== 200 && response.status !== 404) {
    throw new Error(`GET ${path} answered ${String(response.status)}: ${await response.text()}`);
  }
  return response.status;
};

const stateOf = async (tag: string): Promise<State> => {
  if ((await api(`releases/tags/${encodeURIComponent(tag)}`)) === 200) return 'published';
  return (await api(`git/ref/tags/${encodeURIComponent(tag)}`)) === 200 ? 'tag-only' : 'absent';
};

const event = process.env.GITHUB_EVENT_NAME ?? 'workflow_dispatch';
const planned: string[] = [];
for (const build of BUILDS) {
  const tag = releaseTag(build);
  if (event === 'pull_request') {
    planned.push(build.name);
    continue;
  }
  const state = await stateOf(tag);
  console.log(`${tag}: ${state}`);
  if (state === 'tag-only') {
    throw new Error(`${tag} exists as a tag with no published release — bump revision (plan.ts)`);
  }
  if (state === 'absent') planned.push(build.name);
}
await setOutputs({ builds: JSON.stringify(planned), count: String(planned.length) });
