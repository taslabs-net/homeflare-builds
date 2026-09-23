/**
 * The archive writer and its strict reader. ★ The reader is what the publish job runs on the
 * archive it is about to release, so every refusal here is a release that does not happen.
 */
import { describe, expect, test } from 'bun:test';
import { gunzip, gzip, readTar, writeTar } from '../scripts/lib/tar.ts';

const bytes = (text: string) => new TextEncoder().encode(text);
const entries = [
  { bytes: bytes('#!binary\n'), mode: 0o755, name: 'caddy' },
  { bytes: bytes('Apache License\n'), mode: 0o644, name: 'LICENSE' },
];

describe('writeTar → readTar', () => {
  test('round-trips names, modes and bytes, in order', () => {
    const read = readTar(writeTar(entries, 1_780_000_000));
    expect(read.map((e) => [e.name, e.mode, new TextDecoder().decode(e.bytes)])).toEqual([
      ['caddy', 0o755, '#!binary\n'],
      ['LICENSE', 0o644, 'Apache License\n'],
    ]);
  });

  test('★ deterministic: the same inputs make the same bytes, gzipped too', () => {
    const a = gzip(writeTar(entries, 1_780_000_000));
    const b = gzip(writeTar(entries, 1_780_000_000));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect([...a.subarray(4, 10)]).toEqual([0, 0, 0, 0, a[8] ?? -1, 3]);
    expect(readTar(gunzip(a))).toHaveLength(2);
  });

  test('a ustar header: magic, owner 0:0, the given mtime', () => {
    const tar = writeTar(entries, 0o13_000_000_000);
    const text = (from: number, to: number) => new TextDecoder().decode(tar.subarray(from, to));
    expect(text(257, 263)).toBe('ustar\0');
    expect(text(108, 124)).toBe('0000000\x000000000\0');
    expect(text(136, 148)).toBe('13000000000\0');
  });

  test('⛔ refuses a path, a dot-file, a duplicate', () => {
    const one = (name: string) => [{ bytes: bytes('x'), mode: 0o644, name }];
    expect(() => writeTar(one('bin/caddy'), 0)).toThrow('root-level');
    expect(() => writeTar(one('.caddy'), 0)).toThrow('root-level');
    expect(() => writeTar([...entries, ...entries], 0)).toThrow('twice');
  });
});

describe('⛔ readTar refuses what writeTar never writes', () => {
  const tar = () => writeTar(entries, 0);
  const reseal = (t: Uint8Array) => {
    t.fill(0x20, 148, 156);
    const sum = t.subarray(0, 512).reduce((n, b) => n + b, 0);
    t.set(new TextEncoder().encode(`${sum.toString(8).padStart(6, '0')}\0 `), 148);
    return t;
  };

  test('a bad header checksum', () => {
    const t = tar();
    t[0] = 'd'.charCodeAt(0);
    expect(() => readTar(t)).toThrow('checksum');
  });

  test('a PAX header, a directory, a symlink', () => {
    for (const type of ['x', '5', '2']) {
      const t = tar();
      t[156] = type.charCodeAt(0);
      expect(() => readTar(reseal(t))).toThrow('not a file');
    }
  });

  test('a name prefix (a path in disguise)', () => {
    const t = tar();
    t.set(new TextEncoder().encode('bin'), 345);
    expect(() => readTar(reseal(t))).toThrow('prefix');
  });

  test('truncation, and data after the end blocks', () => {
    expect(() => readTar(tar().subarray(0, 700))).toThrow('truncated');
    const t = tar();
    const longer = new Uint8Array(t.byteLength + 512);
    longer.set(t);
    longer[longer.byteLength - 1] = 1;
    expect(() => readTar(longer)).toThrow('followed by data');
  });
});
