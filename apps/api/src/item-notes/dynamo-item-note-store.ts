import { ItemNote, ItemNoteList } from "@app/shared";
import { DeleteCommand, type DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { conditionFailed, partitionFor, queryAll } from "#/storage/dynamo-table.ts";
import type { ItemNoteStore } from "./item-note-store.ts";

const NOTE = "NOTE#";
/** Props notes' sort key prefix, apart from the casting notes' (production-props FR20). */
export const PROPS_NOTE = "PROPSNOTE#";
/** Scenery notes' sort key prefix, apart from the others (production-scenery E2.S1). */
export const SCENERY_NOTE = "SCENERYNOTE#";

/** Item notes in the production data table: one row per show item's notes (ADR 0015), keyed
 *  under `prefix`, so props notes are kept the same way, apart. */
export function dynamoItemNoteStore(
  db: DynamoDBDocumentClient,
  tableName: string,
  prefix = NOTE,
): ItemNoteStore {
  return {
    async list(productionId) {
      const items = await queryAll(db, tableName, productionId, prefix);
      const notes = items.map(({ itemId, text, revision }) => ({ itemId, text, revision }));
      return ItemNoteList.parse({ productionId, notes });
    },

    async save(productionId, itemId, revision, text) {
      // Checked here too, as the item id becomes part of the row's key.
      const note = ItemNote.parse({ itemId, text, revision: revision + 1 });
      try {
        await db.send(
          new PutCommand({
            TableName: tableName,
            Item: { pk: partitionFor(productionId), sk: `${prefix}${itemId}`, ...note },
            // Saved only if still at the revision it was read at (none yet for revision 0).
            ...(revision === 0
              ? { ConditionExpression: "attribute_not_exists(pk)" }
              : {
                  ConditionExpression: "revision = :revision",
                  ExpressionAttributeValues: { ":revision": revision },
                }),
          }),
        );
      } catch (error) {
        if (conditionFailed(error)) return "stale";
        throw error;
      }
      return note;
    },

    async keepOnlyItems(productionId, itemIds) {
      const rows = await queryAll(db, tableName, productionId, prefix);
      for (const { sk, itemId } of rows) {
        if (itemIds.includes(String(itemId))) continue;
        await db.send(
          new DeleteCommand({ TableName: tableName, Key: { pk: partitionFor(productionId), sk } }),
        );
      }
    },
  };
}
