---
name: flowus-cli
description: Use when an agent needs to call the FlowUs API through the FlowUs CLI, authenticate FlowUs, upload a file, create or update a page, query a database, search content, edit Markdown page content, or any task involving the `flowus` command.
license: MIT
---

# FlowUs CLI

Use the FlowUs CLI (`flowus`) for FlowUs V2 API work: pages, blocks,
databases, search, Markdown content, and files.

Do not assume old FlowUs skill names such as `flowus-auth`, `flowus-page`, or
`flowus:flowus-login`.

## First rule: ask the CLI

The CLI is self-documenting. Prefer these commands over guessing syntax or
request fields:

- `flowus --help` - list global options and top-level commands.
- `flowus help <command...>` - show usage, options, examples, and notes for any
  command or subcommand.
- `flowus api ls` - list public API endpoints and request field hints.
- `flowus api --docs <PATH> -X <METHOD>` - show agent-readable Markdown docs
  for one endpoint, including parameters, examples, and safety notes.
- `flowus api --spec <PATH> -X <METHOD>` - show the exact embedded OpenAPI
  fragment for one endpoint.
- `flowus --json doctor` - inspect local authentication and configuration state
  when auth or base URL selection is unclear.
- `flowus --json whoami` - verify the active FlowUs identity.
- `flowus --json markdown get <page-id>` - retrieve page content as Markdown.

If you are unsure about syntax, request body fields, pagination, auth source,
or command coverage, run help first.

## Working rules

- Use `--json` for stable machine-readable stdout.
- Keep JSON request bodies in local files and pass them with `--body <file>`.
- Keep Markdown replacement content in local files and pass it with `--file <file>`.
- Check `FLOWUS_TOKEN` first. Credential precedence is `--token`, then
  `FLOWUS_TOKEN`, then saved login credentials.
- Do not print or save bearer tokens outside the FlowUs CLI credential store.
- Prefer domain commands over `api call`; `flowus api --docs` names a
  recommended domain command when one exists.
- Do not call the FlowUs V2 API with `curl`.
- Before write operations, confirm IDs, file paths, URLs, and body files come
  from user-authorized input.

## Useful commands

- Pages: `page get/create/update`, `page property get`
- Blocks: `block get/children/append/update/append-file`
- Databases: `database get/query/create/update`
- Markdown: `markdown get/put`
- Search: `search text`, `search semantic`
- Files: `file upload`
- Fallback: `flowus --json api call ...`

For fallback API work, use this lookup sequence before constructing a request:

```bash
flowus api ls
flowus api --docs /v2/blocks/{block_id}/children -X PATCH
flowus api --spec /v2/blocks/{block_id}/children -X PATCH
flowus --json api call PATCH /v2/blocks/:block_id/children --param block_id=<block_id> --body body.json
```

Use `flowus api ls --plain` when you need a compact list of request fields for
operations such as `updateBlock` or `appendBlockChildren`. Use `--spec` when
the full OpenAPI schema is needed.

