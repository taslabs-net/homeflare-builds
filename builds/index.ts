/**
 * Every build this repository publishes. ⛔ Adding one here is what makes CI verify it and
 * the release workflow publish it; there is no second list.
 */
import { caddy } from './caddy/build.ts';
import { cloudflareExporter } from './cloudflare-exporter/build.ts';
import type { Build } from './types.ts';

export const BUILDS: readonly Build[] = [caddy, cloudflareExporter];

/** The build called `name`. ⛔ Throws on an unknown name rather than building nothing. */
export const buildNamed = (name: string): Build => {
  const found = BUILDS.find((build) => build.name === name);
  if (found === undefined) {
    throw new Error(
      `no build named ${JSON.stringify(name)}: ${BUILDS.map((b) => b.name).join(', ')}`,
    );
  }
  return found;
};
