import { SceneryUpload } from "@app/shared";
import { sceneryUploadsPath } from "@/utils/scenery.ts";
import { apiFetch } from "./sign-in.ts";

// Uploading one of an item's scenery files (production-scenery FR8): the API says where, then
// the file goes straight to file storage, never through the API (ADR 0030).

/** How an upload ended: kept, refused for a name the item already has, or not kept at all. */
export type UploadResult = "uploaded" | "taken" | "failed";

export interface UploadOptions {
  /** Whether it replaces a file of the same name, after the person said so (FR9). */
  replace: boolean;
  /** How much of the file has gone, from 0 to 1, as it goes. */
  onProgress: (fraction: number) => void;
}

export async function uploadSceneryFile(
  itemId: string,
  file: File,
  { replace, onProgress }: UploadOptions,
): Promise<UploadResult> {
  try {
    const asked = await apiFetch(sceneryUploadsPath(itemId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, ...(replace ? { replace } : {}) }),
    });
    if (asked.status === 409) return "taken";
    if (!asked.ok) return "failed";
    const { url, fields } = SceneryUpload.parse(await asked.json());
    // File storage reads the fields first, and the file last.
    const form = new FormData();
    for (const [field, value] of Object.entries(fields)) form.append(field, value);
    form.append("file", file);
    return (await sendForm(url, form, onProgress)) ? "uploaded" : "failed";
  } catch {
    return "failed";
  }
}

// XMLHttpRequest, not fetch, which can't say how much of a request has gone. Not apiFetch
// either: the sign-in token is for the API alone.
function sendForm(url: string, form: FormData, onProgress: (fraction: number) => void) {
  return new Promise<boolean>((resolve) => {
    const request = new XMLHttpRequest();
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    // After it's answered, or failed: a dropped connection leaves the status at 0.
    request.addEventListener("loadend", () =>
      resolve(request.status >= 200 && request.status < 300),
    );
    request.open("POST", url);
    request.send(form);
  });
}
