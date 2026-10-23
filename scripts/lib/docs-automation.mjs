const repositoryPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const shaPattern = /^[0-9a-f]{40}$/;

export function validateCandidate(candidate, definitions, context = {}) {
  const { sdk = '', repository = '', sha = '' } = candidate;
  if (!sdk && !repository && !sha) return null;
  const definition = definitions.find(s => s.id === sdk);
  if (!definition || !repositoryPattern.test(repository) || !shaPattern.test(sha)) {
    throw new Error('A candidate requires a configured SDK, owner/repository, and full lowercase commit SHA');
  }
  if (context.repository && context.repository !== 'qortoo/qortoo') {
    if (context.repository !== definition.repository || context.eventName !== 'pull_request'
      || context.headRepository !== repository || context.headSha !== sha) {
      throw new Error('SDK callers must validate their own pull request head');
    }
  }
  return { sdk, repository, sha };
}

export async function resolveInputs(definitions, candidate, siteSha, getCommit) {
  if (!shaPattern.test(siteSha)) throw new Error('Invalid website commit');
  const sources = {};
  for (const definition of definitions) {
    if (!['rust', 'go'].includes(definition.id) || sources[definition.id]
      || !repositoryPattern.test(definition.repository) || typeof definition.ref !== 'string' || !definition.ref.trim()) {
      throw new Error('Invalid SDK source configuration');
    }
    const selected = candidate?.sdk === definition.id;
    const repository = selected ? candidate.repository : definition.repository;
    const ref = selected ? candidate.sha : definition.ref;
    const sha = await getCommit(repository, ref);
    if (!shaPattern.test(sha) || (selected && sha !== candidate.sha)) throw new Error('Commit resolution did not match the requested revision');
    sources[definition.id] = { repository, ref, sha };
  }
  if (!sources.rust || !sources.go) throw new Error('Both SDK sources are required');
  return { version: 1, siteSha, candidate: candidate?.sdk ?? null, sources };
}

export function verifyBuild(inputs, manifest, { requireClean = false } = {}) {
  if (inputs.version !== 1 || manifest.site?.sha !== inputs.siteSha || manifest.mode !== 'committed'
    || (requireClean && manifest.site.dirty)) throw new Error('Website build does not match its resolved inputs');
  for (const [id, expected] of Object.entries(inputs.sources)) {
    const actual = manifest.sources?.find(s => s.id === id);
    if (actual?.sha !== expected.sha || actual?.repository !== expected.repository || manifest.api?.[id]?.sha !== expected.sha) {
      throw new Error(`Guide/API build does not match its resolved inputs: ${id}`);
    }
  }
  if (inputs.benchmarks && (manifest.benchmarks?.repository !== inputs.benchmarks.repository || manifest.benchmarks?.revision !== inputs.benchmarks.revision || manifest.benchmarks?.indexSha256 !== inputs.benchmarks.indexSha256)) {
    throw new Error('Benchmark build does not match its resolved inputs');
  }
}
