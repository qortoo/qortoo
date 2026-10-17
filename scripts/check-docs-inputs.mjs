import { appendFile, readFile } from 'node:fs/promises';
import { verifyBuild } from './lib/docs-automation.mjs';

const inputs = JSON.parse(process.env.DOCS_INPUTS);
const manifest = JSON.parse(await readFile(new URL('../out/generated/sources.json', import.meta.url), 'utf8'));
verifyBuild(inputs, manifest, { requireClean: process.env.GITHUB_ACTIONS === 'true' });
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `Guides and APIs match the resolved website/SDK commits. Candidate: ${inputs.candidate ?? 'none'}.\n`);
console.log('Guides and APIs match the resolved website/SDK commits.');
