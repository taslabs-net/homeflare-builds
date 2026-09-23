/** The release notes record every input, and how to verify. */
import { expect, test } from 'bun:test';
import { caddy } from '../builds/caddy/build.ts';
import { cloudflareExporter } from '../builds/cloudflare-exporter/build.ts';
import { parseBuildInfo } from '../scripts/lib/buildinfo.ts';
import { renderNotes } from '../scripts/lib/notes.ts';
import { pack } from '../scripts/lib/release.ts';

const bytes = new TextEncoder().encode('x');
const ctx = { commit: 'c'.repeat(40), host: 'darwin-arm64', runner: 'macos26 20260915' } as const;

test('caddy notes name Caddy, every plugin, xcaddy, Go and its digest', () => {
  const info = parseBuildInfo('/private/tmp/run/caddy: go1.26.8\n\tpath\tcaddy\n');
  const notes = renderNotes(caddy, pack(caddy, bytes, bytes).lines, info, ctx);
  for (const needle of [
    'github.com/caddyserver/caddy/v2@v2.11.4',
    ...caddy.plugins.map((p) => `${p.module}@${p.version}`),
    'github.com/caddyserver/xcaddy/cmd/xcaddy@v0.4.7',
    'go1.26.8.darwin-arm64.tar.gz',
    'a012b25b571bd0138a03dcd25375ceba866fe5ca822f426d2c66a4de56fd3f4b',
    'gh attestation verify caddy-darwin-arm64-v2.11.4-r1.tar.gz',
    'caddy: go1.26.8',
  ]) {
    expect(notes).toContain(needle);
  }
  expect(notes).not.toContain('/private/tmp/run');
});

test('exporter notes name the upstream commit and its go.sum digest', () => {
  const info = parseBuildInfo('/x: go1.26.8\n');
  const notes = renderNotes(
    cloudflareExporter,
    pack(cloudflareExporter, bytes, bytes).lines,
    info,
    ctx,
  );
  expect(notes).toContain(cloudflareExporter.commit);
  expect(notes).toContain(cloudflareExporter.goSumSha256);
});
