// The data function's Lambda entry point (ADR 0017): every route but the account routes,
// which run in their own function (accounts-lambda.ts).
import { lambdaEntry } from "./lambda-entry.ts";
import { routes } from "./routes.ts";

export const handler = lambdaEntry(routes);
