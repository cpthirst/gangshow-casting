// Runs before every web test file (vite.config.ts). happy-dom's page is http://localhost:3000,
// which is `pnpm dev`'s API on the real table, so a request a test hasn't faked must never go out.
import { afterEach } from "vitest";

let unfaked: string[] = [];

/** Returns the requests no test faked since the last call, and forgets them. */
export function takeUnfakedRequests(): string[] {
  const taken = unfaked;
  unfaked = [];
  return taken;
}

// Refuses instead of reaching the network. A test's vi.stubGlobal fetch goes back to this.
globalThis.fetch = (input, init) => {
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  const request = `${method} ${url.pathname}${url.search}`;
  unfaked.push(request);
  return Promise.reject(new Error(`${request} wasn't faked`));
};

// The page under test usually catches the refusal, so fail the test here instead.
afterEach(() => {
  const requests = takeUnfakedRequests();
  if (requests.length > 0) {
    throw new Error(`Requests this test didn't fake:\n${requests.join("\n")}`);
  }
});
