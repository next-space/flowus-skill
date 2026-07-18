---
name: flowus-cli
description: Use when an agent needs to call the FlowUs API through the FlowUs CLI, authenticate FlowUs, upload a file, create or update a page, query a database, search content, edit Markdown page content, or any task involving the `flowus` command.
metadata:
  openclaw:
    requires:
      bins:
        - flowus
    envVars:
      - name: FLOWUS_TOKEN
        required: false
        description: Optional FlowUs bearer token; browser login or saved CLI credentials may be used instead.
      - name: FLOWUS_BASE_URL
        required: false
        description: Optional FlowUs API base URL.
      - name: FLOWUS_CONFIG_DIR
        required: false
        description: Optional directory containing FlowUs CLI credentials and configuration.
      - name: FLOWUS_USER_AGENT
        required: false
        description: Optional suffix for the FlowUs CLI user agent.
---

# FlowUs CLI

Use the FlowUs CLI (`flowus`) for FlowUs V2 API work: pages, blocks,
databases, search, Markdown content, and files.

The CLI source repository may be private. Do not ask the user to clone source
code before using the CLI. Install or update the released binary from the
official FlowUs CDN only after the user explicitly approves it.

Do not assume old FlowUs skill names such as `flowus-auth`, `flowus-page`, or
`flowus:flowus-login`.

## Mandatory preflight

When this skill is selected for any FlowUs task, complete this preflight before
API work, searches, reads, writes, counts, uploads, or endpoint-specific
planning:

1. Inspect whether the CLI is available without installing or updating it:

```bash
if command -v flowus >/dev/null 2>&1; then
  flowus version
else
  echo "FlowUs CLI is not installed"
fi
```

If the CLI is missing or outdated, explain that the official installer is
available at `https://cdn2.flowus.cn/flowus-cli/install` (or
`https://cdn2.flowus.cn/flowus-cli/install.ps1` on Windows). Do not download,
execute, or update it until the user explicitly approves that action.

2. If the CLI is installed, inspect authentication and active identity:

```bash
flowus --json doctor
flowus --json whoami
```

Continue only when the checks show authenticated FlowUs credentials. If
authentication is missing or invalid, do not start a login flow automatically.
Explain the available options and wait for the user's explicit choice:

- If `FLOWUS_TOKEN` is already set, rerun `flowus --json doctor` and
  `flowus --json whoami`; do not ask for another login.
- Browser login: `flowus login --browser`.
- Manual setup for headless environments: `flowus --json login --manual`.
- Configure `FLOWUS_TOKEN` or saved credentials through an approved secret
  channel.

Do not run plain `flowus login` in agent sessions because it can block on an
interactive method prompt. Do not make API calls or draw conclusions from
incomplete data until authentication is verified. After the user explicitly
approves a login method, run only that selected method and then rerun
`flowus --json doctor` and `flowus --json whoami`.

Use this browser login command only after the user explicitly selects browser
login:

```bash
flowus login --browser
```

Use manual setup only after the user explicitly selects it for a headless or
remote environment:

```bash
flowus --json login --manual
```

If a command is missing or help output looks stale, explain that `flowus update`
can update the CLI and wait for explicit user approval before running it.

Useful install overrides:

- `FLOWUS_INSTALL_DIR` - install directory.
- `FLOWUS_VERSION` - exact release version, such as `v0.1.10`.
- `FLOWUS_CLI_RELEASE_BASE_URL` - alternate release base URL for tests.

## First rule: ask the CLI

The CLI is self-documenting. Prefer these commands over guessing syntax or
request fields:

- `flowus --help` - list global options and top-level commands.
- `flowus help <command...>` - show usage, options, examples, and notes for any
  command or subcommand.
- `flowus api ls` - list public API endpoints and request field hints.
- `flowus api ls --plain` - compact endpoint list for scanning.
- `flowus api --docs <PATH> -X <METHOD>` - show agent-readable Markdown docs
  for one endpoint, including parameters, examples, and safety notes.
- `flowus api --spec <PATH> -X <METHOD>` - show the exact embedded OpenAPI
  fragment for one endpoint.
- `flowus --json doctor` - inspect local authentication and configuration state
  when auth or base URL selection is unclear.
- `flowus --json whoami` - verify the active FlowUs identity.
- `flowus markdown get <page-id>` - retrieve page content as Markdown.

If you are unsure about syntax, request body fields, pagination, auth source,
or command coverage, run help first.

## Authentication and configuration

The CLI resolves credentials in this precedence order:

1. `--token <token>`
2. `FLOWUS_TOKEN`
3. saved login credentials in the FlowUs credential store

Use these checks:

```bash
flowus --json doctor
flowus --json whoami
```

If no valid credentials are available, offer browser login, manual setup, or an
approved `FLOWUS_TOKEN` secret path. Wait for the user to select one before
starting authentication:

```bash
flowus --json login --manual
```

