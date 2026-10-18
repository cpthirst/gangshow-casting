import { rmSync } from "node:fs";
import { App } from "aws-cdk-lib";

// Kept so `removeSynthesisedApps` can run later, from an `afterEach`.
const apps: App[] = [];

export const newApp = (context: Record<string, unknown> = {}) => {
  const app = new App({ context: { "aws:cdk:bundling-stacks": [], ...context } });
  apps.push(app);
  return app;
};

// Each app stages its assets (a 65 MB layer zip) in a temp folder CDK never cleans up.
export const removeSynthesisedApps = () => {
  for (const app of apps.splice(0)) rmSync(app.outdir, { recursive: true, force: true });
};
