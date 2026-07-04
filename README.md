# FlowUs CLI Skill

Private Codex plugin bundle for the FlowUs CLI agent skill.

## Install

Install this private repository as a plugin or install the skill directly:

```bash
npx skills add next-space/flowus-skill --skill flowus-cli
```

Direct path:

```bash
npx skills add https://github.com/next-space/flowus-skill/tree/main/skills/flowus-cli
```

## Usage

Use this skill when an agent needs to call the FlowUs V2 API through the
`flowus` command. The skill instructs agents to inspect CLI help first, use
`--json` for machine-readable output, use `FLOWUS_TOKEN` or saved credentials
for authentication, and avoid raw `curl` calls for FlowUs API work.

## Development

```bash
npm run check
```

