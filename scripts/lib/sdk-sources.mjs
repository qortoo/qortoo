import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync, lstatSync } from 'node:fs';
import path from 'node:path';

export const git = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trimEnd();
export function loadSources(root, config, env = process.env) {
  return config.sources.map((definition) => {
    if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) throw new Error(`Invalid source id: ${definition.id}`);
    const directory = path.resolve(root, env[definition.directoryEnv] ?? definition.directory);
    const repository = env[definition.repositoryEnv] ?? definition.repository;
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository)) throw new Error('Invalid SDK repository');
    const ref = env[definition.refEnv] ?? definition.ref;
    const sha = git(directory, 'rev-parse', '--verify', `${ref}^{commit}`);
    const entries = execFileSync('git', ['-C', directory, 'ls-tree', '-r', '-z', sha], { encoding: 'utf8' }).split('\0').filter(Boolean);
    const files = new Set(entries.filter((entry) => /^100(?:644|755) blob /.test(entry)).map((entry) => entry.slice(entry.indexOf('\t') + 1)));
    const editRef = repository === definition.repository ? definition.ref : ref;
    return { ...definition, repository, upstreamRepository: definition.repository, directory, ref, editRef, sha, files, dirtyDocs: git(directory, 'status', '--porcelain', '--', 'docs') !== '' };
  });
}
export async function readSource(source, file, worktree) {
  if (worktree || source.id === 'developer') return readFile(path.join(source.directory, file));
  return execFileSync('git', ['-C', source.directory, 'show', `${source.sha}:${file}`], { maxBuffer: 32 * 1024 * 1024 });
}

export function loadDeveloperSource(root, sha) {
  // Site-owned docs follow the checked-out website, including local previews.
  const files = new Set(git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0')
    .filter(file => file && existsSync(path.join(root, file)) && lstatSync(path.join(root, file)).isFile()));
  return { id: 'developer', title: 'Developer', description: 'Shared development and repository workflows',
    repository: 'qortoo/qortoo', directory: root, ref: 'main', editRef: 'main', sha, files,
    navigation: ['index', 'repository-workflows', 'developer-site', 'benchmark-results', '...'],
    dirtyDocs: git(root, 'status', '--porcelain', '--', 'docs') !== '' };
}
