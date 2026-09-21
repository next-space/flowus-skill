#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillName = 'flowus-cli';
const packageName = 'flowus-skill';
const productName = 'FlowUs';
const commandName = 'flowus';
const tokenEnv = 'FLOWUS_TOKEN';
const installUrl = 'https://cdn2.flowus.cn/flowus-cli/install';
const windowsInstallUrl = 'https://cdn2.flowus.cn/flowus-cli/install.ps1';
const forbiddenTerms = ['Build' + 'in', 'build' + 'in', 'BUILD' + 'IN'];

const errors = [];

await requireFile('README.md');
await requireFile('package.json');
await requireFile(`skills/${skillName}/SKILL.md`);
await requireFile(`skills/${skillName}/agents/openai.yaml`);
await rejectPath('.agents/plugins');
await rejectPath('.claude-plugin');
await rejectPath('.codex-plugin');

const packageJson = await parseJson('package.json');
expectEqual(packageJson.name, packageName, 'package.json name');
expectEqual(packageJson.private, true, 'package.json private');
expectEqual(packageJson.scripts?.check, 'node scripts/validate-skill.mjs', 'package.json scripts.check');

const skill = await readText(`skills/${skillName}/SKILL.md`);
if (!skill.includes(`name: ${skillName}`)) {
  errors.push(`skills/${skillName}/SKILL.md frontmatter name must be ${skillName}.`);
}
if (skill.includes('license:')) {
  errors.push(`skills/${skillName}/SKILL.md must not override ClawHub's MIT-0 license.`);
}
if (!skill.includes('metadata:\n  openclaw:')) {
  errors.push(`skills/${skillName}/SKILL.md must declare ClawHub runtime metadata.`);
}
if (!skill.includes(productName) || !skill.includes(commandName) || !skill.includes(tokenEnv)) {
  errors.push(`skills/${skillName}/SKILL.md must describe ${productName}, ${commandName}, and ${tokenEnv}.`);
}
for (const expected of [
  installUrl,
  windowsInstallUrl,
  `command -v ${commandName}`,
  `${commandName} version`,
  `${commandName} update`,
  `${commandName} --json doctor`,
  `${commandName} --json whoami`,
  `${commandName} --json workspace`,
  `${commandName} --json workspace directory`,
  `${commandName} --json fetch`,
  `${commandName} --json page list`,
  `${commandName} --json page edit`,
  `${commandName} --json page duplicate`,
  `${commandName} --json database view`,
  `${commandName} --json user ls`,
  `${commandName} login --browser`,
  `${commandName} --json login --manual`,
  `${commandName} api ls --plain`,
  `${commandName} api --docs`,
  `${commandName} api --spec`,
  `${commandName} --json api call`,
  `${commandName} markdown get`,
  `${commandName} markdown put`,
  `${commandName} --json file upload`,
  'FLOWUS_INSTALL_DIR',
  'FLOWUS_VERSION',
  'FLOWUS_CLI_RELEASE_BASE_URL',
  'FLOWUS_BASE_URL',
  'FLOWUS_CONFIG_DIR',
]) {
  expectIncludes(skill, expected, `skills/${skillName}/SKILL.md`);
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
expectIncludes(openaiYaml, 'install', `skills/${skillName}/agents/openai.yaml`);
expectIncludes(openaiYaml, productName, `skills/${skillName}/agents/openai.yaml`);

for (const file of await listFiles(root)) {
  const relativeFile = path.relative(root, file).split(path.sep).join('/');
  if (relativeFile === '.git' || relativeFile.startsWith('.git/')) continue;
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

async function rejectPath(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    errors.push(`${relativePath} must not exist.`);
  } catch {
    // Missing is expected.
  }
}

async function parseJson(relativePath) {
  try {
    return JSON.parse(await readText(relativePath));
  } catch {
    errors.push(`${relativePath} must be valid JSON.`);
    return {};
  }
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    errors.push(`${label} must be ${JSON.stringify(expected)}.`);
  }
}

function expectIncludes(actual, expected, label) {
  if (typeof actual !== 'string' || !actual.includes(expected)) {
    errors.push(`${label} must include ${expected}.`);
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
