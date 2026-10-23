import { appendFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolveInputs, validateCandidate } from './lib/docs-automation.mjs';
import { benchmarkRepository, digest } from './lib/benchmark-sources.mjs';

const config = JSON.parse(await readFile(new URL('../docs-sources.json', import.meta.url), 'utf8'));
const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
const candidate = validateCandidate({
  sdk: process.env.CANDIDATE_SDK, repository: process.env.CANDIDATE_REPOSITORY, sha: process.env.CANDIDATE_SHA,
}, config.sources, {
  repository: process.env.GITHUB_REPOSITORY, eventName: process.env.GITHUB_EVENT_NAME,
  headRepository: event.pull_request?.head?.repo?.full_name, headSha: event.pull_request?.head?.sha,
});
const siteSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const inputs = await resolveInputs(config.sources, candidate, siteSha, async (repository, ref) => {
  const response = await fetch(`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(ref)}`, {
    headers: { Accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Cannot resolve ${repository}@${ref}: HTTP ${response.status}`);
  return (await response.json()).sha;
});
// Refresh signals carry no mutable selection. Resolve the current data tip once.
const headers = { Accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) };
const dataResponse = await fetch(`https://api.github.com/repos/${benchmarkRepository}/commits/bench-data`, { headers, signal: AbortSignal.timeout(30_000) });
if (!dataResponse.ok) throw new Error(`Cannot resolve benchmark data: HTTP ${dataResponse.status}`);
const revision = (await dataResponse.json()).sha;
if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error('Invalid benchmark data commit');
const indexResponse = await fetch(`https://api.github.com/repos/${benchmarkRepository}/contents/index.json?ref=${revision}`, { headers, signal: AbortSignal.timeout(30_000) });
if (!indexResponse.ok) throw new Error(`Cannot resolve benchmark index: HTTP ${indexResponse.status}`);
const index = await indexResponse.json();
if (index.encoding !== 'base64') throw new Error('Unsupported benchmark index encoding');
inputs.benchmarks = { repository: benchmarkRepository, revision, indexSha256: digest(Buffer.from(index.content, 'base64')) };
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `inputs=${JSON.stringify(inputs)}\n`);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `Website commit: \`${siteSha}\`\n\nCandidate SDK: ${inputs.candidate ?? 'none'}\n\n` +
  Object.entries(inputs.sources).map(([id, source]) => `- ${id}: [${source.sha}](https://github.com/${source.repository}/commit/${source.sha})`).join('\n') +
  `\n- Benchmarks: [${revision}](https://github.com/${benchmarkRepository}/tree/${revision}); index SHA256: ${inputs.benchmarks.indexSha256}\n`);
console.log(JSON.stringify(inputs, null, 2));
