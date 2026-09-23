/**
 * The release notes: every input version the build used, then how to check the files.
 *
 * ★ THE NOTES ARE A RECORD, NOT PROSE. Each row is read from the manifest, the Go pin or the
 *   binary's own build info, so the notes cannot claim an input the build did not use. The
 *   `go version -m` dump at the end is the complete module list, straight from the binary.
 * ⚠️ NOTES ARE EDITABLE ON AN IMMUTABLE RELEASE (only tags and assets are locked). The
 *   authority is the attestation and the binary's build info; these notes are its summary.
 */
import { type Build, TARGET } from '../../builds/types.ts';
import { GO_ARCHIVES, GO_VERSION, type GoHost } from '../../toolchain/go.ts';
import type { BuildInfo } from './buildinfo.ts';
import type { ChecksumLine } from './checksums.ts';
import { CHECKSUMS_FILE, REPOSITORY, archiveName, releaseTag, releaseTitle } from './release.ts';

export type NotesContext = {
  readonly host: GoHost;
  /** This repository's commit the build ran from (GITHUB_SHA). */
  readonly commit: string;
  /** `$ImageOS $ImageVersion` on a hosted runner, or a note saying where it ran. */
  readonly runner: string;
  /** The workflow run URL, when built in Actions. */
  readonly runUrl?: string;
};

const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`;

const inputRows = (build: Build, ctx: NotesContext): string[] => {
  const go = GO_ARCHIVES[ctx.host];
  const flags = [
    'CGO_ENABLED=0',
    '-trimpath',
    `-buildvcs=${String(build.flags.buildvcs)}`,
    `-ldflags="${build.flags.ldflags.join(' ')}"`,
    ...(build.flags.tags.length > 0 ? [`-tags=${build.flags.tags.join(',')}`] : []),
  ];
  const rows = [
    row(['Go', `\`${GO_VERSION}\` — \`${go.file}\` sha256 \`${go.sha256}\``]),
    row(['Target', `\`${TARGET.goos}/${TARGET.goarch}\``]),
    row(['Flags', `\`${flags.join(' ')}\``]),
  ];
  if (build.kind === 'xcaddy') {
    rows.unshift(
      row(['Caddy', `\`${build.caddy.module}@${build.caddy.version}\``]),
      ...build.plugins.map((plugin) => row(['Plugin', `\`${plugin.module}@${plugin.version}\``])),
      row(['Generator', `\`${build.xcaddy.module}@${build.xcaddy.version}\``]),
      row(['Module', `\`${build.moduleDir}/\` (go.mod, go.sum, main.go) at this commit`]),
    );
  } else {
    rows.unshift(
      row(['Source', `${build.repository} tag \`${build.tag}\` = \`${build.commit}\``]),
      row(['go.mod / go.sum', `sha256 \`${build.goModSha256}\` / \`${build.goSumSha256}\``]),
    );
  }
  rows.push(
    row(['Licence', `${build.license}, upstream LICENSE sha256 \`${build.licenseSha256}\``]),
    row(['Built from', `${REPOSITORY}@\`${ctx.commit}\``]),
    row(['Runner', ctx.runUrl === undefined ? ctx.runner : `${ctx.runner} — ${ctx.runUrl}`]),
  );
  return rows;
};

/** The whole release body. */
export const renderNotes = (
  build: Build,
  lines: readonly ChecksumLine[],
  info: BuildInfo,
  ctx: NotesContext,
): string => {
  const archive = archiveName(build);
  // ★ The first line names the file where it was built (a runner temp path); name the binary.
  const dump = info.text.trimEnd().replace(/^[^\n]*: (go\S+)/, `${build.name}: $1`);
  return `## ${releaseTitle(build)}

Built by this repository's \`release\` workflow; no vendor publishes a ${TARGET.platform} binary of this.
The archive holds \`${build.name}\` (0755) and the upstream \`LICENSE\` (0644), nothing else.

### Inputs

${row(['input', 'pinned'])}
${row(['---', '---'])}
${inputRows(build, ctx).join('\n')}

### Files (\`${CHECKSUMS_FILE}\`)

${row(['name', 'SHA-256'])}
${row(['---', '---'])}
${lines.map((line) => row([`\`${line.name}\``, `\`${line.sha256}\``])).join('\n')}

### Verify

\`\`\`sh
gh release verify ${releaseTag(build)} --repo ${REPOSITORY}
gh attestation verify ${archive} --repo ${REPOSITORY}
shasum -a 256 --check --ignore-missing ${CHECKSUMS_FILE}
# after extracting, the binary itself is an attestation subject too:
gh attestation verify ${build.name} --repo ${REPOSITORY}
\`\`\`

<details><summary><code>go version -m ${build.name}</code></summary>

\`\`\`text
${dump}
\`\`\`

</details>
`;
};
