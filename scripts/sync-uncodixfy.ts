#!/usr/bin/env bun

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const UPSTREAM_URL = 'https://github.com/cyxzdev/Uncodixfy';
const UPSTREAM_REF = 'main';
const DEST_DIR = resolve('.codex/skills/uncodixfy');
const FILES_TO_SYNC = ['README.md', 'SKILL.md', 'Uncodixfy.md'] as const;

function run(command: string[], cwd?: string): string {
  const proc = Bun.spawnSync(command, {
    cwd,
    stderr: 'pipe',
    stdout: 'pipe',
  });

  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr).trim();
    throw new Error(stderr || `Command failed: ${command.join(' ')}`);
  }

  return new TextDecoder().decode(proc.stdout).trim();
}

function main() {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'uncodixfy-'));

  try {
    run(['git', 'clone', '--depth', '1', '--branch', UPSTREAM_REF, UPSTREAM_URL, tmpRoot]);

    const commit = run(['git', '-C', tmpRoot, 'rev-parse', 'HEAD']);

    if (!existsSync(DEST_DIR)) {
      throw new Error(`Destination does not exist: ${DEST_DIR}`);
    }

    for (const file of FILES_TO_SYNC) {
      cpSync(join(tmpRoot, file), join(DEST_DIR, file), { force: true });
    }

    const upstreamNote = [
      `Upstream: ${UPSTREAM_URL}`,
      `Ref: ${UPSTREAM_REF}`,
      `Vendored from commit: ${commit}`,
      '',
    ].join('\n');

    writeFileSync(join(DEST_DIR, 'UPSTREAM.md'), upstreamNote);

    const installedSkillDir = resolve(homedir(), '.codex/skills/uncodixfy');
    if (existsSync(installedSkillDir)) {
      for (const file of FILES_TO_SYNC) {
        cpSync(join(DEST_DIR, file), join(installedSkillDir, file), { force: true });
      }
    }

    const skillBody = readFileSync(join(DEST_DIR, 'SKILL.md'), 'utf8');
    if (!skillBody.includes('name: uncodixfy')) {
      throw new Error('Synced SKILL.md does not look like the Uncodixfy skill.');
    }

    console.log(`Synced Uncodixfy from ${commit}`);
  } finally {
    rmSync(tmpRoot, { force: true, recursive: true });
  }
}

main();
