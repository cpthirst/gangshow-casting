import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe } from "vitest";
import { fileRoleStore, inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { fileCastStore, inMemoryCastStore } from "./cast-store.ts";
import { behavesAsCastRemoval } from "./remove-cast-member.contract.ts";
import { uncastThenRemove } from "./remove-cast-member.ts";

describe("removing a cast member from in-memory stores", () => {
  behavesAsCastRemoval(async (castList, roleList) => {
    const cast = inMemoryCastStore([castList]);
    const roles = inMemoryRoleStore([roleList]);
    return { cast, roles, remove: uncastThenRemove(cast, roles) };
  });
});

describe("removing a cast member from the files", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "remove-cast-"));
  });
  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  behavesAsCastRemoval(async (castList, roleList) => {
    await mkdir(join(dataDir, "2027"), { recursive: true });
    await writeFile(join(dataDir, "2027", "cast.json"), JSON.stringify(castList));
    await writeFile(join(dataDir, "2027", "roles.json"), JSON.stringify(roleList));
    const cast = fileCastStore(dataDir);
    const roles = fileRoleStore(dataDir);
    return { cast, roles, remove: uncastThenRemove(cast, roles) };
  });
});
