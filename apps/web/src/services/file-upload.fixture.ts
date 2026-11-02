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
