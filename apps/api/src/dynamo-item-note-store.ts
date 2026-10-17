import { type ItemNote, ItemNoteList } from "@app/shared";
import { type DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { conditionFailed, partitionFor, queryAll } from "./dynamo-table.ts";
import type { ItemNoteStore } from "./item-note-store.ts";

const NOTE = "NOTE#";

/** Item notes in the production data table, one item per item's notes (ADR 0015). */
export function dynamoItemNoteStore(db: DynamoDBDocumentClient, tableName: string): ItemNoteStore {
  return {
    async list(productionId) {
      const items = await queryAll(db, tableName, productionId, NOTE);
      const notes = items.map(({ itemId, text, revision }) => ({ itemId, text, revision }));
      return ItemNoteList.parse({ productionId, notes });
    },

    async save(productionId, itemId, revision, text) {
      const note: ItemNote = { itemId, text, revision: revision + 1 };
      try {
        await db.send(
          new PutCommand({
            TableName: tableName,
            Item: { pk: partitionFor(productionId), sk: `${NOTE}${itemId}`, ...note },
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
  };
}
