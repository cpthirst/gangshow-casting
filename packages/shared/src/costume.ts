import { z } from "zod";
import { CastMember } from "./cast.ts";
import { ItemNote, NoteText, SavedNoteText, SaveItemNoteRequest } from "./item-note.ts";
import { Role } from "./role.ts";
import { ProductionId, RunningOrderItem } from "./running-order.ts";

/** What a costume row holds (production-costume-sheets FR4): garments and who provides them,
 *  never sizes or measurements (ADR 0010). */
const costumeFields = {
  fromWardrobe: NoteText,
  fromCastMember: NoteText,
  notes: NoteText,
};

/**
 * What one cast member wears in one role in one item (production-costume-sheets FR8). It
 * names the role and cast member by id, never by name, and is strict, so it can't carry
 * anything else about a person.
 */
export const Costume = z.strictObject({
  itemId: RunningOrderItem.shape.id,
  roleId: Role.shape.id,
  castMemberId: CastMember.shape.id,
  ...costumeFields,
  /** Goes up on every save, so a stale save can be refused (FR7), as item notes' does. */
  revision: ItemNote.shape.revision,
});

/** GET /api/productions/{productionId}/costumes: every row anyone has saved, in no particular
 *  order, a row since emptied included. A row nobody has saved isn't listed. */
export const CostumeList = z.strictObject({
  productionId: ProductionId,
  costumes: z.array(Costume).max(20_000),
});

/**
 * PUT /api/productions/{productionId}/items/{itemId}/costumes: one row's three fields
 * together (trimmed; "" empties one), for a cast member in one of the item's roles, and the
 * revision they were based on, 0 for a row nobody has saved.
 * 200 returns the saved Costume; 409 means someone else saved the row first, and returns it as
 * it is now; 400 for a field over 500 characters, a role not in the item or a cast member not
 * in that role; 404 if the item isn't in the latest saved running order.
 */
export const SaveCostumeRequest = z.strictObject({
  roleId: Role.shape.id,
  castMemberId: CastMember.shape.id,
  fromWardrobe: SavedNoteText,
  fromCastMember: SavedNoteText,
  notes: SavedNoteText,
  revision: SaveItemNoteRequest.shape.revision,
});

export type Costume = z.infer<typeof Costume>;
export type CostumeList = z.infer<typeof CostumeList>;
export type SaveCostumeRequest = z.infer<typeof SaveCostumeRequest>;
/** A costume row's three fields. */
export type CostumeFields = Pick<Costume, keyof typeof costumeFields>;
