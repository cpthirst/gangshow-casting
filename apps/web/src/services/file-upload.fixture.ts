import { flushPromises, type VueWrapper } from "@vue/test-utils";

// Stand-ins for the browser's uploads, for tests of the pages that upload files.

/** The browser's XMLHttpRequest, which uploads use for their progress. happy-dom's can't
 *  reach the stand-in file storage, so this one hands each request to the stand-in fetch, and
 *  a test can report how much of the latest one has gone. */
export class StandInXhr extends EventTarget {
  static latest: StandInXhr | undefined;
  readonly upload = new EventTarget();
  status = 0;
  private method = "";
  private url = "";
  private headers: Record<string, string> | undefined;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers = { ...this.headers, [name]: value };
  }

  send(body: FormData) {
    StandInXhr.latest = this;
    const init = { method: this.method, body, ...(this.headers ? { headers: this.headers } : {}) };
    fetch(this.url, init)
      .then((res) => {
        this.status = res.status;
      })
      .catch(() => {
        this.status = 0;
      })
      .finally(() => this.dispatchEvent(new Event("loadend")));
  }

  /** As the browser reports how much of the request's body has gone. */
  sent(loaded: number, total: number) {
    this.upload.dispatchEvent(
      new ProgressEvent("progress", { lengthComputable: true, loaded, total }),
    );
  }
}

/** A made-up file, of the size given, as the browser's file picker hands it over. */
export function aFile(name: string, size = 1_000) {
  const file = new File(["made-up"], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** As the file picker does once someone chooses one file or more in the page's upload area. */
export async function chooseFiles(wrapper: VueWrapper, ...files: File[]) {
  const input = wrapper.get("[data-test=upload-input]");
  Object.defineProperty(input.element, "files", { value: files, configurable: true });
  await input.trigger("change");
  await flushPromises();
}

/** A drag onto the upload area, as the browser sends it: from the computer's files unless
 *  other types are given, such as text selected on the page. */
export async function drag(
  wrapper: VueWrapper,
  type: string,
  {
    files = [],
    types = ["Files"],
    from,
  }: { files?: File[]; types?: string[]; from?: Element } = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files, types } });
  Object.defineProperty(event, "relatedTarget", { value: from ?? null });
  wrapper.get("[data-test=upload-area]").element.dispatchEvent(event);
  await flushPromises();
  return event;
}

/** Drops the files on the upload area, as from the computer's file manager. */
export const dropOnto = (wrapper: VueWrapper, ...files: File[]) => drag(wrapper, "drop", { files });
