/**
 * `bun run scripts/check-dist.ts <name> <dir>` — the publish job's gate, run on the files the
 * build job handed over, BEFORE anything is attested or released.
 *
 * ⛔ IT TRUSTS NOTHING IT DID NOT COMPUTE. The directory must hold exactly the archive,
 *   SHA256SUMS and notes.md; SHA256SUMS must be strict and name the archive, then each member;
 *   the archive's digest must match line 1; the archive must read under the strict reader and
 *   hold exactly the expected members, whose digests must match their lines; the LICENSE must
 *   be the pinned one. Only then are the tag, title and archive name written as outputs.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildNamed } from '../builds/index.ts';
import { parseChecksums } from './lib/checksums.ts';
import { setOutputs } from './lib/pipeline.ts';
import {
  CHECKSUMS_FILE,
  LICENSE_MEMBER,
  NOTES_FILE,
  archiveName,
  memberNames,
  releaseTag,
  releaseTitle,
} from './lib/release.ts';
import { sha256 } from './lib/run.ts';
import { gunzip, readTar } from './lib/tar.ts';

const [name = '', dir = ''] = Bun.argv.slice(2);
const build = buildNamed(name);
const archive = archiveName(build);
const fail = (why: string): never => {
  throw new Error(`check-dist ${build.name}: ${why}`);
};

const files = (await readdir(dir)).toSorted();
const expectedFiles = [archive, CHECKSUMS_FILE, NOTES_FILE].toSorted();
if (files.join(',') !== expectedFiles.join(',')) fail(`holds ${files.join(', ')}`);

const lines = parseChecksums(await Bun.file(join(dir, CHECKSUMS_FILE)).text());
const names = lines.map((line) => line.name);
if (names.join(',') !== [archive, ...memberNames(build)].join(','))
  fail(`lists ${names.join(', ')}`);

const bytes = new Uint8Array(await Bun.file(join(dir, archive)).arrayBuffer());
if (sha256(bytes) !== lines[0]?.sha256) fail(`${archive} does not match its line`);

const entries = readTar(gunzip(bytes));
if (entries.map((entry) => entry.name).join(',') !== memberNames(build).join(',')) {
  fail(`archive holds ${entries.map((entry) => entry.name).join(', ')}`);
}
for (const entry of entries) {
  const line = lines.find((candidate) => candidate.name === entry.name);
  if (line?.sha256 !== sha256(entry.bytes)) fail(`${entry.name} does not match its line`);
  const mode = entry.name === LICENSE_MEMBER ? 0o644 : 0o755;
  if (entry.mode !== mode) fail(`${entry.name} has mode ${entry.mode.toString(8)}`);
}
const license = entries.find((entry) => entry.name === LICENSE_MEMBER);
if (license === undefined || sha256(license.bytes) !== build.licenseSha256) {
  fail('LICENSE is not the pinned upstream licence');
}

console.log(`${archive}: ${String(entries.length)} members, every digest matches`);
await setOutputs({ archive, tag: releaseTag(build), title: releaseTitle(build) });
