import { z } from "zod";
import { CastMember } from "./cast.ts";
import { NoteText, SavedNoteText } from "./item-note.ts";
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
});

/** GET /api/productions/{productionId}/costumes: every costume with any text, in no
 *  particular order. A row nobody has filled in isn't listed. */
export const CostumeList = z.strictObject({
  productionId: ProductionId,
  costumes: z.array(Costume).max(20_000),
});

/**
 * PUT /api/productions/{productionId}/items/{itemId}/costumes: one row's three fields
 * together (trimmed; "" empties one), for a cast member in one of the item's roles.
 * 200 returns the saved Costume; 400 for a field over 500 characters, a role not in the item
 * or a cast member not in that role; 404 if the item isn't in the latest saved running order.
 */
export const SaveCostumeRequest = z.strictObject({
  roleId: Role.shape.id,
  castMemberId: CastMember.shape.id,
  fromWardrobe: SavedNoteText,
  fromCastMember: SavedNoteText,
  notes: SavedNoteText,
});

/** Whether nobody has written anything in the row, so nothing need be kept for it. */
export const isEmptyCostume = ({ fromWardrobe, fromCastMember, notes }: CostumeFields) =>
  fromWardrobe === "" && fromCastMember === "" && notes === "";

export type Costume = z.infer<typeof Costume>;
export type CostumeList = z.infer<typeof CostumeList>;
export type SaveCostumeRequest = z.infer<typeof SaveCostumeRequest>;
/** A costume row's three fields. */
export type CostumeFields = Pick<Costume, keyof typeof costumeFields>;
