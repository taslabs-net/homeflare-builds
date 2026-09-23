/**
 * `bun run caddy:regenerate` — rewrite builds/caddy/{go.mod,go.sum,main.go} with the pinned
 * xcaddy after changing a version in builds/caddy/build.ts. Commit what it writes.
 *
 * ★ The same generation CI runs (scripts/lib/caddy.ts), so what this writes is what the
 *   `go builds` job will expect. ⚠️ Needs the network (proxy.golang.org, sum.golang.org).
 */
import { caddy } from '../builds/caddy/build.ts';
import { writeCaddyModule } from './lib/caddy.ts';
import { installGo } from './lib/go.ts';
import { repoRoot, toolCache } from './lib/pipeline.ts';

const root = repoRoot(import.meta.dir);
const go = await installGo(toolCache(root));
await writeCaddyModule(go, caddy, root);
console.log(`${caddy.moduleDir}: regenerated with ${caddy.xcaddy.module}@${caddy.xcaddy.version}`);
