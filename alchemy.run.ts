/**
 * Adopt this GitHub repository — settings AND its `main` ruleset — from the same declaration
 * that renders its workflows (repo-shape.ts).
 *
 * ★ `declareRepoPolicy` + `renderRepoShape(shape).policy`, THE KIT'S PAIR, DOGFOODED. The
 *   ruleset requires exactly the checks the rendered workflows report (`ci`, `secret scan`),
 *   so the two cannot drift apart; squash-only, auto-merge and delete-branch-on-merge come
 *   from the policy. homeflare-builds is the first repository to use both halves.
 * ⛔ DEPLOY IS TIM'S. `bun run plan` first; `bun run deploy` uses `--stage live` (the CLI
 *   default `live_$USER` would fork a per-laptop copy on the shared Cloudflare state store).
 * ⛔ THE RULESET CANNOT BE ADOPTED (kit's repo-policy.ts, read out of alchemy beta.79): with no
 *   prior state its reconcile CREATES, and GitHub allows two rulesets of one name. None was
 *   made by hand here (checked at creation: `gh api repos/taslabs-net/homeflare-builds/rulesets`
 *   → []), so the first deploy creates the only one. Re-check before deploying.
 * ⚠️ WHAT ALCHEMY DOES NOT MODEL, set once with `gh api` when the repository was created and
 *   recorded in docs/repository.md: immutable releases (on), fork-PR approval
 *   (`first_time_contributors`, the kit's), default GITHUB_TOKEN permissions (`read`), and the
 *   squash commit title/message (PR title / PR body). A deploy neither sets nor resets them.
 * ★ STATE IS `Cloudflare.state()` — the account Durable Object every HomeFlare stack uses.
 * ★ PROVIDERS ARE `repoPolicyProviders()`, NOT `GitHub.providers()`: the ruleset's own provider
 *   needs GitHub credentials threaded in, which merging the two side by side does not do
 *   (kit 0.30.0, measured on this repo's bump PR 6). It includes `GitHub.providers()` itself.
 */
import { declareRepoPolicy, repoPolicyProviders } from '@homeflare/alchemy/github';
import { renderRepoShape } from '@homeflare/config/repo-shape';
import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { shape } from './repo-shape.ts';

// oxlint-disable no-default-export -- Alchemy CLI loads the default export of alchemy.run.ts.
export default Alchemy.Stack(
  'HomeFlareBuilds',
  {
    providers: Layer.mergeAll(Cloudflare.providers(), repoPolicyProviders()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const { repository, ruleset } = yield* declareRepoPolicy('homeflare-builds', {
      ...renderRepoShape(shape).policy,
      settings: {
        description:
          'Darwin arm64 builds no vendor ships: Caddy with plugins, cloudflare-exporter. Immutable, attested GitHub Releases.',
        // ⛔ PUBLIC ON PURPOSE (Tim, 2026-09-23): ReleaseBinary installs these with no
        //   credential. That is also why every job here is GitHub-hosted (repo-shape.ts).
        visibility: 'public',
        hasWiki: false,
      },
      // ⚠️ `Effect.orDie`, because `declareRepoPolicy` fails with a plain `Error` (a policy its
      //   guards refuse) and `Alchemy.Stack` accepts only `ConfigError`. A refused policy is a
      //   mistake in this file, so it stops the plan as a defect, message intact. Found by
      //   using the helper in a Stack for the first time; reported for the kit to widen.
    }).pipe(Effect.orDie);
    return { repository: repository.fullName, ruleset: ruleset.name };
  }),
);
