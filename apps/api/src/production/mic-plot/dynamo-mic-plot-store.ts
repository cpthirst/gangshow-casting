import { ItemMicPlot, MicPlotList } from "@app/shared";
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { partitionFor, queryAll, written } from "#/storage/dynamo-table.ts";
import { type MicPlotStore, withAllocation } from "./mic-plot-store.ts";

const MIC_PLOT = "MICPLOT#";
/** How many times to try again when someone else changes the item's channels meanwhile. */
const ATTEMPTS = 5;

/** An item's mic plot as stored: its row, keyed in its production, with a revision that goes
 *  up on every change. */
export const micPlotRow = (productionId: string, plot: ItemMicPlot, revision = 1) => ({
  pk: partitionFor(productionId),
  sk: `${MIC_PLOT}${plot.itemId}`,
  ...plot,
  revision,
});

// Written only if the row is still at the revision it was read at (none yet for 0).
const unchangedSince = (revision: number) =>
  revision === 0
    ? { ConditionExpression: "attribute_not_exists(pk)" }
    : {
        ConditionExpression: "revision = :revision",
        ExpressionAttributeValues: { ":revision": revision },
      };

/**
 * Mic plots in the production data table: one row per item with channels given out (ADR
 * 0015). A whole item's channels are in one row, so checking that someone is on only one of
 * them (production-mics FR4) and saving are one conditional write.
 */
export function dynamoMicPlotStore(db: DynamoDBDocumentClient, tableName: string): MicPlotStore {
  const keyOf = (productionId: string, itemId: string) => ({
    pk: partitionFor(productionId),
    sk: `${MIC_PLOT}${itemId}`,
  });

  async function read(productionId: string, itemId: string) {
    const { Item } = await db.send(
      new GetCommand({
        TableName: tableName,
        Key: keyOf(productionId, itemId),
        ConsistentRead: true,
      }),
    );
    if (!Item) return { plot: { itemId, mics: [] }, revision: 0 };
    const plot = ItemMicPlot.safeParse({ itemId: Item.itemId, mics: Item.mics });
    if (!plot.success) throw new Error(`Mic plot for production ${productionId} is invalid`);
    return { plot: plot.data, revision: Number(Item.revision) };
  }

  /** Saves the item's plot over the one read at `revision`: true if no one changed it since.
   *  An item with no channels given out has no row, so nothing is kept about it. */
  const save = (productionId: string, plot: ItemMicPlot, revision: number) =>
    written(() =>
      plot.mics.length === 0
        ? db.send(
            new DeleteCommand({
              TableName: tableName,
              Key: keyOf(productionId, plot.itemId),
              ...unchangedSince(revision),
            }),
          )
        : db.send(
            new PutCommand({
              TableName: tableName,
              Item: micPlotRow(productionId, plot, revision + 1),
              ...unchangedSince(revision),
            }),
          ),
    );

  return {
    async list(productionId) {
      const rows = await queryAll(db, tableName, productionId, MIC_PLOT);
      const items = rows.map(({ itemId, mics }) => ({ itemId, mics }));
      const parsed = MicPlotList.safeParse({ productionId, items });
      if (!parsed.success) throw new Error(`Mic plot for production ${productionId} is invalid`);
      return parsed.data;
    },

    async allocate(productionId, itemId, channel, castMemberId) {
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const { plot, revision } = await read(productionId, itemId);
        const allocated = withAllocation(plot, channel, castMemberId);
        if ("onAnotherChannel" in allocated) return allocated;
        // Freeing a channel on an item with no row: there's nothing to write.
        if (revision === 0 && allocated.mics.length === 0) return allocated;
        if (await save(productionId, allocated, revision)) return allocated;
        // Someone else changed the item's channels since they were read: read them again.
      }
      throw new Error("Couldn't give out the mic: the item's channels kept changing");
    },

    async keepOnlyItems(productionId, itemIds) {
      const rows = await queryAll(db, tableName, productionId, MIC_PLOT);
      for (const { sk, itemId } of rows) {
        if (itemIds.includes(String(itemId))) continue;
        await db.send(
          new DeleteCommand({ TableName: tableName, Key: { pk: partitionFor(productionId), sk } }),
        );
      }
    },
  };
}
