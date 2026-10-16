# Callout first line, toggle title and independent children

Use this guide when a user reports a blank first line, the gray `Callout block`
placeholder, or asks to move a paragraph title into that first line.

- `callout.rich_text` is the callout's first editable line.
- `toggle.rich_text` is the visible folding title.
- `children` are independent blocks below the own text. A title paragraph child
  does not fill the parent's own text. In creation payloads, `children` is a
  sibling of `type` and `callout`/`toggle`.
- An empty `callout.rich_text` can leave the editor placeholder visible even
  when children exist. The placeholder is UI text, not stored content or an
  extra empty paragraph to delete.

Read the actual block and its direct children before editing:

```bash
flowus --json block get <callout_id>
flowus --json block children <callout_id>
```

Unwrap the CLI `ok/data/error` envelope. Inspect `data.callout.rich_text` and
`data.results` respectively; follow pagination and `has_children` as needed.
The target must be the callout/toggle ID, not the page ID or title child ID.
Resolve these from reads within the already authorized task; no extra user
approval is needed merely to bind generated IDs.

## Create correctly

Save this as `children.json`; replace sample content as appropriate. Rich-text
entries include their complete Agent-facing fields.

```json
{
  "children": [{
    "type": "toggle",
    "toggle": {"rich_text": [{"type": "text", "text": {"content": "地道表达", "link": null}, "annotations": {"bold": false, "italic": false, "strikethrough": false, "underline": false, "code": false, "text_color": "default", "background_color": "default"}, "plain_text": "地道表达", "href": null}]},
    "children": [{
      "type": "callout",
      "callout": {"rich_text": [{"type": "text", "text": {"content": "On the bright side 往好处想", "link": null}, "annotations": {"bold": true, "italic": false, "strikethrough": false, "underline": false, "code": false, "text_color": "orange", "background_color": "default"}, "plain_text": "On the bright side 往好处想", "href": null}]},
      "children": [{
        "type": "paragraph",
        "paragraph": {"rich_text": [{"type": "text", "text": {"content": "用来引出坏消息里的好消息。", "link": null}, "annotations": {"bold": false, "italic": false, "strikethrough": false, "underline": false, "code": false, "text_color": "default", "background_color": "default"}, "plain_text": "用来引出坏消息里的好消息。", "href": null}]}
      }]
    }]
  }]
}
```

```bash
flowus --json block append <destination_page_id> --body children.json
```

## Fill an existing first line

Save this as `block-patch.json`. For a toggle, replace the `callout` key with
`toggle` and use the desired folding title. Copy the source title's actual
annotations if moving existing formatted text.

```json
{"callout": {"rich_text": [{"type": "text", "text": {"content": "On the bright side 往好处想", "link": null}, "annotations": {"bold": true, "italic": false, "strikethrough": false, "underline": false, "code": false, "text_color": "orange", "background_color": "default"}, "plain_text": "On the bright side 往好处想", "href": null}]}}
```

```bash
flowus --json block update <callout_id> --body block-patch.json
flowus --json block get <callout_id>
flowus --json block children <callout_id>
```

The patch changes only the own text and preserves existing children. Verify the
own text and annotations, and confirm child IDs/order/content remain unchanged.
If a duplicate title paragraph remains, identify its exact ID. Only remove it
through an available, authorized capability after verifying the copy. The CLI
does not expose DELETE; report the remaining duplicate rather than claiming it
was removed. Do not clear or rebuild the page.

Markdown is a simplified representation: it omits editor placeholders, colors
and exact block structure. Similar Markdown does not prove equivalent layout;
use both structured reads above for verification.
