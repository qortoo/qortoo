import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// API extraction always reads the same committed revision as the collected guides.
export async function withSnapshot(source, callback) {
  const directory = await mkdtemp(path.join(tmpdir(), `qortoo-api-${source.id}-`));
  try {
    const archive = execFileSync('git', ['-C', source.directory, 'archive', source.sha], { maxBuffer: 128 * 1024 * 1024 });
    execFileSync('tar', ['-xf', '-', '-C', directory], { input: archive });
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
