import { Username } from "@app/shared";
import { moveOutOfReadOnly, restoreAdmin, setUpCheckAccounts } from "./admin-account.ts";
import { cognitoClientFor, cognitoUserDirectory } from "./cognito-user-directory.ts";
import { generatePassword } from "./password.ts";
import type { UserDirectory } from "./user-directory.ts";

type Env = Record<string, string | undefined>;
type Deps = {
  print: (line: string) => void;
  directoryFor: (userPoolId: string) => UserDirectory;
  newPassword: () => string;
};

const USAGE = [
  "Usage:",
  "  pnpm account admin <username>    create or restore an admin",
  "  pnpm account check <admin username> <member username> <read-only username>",
  "                                   set up the post-deploy check's accounts",
  "  pnpm account roles               move every account out of the retiring read-only group",
];

/** The usernames the command needs, or the lines saying why they can't be used. */
function parse(args: string[]) {
  const [command, ...usernames] = args;
  if (command === "roles") return usernames.length === 0 ? { roles: true } : { problem: USAGE };
  const wanted = command === "admin" ? 1 : command === "check" ? 3 : 0;
  if (!wanted || usernames.length !== wanted) return { problem: USAGE };
  for (const username of usernames) {
    const result = Username.safeParse(username);
    if (!result.success) return { problem: result.error.issues.map((issue) => issue.message) };
  }
  // Usernames ignore case in the pool, so "Check-Admin" is "check-admin".
  if (new Set(usernames.map((username) => username.toLowerCase())).size !== usernames.length) {
    return { problem: ["The check accounts need different usernames."] };
  }
  const [first = "", member = "", readOnly = ""] = usernames;
  return command === "admin" ? { admin: first } : { check: { admin: first, member, readOnly } };
}

/**
 * Creates or restores an admin account (hosting FR14), sets up the post-deploy check's
 * accounts, or moves every account out of the read-only group (ADR 0026), in the
 * user pool named by USER_POOL_ID, with the maintainer's AWS credentials.
 * Each password is printed once and never written anywhere else. Returns the exit code.
 */
export async function runAccount(args: string[], env: Env, deps: Deps): Promise<number> {
  const { print } = deps;
  const parsed = parse(args);
  if (parsed.problem) {
    for (const line of parsed.problem) print(line);
    return 1;
  }
  const userPoolId = env.USER_POOL_ID;
  if (!userPoolId) {
    print("Set USER_POOL_ID to the user pool's id (the stack's UserPoolId output).");
    return 1;
  }

  // First, so a shell set up for the wrong pool is obvious.
  print(`Using user pool ${userPoolId}.`);
  const directory = deps.directoryFor(userPoolId);
  try {
    if (parsed.admin) {
      const username = parsed.admin;
      const { created, password } = await restoreAdmin(directory, username, deps.newPassword);
      print(
        created
          ? `Created ${username} as an admin.`
          : `Restored ${username}: enabled, an admin, and signed out on every device within 5 minutes.`,
      );
      print(`Temporary password, shown only now: ${password}`);
      print(`${username} must choose a new password at first sign-in.`);
    } else if (parsed.check) {
      const { admin, member, readOnly } = parsed.check;
      const passwords = await setUpCheckAccounts(directory, parsed.check, deps.newPassword);
      print(
        `${admin} is an Admin, ${member} has Casting and ${readOnly} is Read-only, all with permanent passwords.`,
      );
      print("Passwords, shown only now, for pnpm check:hosted:");
      print(`  ${admin}: ${passwords.admin}`);
      print(`  ${member}: ${passwords.member}`);
      print(`  ${readOnly}: ${passwords.readOnly}`);
    } else if (parsed.roles) {
      const { checked, moved, hadOthers } = await moveOutOfReadOnly(directory);
      if (moved.length === 0) {
        print(
          `Checked ${checked} accounts. Moved 0 out of the read-only group: none is left in it.`,
        );
      } else {
        print(
          `Checked ${checked} accounts. Moved ${moved.length} out of the read-only group: ${moved.join(", ")}.`,
        );
        if (hadOthers.length > 0) {
          print(
            `Also took their other groups from ${hadOthers.join(", ")}, as read-only cancelled them.`,
          );
        }
        print("They have no permissions now, so they may still only read.");
      }
    }
    return 0;
  } catch (error) {
    // Only the error's kind: AWS's message can repeat what was sent.
    const kind = error instanceof Error ? error.name : "unknown error";
    print(
      `Couldn't change the accounts (${kind}). Check your AWS profile and USER_POOL_ID, then run it again.`,
    );
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await runAccount(process.argv.slice(2), process.env, {
    print: (line) => process.stdout.write(`${line}\n`),
    directoryFor: (userPoolId) => cognitoUserDirectory(cognitoClientFor(userPoolId), userPoolId),
    newPassword: generatePassword,
  });
}
