/**
 * The release archive: a plain ustar tar of root-level regular files, gzipped — written here,
 * byte by byte, rather than by the host's `tar`.
 *
 * ★ WHY NOT `tar -czf`. The release runner is macOS, whose bsdtar adds what a consumer's
 *   strict reader refuses: PAX headers for extended attributes (every file on a runner has
 *   `com.apple.provenance`), `._name` AppleDouble entries, and the builder's uid, user name and
 *   clock. homeflare-kit's release-archive reader (Victoria.Binary's tar.ts, kit PR 138)
 *   refuses a whole archive for a PAX header, a GNU long name, a directory, a link or a
 *   duplicate name. Written here, the archive holds exactly the entries given, with fixed
 *   owner 0:0 and the SOURCE's date — so the same inputs make the same bytes on any host.
 * ⛔ ROOT-LEVEL REGULAR FILES ONLY, both ways. `writeTar` refuses a name with a `/`, and
 *   `readTar` — which the publish job runs on the archive it is about to release — refuses
 *   anything but what `writeTar` can produce.
 */

export type TarEntry = { readonly name: string; readonly mode: number; readonly bytes: Uint8Array };

const BLOCK = 512;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const octal = (value: number, width: number): string =>
  `${value.toString(8).padStart(width - 1, '0')}\0`;

const checkName = (name: string): string => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(name) || name.includes('..')) {
    throw new Error(`tar: ${JSON.stringify(name)} is not a plain root-level file name`);
  }
  return name;
};

const header = (entry: TarEntry, mtime: number): Uint8Array => {
  const block = new Uint8Array(BLOCK);
  const put = (offset: number, text: string) => block.set(encoder.encode(text), offset);
  put(0, checkName(entry.name));
  put(100, octal(entry.mode, 8));
  put(108, octal(0, 8)); // uid
  put(116, octal(0, 8)); // gid
  put(124, octal(entry.bytes.byteLength, 12));
  put(136, octal(mtime, 12));
  put(148, '        '); // the checksum is computed over spaces in its own field
  put(156, '0'); // regular file
  put(257, 'ustar\0');
  put(263, '00');
  const sum = block.reduce((total, byte) => total + byte, 0);
  put(148, `${sum.toString(8).padStart(6, '0')}\0 `);
  return block;
};

const padded = (size: number) => Math.ceil(size / BLOCK) * BLOCK;

/** A ustar archive of `entries`, in the order given, every mtime set to `mtime` (seconds). */
export const writeTar = (entries: readonly TarEntry[], mtime: number): Uint8Array<ArrayBuffer> => {
  const names = new Set<string>();
  const total = entries.reduce((n, e) => n + BLOCK + padded(e.bytes.byteLength), 2 * BLOCK);
  const out = new Uint8Array(total);
  let at = 0;
  for (const entry of entries) {
    if (names.has(entry.name)) throw new Error(`tar: ${entry.name} given twice`);
    names.add(entry.name);
    out.set(header(entry, mtime), at);
    out.set(entry.bytes, at + BLOCK);
    at += BLOCK + padded(entry.bytes.byteLength);
  }
  return out; // ★ the two trailing zero blocks are already zero
};

const field = (block: Uint8Array, offset: number, width: number): string => {
  const raw = block.subarray(offset, offset + width);
  const end = raw.indexOf(0);
  return decoder.decode(end === -1 ? raw : raw.subarray(0, end));
};

const parseOctal = (block: Uint8Array, offset: number, width: number, what: string): number => {
  const text = field(block, offset, width).trim();
  if (!/^[0-7]+$/.test(text)) throw new Error(`tar: ${what} ${JSON.stringify(text)} is not octal`);
  return Number.parseInt(text, 8);
};

/** Read an archive `writeTar` could have written; refuse anything else, naming why. */
export const readTar = (tar: Uint8Array): TarEntry[] => {
  const entries: TarEntry[] = [];
  let at = 0;
  for (;;) {
    if (at + BLOCK > tar.byteLength) throw new Error('tar: truncated (no end-of-archive blocks)');
    const block = tar.subarray(at, at + BLOCK);
    if (block.every((byte) => byte === 0)) break;
    const stored = parseOctal(block, 148, 8, 'checksum');
    const blanked = new Uint8Array(block);
    blanked.set(encoder.encode('        '), 148);
    if (blanked.reduce((total, byte) => total + byte, 0) !== stored) {
      throw new Error(`tar: bad header checksum at byte ${String(at)}`);
    }
    if (field(block, 257, 6) !== 'ustar' || field(block, 263, 2) !== '00') {
      throw new Error('tar: not a POSIX ustar header');
    }
    const type = String.fromCharCode(block[156] ?? 0);
    const name = field(block, 0, 100);
    if (type !== '0') throw new Error(`tar: ${name} has type ${JSON.stringify(type)}, not a file`);
    if (field(block, 345, 155) !== '') throw new Error(`tar: ${name} uses a name prefix`);
    checkName(name);
    if (entries.some((entry) => entry.name === name)) throw new Error(`tar: ${name} twice`);
    const size = parseOctal(block, 124, 12, 'size');
    const mode = parseOctal(block, 100, 8, 'mode');
    if (at + BLOCK + padded(size) > tar.byteLength) throw new Error(`tar: ${name} truncated`);
    entries.push({ bytes: tar.slice(at + BLOCK, at + BLOCK + size), mode, name });
    at += BLOCK + padded(size);
  }
  const rest = tar.subarray(at);
  if (rest.byteLength < 2 * BLOCK || rest.some((byte) => byte !== 0)) {
    throw new Error('tar: the end-of-archive blocks are missing or followed by data');
  }
  return entries;
};

/**
 * gzip with a fixed header. ★ zlib writes the host OS into byte 9 of the header (Unix vs
 *   macOS differ), so the same tar would compress to different archives on the two runners.
 *   MTIME (bytes 4-7) is zero and OS is set to 3 (Unix); the trailer's CRC covers only the
 *   uncompressed data, so neither edit touches integrity.
 */
export const gzip = (data: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
  const out = Bun.gzipSync(data, { level: 9 });
  if (out[0] !== 0x1f || out[1] !== 0x8b || out[3] !== 0) {
    throw new Error('gzip: unexpected header (flags set)');
  }
  out.fill(0, 4, 8);
  out[9] = 3;
  return out;
};

export const gunzip = (data: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> =>
  Bun.gunzipSync(data);
