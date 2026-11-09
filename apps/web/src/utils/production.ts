/** Asked before starting a production: everyone moves to it, and the newest can't be deleted. */
export const startWarning = (year: string) =>
  `Start production ${year}? Everyone will move to ${year}, and this can't be undone.`;
