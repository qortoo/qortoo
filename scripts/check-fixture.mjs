import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporary = await mkdtemp(path.join(tmpdir(), 'qortoo-docs-fixture-'));
try {
  await cp(path.join(import.meta.dirname, '../tests/fixtures/sdk'), temporary, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', temporary, ...args], { stdio: 'pipe' });
  git('init', '--initial-branch=main');
  git('add', '.');
  git('-c', 'user.name=Documentation fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture');
  const env = { ...process.env, QORTOO_DOCS_FIXTURE_DIR: temporary, QORTOO_DOCS_WORKTREE: '0', NEXT_TELEMETRY_DISABLED: '1' };
  execFileSync('npm', ['run', 'build'], { env, stdio: 'inherit' });
  execFileSync('npm', ['run', 'check:export'], { env, stdio: 'inherit' });
} finally {
  await rm(temporary, { recursive: true, force: true });
}
