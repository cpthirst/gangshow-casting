import { Costume, CostumeList } from "@app/shared";
import { type DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { roleKey } from "#/casting/roles/dynamo-role-store.ts";
import { castKey } from "#/show/cast/dynamo-cast-store.ts";
import {
  atRevision,
  deleteRowsOfItemsNotIn,
  deleteRowsWhere,
  partitionFor,
  queryAll,
  transacted,
  unchangedSince,
  withoutKeys,
} from "#/storage/dynamo-table.ts";
import type { CostumeChange, CostumeStore } from "./costume-store.ts";

const COSTUME = "COSTUME#";

/** A costume's row key: one per cast member per role, as a role is in one item only. */
const keyOf = (productionId: string, { roleId, castMemberId }: CostumeChange) => ({
  pk: partitionFor(productionId),
  sk: `${COSTUME}${roleId}#${castMemberId}`,
});

/** A costume as stored: its row, keyed in its production. */
export const costumeRow = (productionId: string, costume: Costume) => ({
  ...keyOf(productionId, costume),
  ...costume,
});

/** Whether a stored row is one of the cast member's. */
const isOf = (castMemberId: number) => (row: Record<string, unknown>) =>
  row.castMemberId === castMemberId;

/** The keys of a cast member's costume rows, for deleting them with the member (ADR 0010). */
export async function costumeKeysOf(
  db: DynamoDBDocumentClient,
  tableName: string,
  productionId: string,
  castMemberId: number,
) {
  const rows = await queryAll(db, tableName, productionId, COSTUME);
  return rows.filter(isOf(castMemberId)).map(({ pk, sk }) => ({ pk, sk }));
}

/** Costumes in the production data table: one row per cast member per role anyone has saved
 *  (ADR 0015). Each row is saved whole, so its three fields always go together. */
export function dynamoCostumeStore(db: DynamoDBDocumentClient, tableName: string): CostumeStore {
  return {
    async list(productionId) {
      const rows = await queryAll(db, tableName, productionId, COSTUME);
      const parsed = CostumeList.safeParse({ productionId, costumes: rows.map(withoutKeys) });
      if (!parsed.success) throw new Error(`Costumes for production ${productionId} are invalid`);
      return parsed.data;
    },

    async save(productionId, change, revision, role) {
      // Checked here too, as its ids become part of the row's key.
      const costume = Costume.parse({ ...change, revision: revision + 1 });
      const pk = partitionFor(productionId);
      // In one transaction (ADR 0015): the row is saved only if it's still at the revision it
      // was read at, its role is as the caller read it, and the cast member hasn't been
      // deleted, so a save racing a recast or a delete can't leave a row behind (ADR 0010).
      const failed = await transacted(() =>
        db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: costumeRow(productionId, costume),
                  ...unchangedSince(revision),
                },
              },
              {
                ConditionCheck: {
                  TableName: tableName,
                  Key: { pk, sk: roleKey(role.id) },
                  ...atRevision(role.revision),
                },
              },
              {
                ConditionCheck: {
                  TableName: tableName,
                  Key: { pk, sk: castKey(costume.castMemberId) },
                  ConditionExpression: "attribute_exists(pk)",
                },
              },
            ],
          }),
        ),
      );
      return failed ? "stale" : costume;
    },

    keepOnlyItems: (productionId, itemIds) =>
      deleteRowsOfItemsNotIn(db, tableName, productionId, COSTUME, itemIds),
    keepOnlyRoles: (productionId, roleIds) =>
      deleteRowsWhere(
        db,
        tableName,
        productionId,
        COSTUME,
        ({ roleId }) => !roleIds.some((id) => id === roleId),
      ),
    deleteCostumesOf: (productionId, castMemberId) =>
      deleteRowsWhere(db, tableName, productionId, COSTUME, isOf(castMemberId)),
  };
}
