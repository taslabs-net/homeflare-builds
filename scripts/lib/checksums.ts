/**
 * SHA256SUMS: `sha256sum` text mode — `<64 lower-case hex><two spaces><name>`, LF, a trailing
 * newline — the archive on line 1 and one line per archive member after it.
 *
 * ★ THE SHAPE VENDORS USE, AND THE ONE THE KIT ALREADY READS. VictoriaMetrics' per-archive
 *   checksum files are exactly this (archive first, then each member), and homeflare-kit's
 *   Victoria.Binary parser (kit PR 138, checksums.ts) accepts only this. Publishing the same
 *   shape means ReleaseBinary pins these archives with the parser it already trusts.
 * ★ MEMBER LINES ARE WHAT MAKE AN INSTALLED FILE CHECKABLE. The binary on disk is not the
 *   archive; its own line (and its own attestation subject — release.yml attests every line
 *   here) is what lets a host verify the file it actually runs.
 * ⛔ `parseChecksums` IS STRICT for the same reason the kit's is: a file that is not this
 *   shape is something to read before trusting, not something to guess past.
 */

export type ChecksumLine = { readonly name: string; readonly sha256: string };

const LINE = /^([0-9a-f]{64}) {2}([^\s/]+)$/;

/** The file's text for these lines, in order. */
export const renderChecksums = (lines: readonly ChecksumLine[]): string => {
  const names = new Set<string>();
  for (const line of lines) {
    if (!LINE.test(`${line.sha256}  ${line.name}`)) {
      throw new Error(`checksums: ${JSON.stringify(line)} is not a valid line`);
    }
    if (names.has(line.name)) throw new Error(`checksums: ${line.name} listed twice`);
    names.add(line.name);
  }
  if (lines.length === 0) throw new Error('checksums: no lines');
  return `${lines.map((line) => `${line.sha256}  ${line.name}`).join('\n')}\n`;
};

/** Name → SHA-256, in file order. Throws, naming the line, on anything but the shape above. */
export const parseChecksums = (text: string): ChecksumLine[] => {
  if (!text.endsWith('\n')) throw new Error('checksums: no trailing newline');
  const lines: ChecksumLine[] = [];
  for (const [index, line] of text.slice(0, -1).split('\n').entries()) {
    const match = LINE.exec(line);
    if (match === null) {
      throw new Error(`checksums line ${String(index + 1)}: not "<sha256>  <name>": ${line}`);
    }
    const [, sha256 = '', name = ''] = match;
    if (lines.some((seen) => seen.name === name)) {
      throw new Error(`checksums line ${String(index + 1)}: ${name} is listed twice`);
    }
    lines.push({ name, sha256 });
  }
  if (lines.length === 0) throw new Error('checksums: no lines');
  return lines;
};
