#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillName = 'flowus-cli';
const productName = 'FlowUs';
const commandName = 'flowus';
const tokenEnv = 'FLOWUS_TOKEN';
const forbiddenTerms = ['Build' + 'in', 'build' + 'in', 'BUILD' + 'IN'];

const errors = [];

await requireFile('README.md');
await requireFile('.codex-plugin/plugin.json');
await requireFile('.agents/plugins/marketplace.json');
await requireFile('.claude-plugin/marketplace.json');
await requireFile(`skills/${skillName}/SKILL.md`);
await requireFile(`skills/${skillName}/agents/openai.yaml`);

for (const jsonFile of [
  '.codex-plugin/plugin.json',
  '.agents/plugins/marketplace.json',
  '.claude-plugin/marketplace.json',
  'package.json',
]) {
  await parseJson(jsonFile);
}

const skill = await readText(`skills/${skillName}/SKILL.md`);
if (!skill.includes(`name: ${skillName}`)) {
  errors.push(`skills/${skillName}/SKILL.md frontmatter name must be ${skillName}.`);
}
if (!skill.includes('license: MIT')) {
  errors.push(`skills/${skillName}/SKILL.md must include license: MIT.`);
}
if (!skill.includes(productName) || !skill.includes(commandName) || !skill.includes(tokenEnv)) {
  errors.push(`skills/${skillName}/SKILL.md must describe ${productName}, ${commandName}, and ${tokenEnv}.`);
}

const openaiYaml = await readText(`skills/${skillName}/agents/openai.yaml`);
for (const field of ['display_name', 'short_description', 'default_prompt']) {
  if (!new RegExp(`^\\s*${field}:`, 'm').test(openaiYaml)) {
    errors.push(`skills/${skillName}/agents/openai.yaml must include interface.${field}.`);
  }
}
if (!openaiYaml.includes(`$${skillName}`)) {
  errors.push(`skills/${skillName}/agents/openai.yaml default_prompt must mention $${skillName}.`);
}

for (const file of await listFiles(root)) {
  const relativeFile = path.relative(root, file).split(path.sep).join('/');
  if (relativeFile.startsWith('.git/')) continue;
  const content = await readFile(file, 'utf8');
  for (const term of forbiddenTerms) {
    if (content.includes(term)) {
      errors.push(`${relativeFile} must not mention "${term}".`);
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(`Skill validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`${productName} skill validation passed.\n`);

async function requireFile(relativePath) {
  try {
    const stats = await stat(path.join(root, relativePath));
    if (!stats.isFile()) {
      errors.push(`${relativePath} must be a file.`);
    }
  } catch {
    errors.push(`${relativePath} is required.`);
  }
}

async function parseJson(relativePath) {
  try {
    JSON.parse(await readText(relativePath));
  } catch {
    errors.push(`${relativePath} must be valid JSON.`);
  }
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      files.push(...await listFiles(childPath));
    } else if (entry.isFile()) {
      files.push(childPath);
    }
  }
  return files;
}

