import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

/** JSON.parse that returns undefined instead of throwing (whose message can quote the input). */
export function parseJson(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? "");
  } catch {
    return undefined;
  }
}

/** A JSON response. */
export const jsonResponse = (
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** A refusal the app shows as it is, such as "That username is already taken." */
export const messageResponse = (statusCode: number, message: string) =>
  jsonResponse(statusCode, { message });
