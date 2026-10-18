import type { AccountList } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { jsonResponse } from "./json.ts";
import type { UserDirectory } from "./user-directory.ts";

// GET /api/accounts: every account, for admins (hosting FR11).
export function createListAccounts(directory: UserDirectory) {
  return async (): Promise<APIGatewayProxyStructuredResultV2> => {
    const list: AccountList = { accounts: await directory.list() };
    return jsonResponse(200, list);
  };
}
