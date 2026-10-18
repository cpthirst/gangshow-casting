import { Username } from "@app/shared";
import type { ApiEvent } from "./handler.ts";
import type { UserDirectory } from "./user-directory.ts";

/** The account the path's {username} names, or undefined if none could have that name. */
export async function findAccount(directory: UserDirectory, event: ApiEvent) {
  const username = Username.safeParse(event.pathParameters?.username);
  return username.success ? directory.find(username.data) : undefined;
}
