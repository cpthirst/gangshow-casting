import { BACKUP_WINDOW_DAYS } from "@app/shared";

/** Asked before starting a production: everyone moves to it, and the newest can't be deleted. */
export const startWarning = (year: string) =>
  `Start production ${year}? Everyone will move to ${year}, and this can't be undone.`;

/** Asked before deleting a production, or finishing a delete that stopped part way. */
export const deleteWarning = (year: string) =>
  `Delete production ${year}? This can't be undone. Copies stay in backups for up to ${BACKUP_WINDOW_DAYS} days.`;
