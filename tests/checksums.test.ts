/** SHA256SUMS: the vendor shape, written and read strictly. */
import { expect, test } from 'bun:test';
import { parseChecksums, renderChecksums } from '../scripts/lib/checksums.ts';

const a = 'a'.repeat(64);
const b = 'b'.repeat(64);

test('renders `<sha256>  <name>` lines with a trailing newline, in order', () => {
  const text = renderChecksums([
    { name: 'caddy-darwin-arm64-v2.11.4-r1.tar.gz', sha256: a },
    { name: 'caddy', sha256: b },
  ]);
  expect(text).toBe(`${a}  caddy-darwin-arm64-v2.11.4-r1.tar.gz\n${b}  caddy\n`);
  expect(parseChecksums(text).map((l) => l.name)).toEqual([
    'caddy-darwin-arm64-v2.11.4-r1.tar.gz',
    'caddy',
  ]);
});

test('the kit fixture shape parses (VictoriaLogs v1.52.0, byte for byte)', () => {
  const text =
    '3157d4b6181d8a7e3e30918e2cbfcd4cc4cb66263e3ef21ea91e4f20f8980883  victoria-logs-darwin-arm64-v1.52.0.tar.gz\n' +
    '9e48809e314902782959b3a4e683a3087476759d0293791a0564921c676ca7be  victoria-logs-prod\n';
  expect(parseChecksums(text)).toHaveLength(2);
});

test('⛔ refuses binary mode, upper case, CRLF, blanks, duplicates, paths, no newline', () => {
  for (const bad of [
    `${a} *caddy\n`,
    `${a.toUpperCase()}  caddy\n`,
    `${a}  caddy\r\n`,
    `${a}  caddy\n\n`,
    `${a}  caddy\n${b}  caddy\n`,
    `${a}  bin/caddy\n`,
    `${a}  caddy`,
    '',
  ]) {
    expect(() => parseChecksums(bad)).toThrow();
  }
  expect(() => renderChecksums([])).toThrow();
  expect(() => renderChecksums([{ name: 'x y', sha256: a }])).toThrow();
});
