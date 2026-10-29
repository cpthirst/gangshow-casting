import { SceneryUpload } from "@app/shared";
import { sceneryUploadsPath } from "@/utils/scenery.ts";
import { apiFetch } from "./sign-in.ts";

// Uploading one of an item's scenery files (production-scenery FR8): the API says where, then
// the file goes straight to file storage, never through the API (ADR 0030).

/** How an upload ended: kept, refused for a name the item already has, or not kept at all. */
export type UploadResult = "uploaded" | "taken" | "failed";

export async function uploadSceneryFile(itemId: string, file: File): Promise<UploadResult> {
  try {
    const asked = await apiFetch(sceneryUploadsPath(itemId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size }),
    });
    if (asked.status === 409) return "taken";
    if (!asked.ok) return "failed";
    const { url, fields } = SceneryUpload.parse(await asked.json());
    // File storage reads the fields first, and the file last.
    const form = new FormData();
    for (const [field, value] of Object.entries(fields)) form.append(field, value);
    form.append("file", file);
    // Plain fetch, not apiFetch: the sign-in token is for the API alone.
    const sent = await fetch(url, { method: "POST", body: form });
    return sent.ok ? "uploaded" : "failed";
  } catch {
    return "failed";
  }
}
