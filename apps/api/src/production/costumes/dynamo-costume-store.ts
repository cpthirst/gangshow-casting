import { Costume, CostumeList, isEmptyCostume } from "@app/shared";
import { DeleteCommand, type DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  deleteRowsOfItemsNotIn,
  partitionFor,
  queryAll,
  withoutKeys,
} from "#/storage/dynamo-table.ts";
import type { CostumeStore } from "./costume-store.ts";

const COSTUME = "COSTUME#";

/** A costume's row key: one per cast member per role, as a role is in one item only. */
const keyOf = (productionId: string, { roleId, castMemberId }: Costume) => ({
  pk: partitionFor(productionId),
  sk: `${COSTUME}${roleId}#${castMemberId}`,
});

/** A costume as stored: its row, keyed in its production. */
export const costumeRow = (productionId: string, costume: Costume) => ({
  ...keyOf(productionId, costume),
  ...costume,
});

/** Costumes in the production data table: one row per cast member per role with any text
 *  (ADR 0015). Each row is saved whole, so its three fields always go together. */
export function dynamoCostumeStore(db: DynamoDBDocumentClient, tableName: string): CostumeStore {
  return {
    async list(productionId) {
      const rows = await queryAll(db, tableName, productionId, COSTUME);
      const parsed = CostumeList.safeParse({ productionId, costumes: rows.map(withoutKeys) });
      if (!parsed.success) throw new Error(`Costumes for production ${productionId} are invalid`);
      return parsed.data;
    },

    async save(productionId, costume) {
      // Checked here too, as its ids become part of the row's key.
      const saved = Costume.parse(costume);
      if (isEmptyCostume(saved)) {
        await db.send(new DeleteCommand({ TableName: tableName, Key: keyOf(productionId, saved) }));
      } else {
        await db.send(
          new PutCommand({ TableName: tableName, Item: costumeRow(productionId, saved) }),
        );
      }
      return saved;
    },

    keepOnlyItems: (productionId, itemIds) =>
      deleteRowsOfItemsNotIn(db, tableName, productionId, COSTUME, itemIds),
  };
}
