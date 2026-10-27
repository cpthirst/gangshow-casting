import { Prop, PropList } from "@app/shared";
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  conditionFailed,
  META,
  partitionFor,
  queryAll,
  withoutKeys,
  written,
} from "./dynamo-table.ts";
import { castCarriers } from "./prop-links.ts";
import type { PropStore } from "./prop-store.ts";

const PROP = "PROP#";
/** How many times to sweep again when a prop changes while its carriers are dropped. */
const ATTEMPTS = 5;
/** A prop's sort key. Zero-padded, so props come back in id order. */
export const propKey = (id: number) => `${PROP}${String(id).padStart(8, "0")}`;

/** A prop as stored: its row, keyed in its production. */
export const propRow = (productionId: string, prop: Prop) => ({
  pk: partitionFor(productionId),
  sk: propKey(prop.id),
  ...prop,
});

/**
 * Props in the production data table: one row per prop (ADR 0015). The META row's
 * `lastPropId` hands out ids, so they're never reused. Anything that writes prop rows
 * directly must also set `lastPropId` to the highest id.
 */
export function dynamoPropStore(db: DynamoDBDocumentClient, tableName: string): PropStore {
  /** Takes the production's next prop id. One taken for an add that then fails is simply
   *  skipped: ids only need never to repeat. */
  async function takeNextId(productionId: string) {
    const result = await db.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: partitionFor(productionId), sk: META },
        UpdateExpression: "ADD lastPropId :one",
        ExpressionAttributeValues: { ":one": 1 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    const id: unknown = result.Attributes?.lastPropId;
    if (typeof id !== "number") throw new Error("The prop id counter is missing");
    return id;
  }

  async function list(productionId: string) {
    const rows = await queryAll(db, tableName, productionId, PROP);
    const parsed = PropList.safeParse({ productionId, props: rows.map(withoutKeys) });
    if (!parsed.success) throw new Error(`Props for production ${productionId} are invalid`);
    return parsed.data;
  }

  return {
    list,

    async add(productionId, itemId, details) {
      const prop = Prop.parse({ ...details, id: await takeNextId(productionId), itemId });
      // Never over another prop: a counter behind the rows fails loudly instead.
      await db.send(
        new PutCommand({
          TableName: tableName,
          Item: propRow(productionId, prop),
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      );
      return prop;
    },

    async update(productionId, id, details) {
      // Not `written`: that only says whether it wrote, and this needs the updated prop back.
      try {
        const result = await db.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { pk: partitionFor(productionId), sk: propKey(id) },
            // "name" is a DynamoDB reserved word.
            UpdateExpression:
              "SET #name = :name, quantity = :quantity, roleIds = :roleIds, carrierIds = :carrierIds",
            ConditionExpression: "attribute_exists(sk)",
            ExpressionAttributeNames: { "#name": "name" },
            ExpressionAttributeValues: {
              ":name": details.name,
              ":quantity": details.quantity,
              ":roleIds": details.roleIds,
              ":carrierIds": details.carrierIds,
            },
            ReturnValues: "ALL_NEW",
          }),
        );
        return Prop.parse(withoutKeys(result.Attributes ?? {}));
      } catch (error) {
        if (conditionFailed(error)) return "not-found";
        throw error;
      }
    },

    async remove(productionId, id) {
      const removed = await written(() =>
        db.send(
          new DeleteCommand({
            TableName: tableName,
            Key: { pk: partitionFor(productionId), sk: propKey(id) },
            ConditionExpression: "attribute_exists(sk)",
          }),
        ),
      );
      return removed ? "removed" : "not-found";
    },

    async dropStrayCarriers(productionId, roles) {
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const { props } = await list(productionId);
        const changes = props.flatMap((prop) => {
          const kept = castCarriers(prop, roles);
          // castCarriers only takes carriers off, so the same length means unchanged.
          return kept.length === prop.carrierIds.length ? [] : [{ prop, kept }];
        });
        // Each only over the carriers read, so an edit or removal meanwhile isn't undone.
        const saved = await Promise.all(
          changes.map(({ prop, kept }) =>
            written(() =>
              db.send(
                new UpdateCommand({
                  TableName: tableName,
                  Key: { pk: partitionFor(productionId), sk: propKey(prop.id) },
                  UpdateExpression: "SET carrierIds = :kept",
                  ConditionExpression: "carrierIds = :was",
                  ExpressionAttributeValues: { ":kept": kept, ":was": prop.carrierIds },
                }),
              ),
            ),
          ),
        );
        if (saved.every(Boolean)) return;
        // A prop changed since it was read: read them all again.
      }
      throw new Error("Couldn't drop stray carriers: props kept changing");
    },
  };
}
