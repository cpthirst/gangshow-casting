import { type Prop, PropList } from "@app/shared";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { partitionFor, queryAll, withoutKeys } from "./dynamo-table.ts";
import type { PropStore } from "./prop-store.ts";

const PROP = "PROP#";
/** A prop's sort key. Zero-padded, so props come back in id order. */
export const propKey = (id: number) => `${PROP}${String(id).padStart(8, "0")}`;

/** A prop as stored: its row, keyed in its production. */
export const propRow = (productionId: string, prop: Prop) => ({
  pk: partitionFor(productionId),
  sk: propKey(prop.id),
  ...prop,
});

/** Props in the production data table: one row per prop (ADR 0015). */
export function dynamoPropStore(db: DynamoDBDocumentClient, tableName: string): PropStore {
  return {
    async list(productionId) {
      const rows = await queryAll(db, tableName, productionId, PROP);
      const parsed = PropList.safeParse({ productionId, props: rows.map(withoutKeys) });
      if (!parsed.success) throw new Error(`Props for production ${productionId} are invalid`);
      return parsed.data;
    },
  };
}