Do not ask the user to paste bearer tokens into chat. Ask them to provide
credentials through `FLOWUS_TOKEN`, saved login credentials, or an approved
secret channel, then rerun `flowus --json doctor` and `flowus --json whoami`.

Common environment variables:

- `FLOWUS_TOKEN` - bearer token for API calls.
- `FLOWUS_BASE_URL` - API base URL; default is `https://api.flowus.cn`.
- `FLOWUS_CONFIG_DIR` - config directory; default follows the FlowUs profile.
- `FLOWUS_USER_AGENT` - custom user agent suffix.

Do not print bearer tokens, write them into files, or paste them into request
bodies. Do not call the FlowUs V2 API with `curl`; use the CLI so auth,
product defaults, retries, and error formatting stay consistent.

## Working rules

- Use `--json` for stable machine-readable stdout.
- Keep JSON request bodies in local files and pass them with `--body <file>`.
- Keep Markdown replacement content in local files and pass it with `--file <file>`.
- Prefer domain commands over `api call`; `flowus api --docs` names a
  recommended domain command when one exists.
- Before write operations, confirm IDs, file paths, URLs, and body files come
  from user-authorized input.
- For paginated commands, inspect JSON output for cursors and repeat with the
  command's cursor option.
- The CLI intentionally rejects DELETE API calls. Do not work around that for
  destructive operations unless the user explicitly asks for a different tool.

## Common workflows

### Read a page

```bash
flowus --json page get <page_id>
flowus markdown get <page_id> > page.md
```

Use Markdown for page content work whenever possible. It is easier to inspect,
edit, and diff than raw block JSON.

### Replace page Markdown

```bash
flowus markdown put --file page.md <page_id>
```

Only run this after confirming the target page ID and replacement file.

### Create or update a page with JSON

Create a local JSON body file, then pass it to the CLI:

```bash
flowus --json page create --body page.json
flowus --json page update --body patch.json <page_id>
```

For idempotent creates, use `--idempotency-key <key>`.

### Blocks and children

```bash
flowus --json block get <block_id>
flowus --json block children <block_id>
flowus --json block append <block_id> --body children.json
flowus --json block update <block_id> --body block-patch.json
```

### Databases

```bash
flowus --json database get <database_id>
flowus --json database query <database_id> --body query.json
flowus --json database mutate <database_id> --body mutation.json --idempotency-key <key>
flowus --json page property get <page_id> <property_id>
```

Use `flowus api --docs` or command help to inspect filter and sort body shapes
before writing `query.json`.

Use `database mutate` for one atomic, permission-checked database write that can
rename properties by stable property ID, add properties, create records, and
update explicitly identified records. Read the database first and use the
returned property IDs. Never model a property rename by creating another text
property with the requested name, and never overwrite existing records when the
user asked to create a new record.

For example, when the user asks to rename the title property to `姓名` and add a
record titled `白居易`, write this body to `mutation.json`:

```json
{
  "properties": [
    {
      "id": "<title_property_id>",
      "name": "姓名"
    }
  ],
  "create_records": [
    {
      "title": "白居易"
    }
  ]
}
```

Then run one command with a stable idempotency key:

```bash
flowus --json database mutate <database_id> --body mutation.json --idempotency-key <key>
```

Do not split a combined request into independent property and record writes.
The server validates write access and commits all requested changes in one
transaction.

### Search

```bash
flowus --json search text "roadmap" --page-size 10
flowus --json search semantic "tasks about quarterly planning" --space-id <space_id> --page-size 10
```

Use text search for exact titles, keywords, and known phrases. Use semantic
search when intent matters more than exact wording.

### Files

Upload a local file for a parent page:

```bash
flowus --json file upload --parent-page <page_id> ./report.pdf
```

Append a FlowUs-hosted file block with the returned object name and size:

```bash
flowus --json block append-file <block_id> --oss-name <oss_name> --size <bytes>
```

Append an external file URL:

```bash
flowus --json block append-file <block_id> --external-url https://example.com/report.pdf
```

## Fallback API calls

Use `api call` only when no domain command covers the endpoint. Lookup sequence:

```bash
flowus api ls --plain
flowus api --docs /v2/blocks/{block_id}/children -X PATCH
flowus api --spec /v2/blocks/{block_id}/children -X PATCH
flowus --json api call PATCH /v2/blocks/:block_id/children --param block_id=<block_id> --body body.json
```

`--param` fills path placeholders first; remaining keys become query
parameters. Use `--header NAME=VALUE` for headers such as `If-Match`.

## Troubleshooting

- Command not found: offer the official installer at `https://cdn2.flowus.cn/flowus-cli/install` and wait for explicit approval before using it.
- Unknown command or option: ask approval before running `flowus update`, then run `flowus <command> --help`.
- Authentication failure: run `flowus --json doctor`, check `FLOWUS_TOKEN`, then
  offer `flowus login --manual` if needed and wait for explicit approval.
- Unexpected API shape: run `flowus api --docs <PATH> -X <METHOD>` and
  `flowus api --spec <PATH> -X <METHOD>` before retrying.
