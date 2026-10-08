# Native database fields: operate and verify

Use this recipe for CRM/table tasks involving relation, formula or rollup. Execute
the authorized changes, then read their result. Use current CLI help and endpoint
docs as the authority when the installed version differs.

## Discover and bind IDs

1. Run flowus help database update and flowus api --docs
   /v2/databases/{database_id} -X PATCH; for records use flowus help page create,
   flowus help page update and flowus help page property get.
2. Locate the requested source/target databases with search or fetch; read both
   using flowus --json database get <database_id>. If the task calls for new tables,
   use flowus help database create, create them under the authorized parent and
   keep the returned IDs. CLI JSON is an envelope: check ok:true, then read
   data.id; for ok:false inspect error instead of continuing as if it succeeded.
3. Replace SOURCE_DATABASE_ID, TARGET_DATABASE_ID, SOURCE_RECORD_ID,
   TARGET_RECORD_ID and FORMULA_PROPERTY_ID below with real IDs from reads or
   creation responses. A database ID is not a record ID. Property IDs come from
   database.properties; do not guess them from names or copy placeholder IDs.

## Configure schema

Write this request to schema.json. If the source has a different title field,
keep that field's name instead of adding another title.

```json
{
  "properties": {
    "Name": {
      "type": "title"
    },
    "Amount": {
      "type": "number"
    },
    "Client": {
      "type": "relation",
      "relation": {
        "database_id": "TARGET_DATABASE_ID"
      }
    },
    "Weighted": {
      "type": "formula",
      "formula": {
        "expression": "prop(\"Amount\") * 0.6"
      }
    }
  }
}
```

Run flowus --json database update <SOURCE_DATABASE_ID> --body schema.json, then read
the database back. Existing select/text fields cannot change into relation in
place: create and populate a new relation field before renaming/removing the old
one. Formula syntax is the native grammar, not JavaScript. For example,
prop("Amount") * 0.6 calculates a number; length(prop("Client")) counts relations.

Rollup schema uses stable IDs, not names. Write this to rollup-schema.json only
after binding the relation field ID and the target numeric field ID:

```json
{
  "properties": {
    "Total": {
      "type": "rollup",
      "rollup": {
        "relation_property_id": "RELATION_PROPERTY_ID",
        "rollup_property_id": "TARGET_AMOUNT_PROPERTY_ID",
        "function": "sum"
      }
    }
  }
}
```

Apply it with database update and read the schema back. Do not claim that rollup
calculation was verified from an API null: rollup result reads are not implemented.

## Create or link a record

Write this to record.json to create a source record. The relation ID must identify
an existing record in the target database.

```json
{
  "parent": {
    "database_id": "SOURCE_DATABASE_ID"
  },
  "properties": {
    "Name": {
      "type": "title",
      "title": [
        {
          "type": "text",
          "text": {
            "content": "Example deal",
            "link": null
          },
          "plain_text": "Example deal",
          "href": null,
          "annotations": {
            "bold": false,
            "italic": false,
            "strikethrough": false,
            "underline": false,
            "code": false,
            "text_color": "default",
            "background_color": "default"
          }
        }
      ]
    },
    "Amount": {
      "type": "number",
      "number": 1000
    },
    "Client": {
      "type": "relation",
      "relation": [
        {
          "id": "TARGET_RECORD_ID"
        }
      ]
    }
  }
}
```

Run flowus --json page create --body record.json --idempotency-key <task_record_key>
and keep the returned source record ID. Reuse that key only when retrying the
same intended create; give each distinct record its own key.

To link an existing source record, write relation-values.json:

```json
{
  "properties": {
    "Client": {
      "type": "relation",
      "relation": [
        {
          "id": "TARGET_RECORD_ID"
        }
      ]
    }
  }
}
```

Run flowus --json page update <SOURCE_RECORD_ID> --body relation-values.json.
Matching names and select options do not establish relations. Reverse fields and
values synchronize asynchronously and require target write access; read both
records to verify them. If pending, report that state and recheck the same IDs.

## Query and check the result

Write query.json:

```json
{
  "page_size": 10
}
```

```bash
flowus --json database query <SOURCE_DATABASE_ID> --body query.json
flowus --json page get <SOURCE_RECORD_ID>
flowus --json page property get <SOURCE_RECORD_ID> <FORMULA_PROPERTY_ID>
```

On API deployments with formula query support, Amount=1000 yields Weighted:
{"type":"number","number":600}. Check formula.type and the matching value field
(string/number/boolean/date), including valid 0/false values. For paginated reads,
follow next_cursor until has_more is false before claiming a complete result.

Formula/rollup record values are read-only. An empty expression returns string:null;
type:error carries error.code/message and is not a successful calculation.
Current-record scalar fields, nested formulas and relation counts are supported.
Unavailable related-record/rollup/people/file contexts return explicit errors.
Formula filters/sorts and rollup result reads are unsupported. Older servers may
return placeholder nulls; do not invent a computed value or bypass this by writing
formula/rollup cells. Report the unsupported or unverified part accurately.
