import { rmSync } from "node:fs";
import { App } from "aws-cdk-lib";

const apps: App[] = [];

// Each app stages its assets (a 65 MB layer zip) in a temp folder CDK never cleans up.
export const newApp = () => {
  const app = new App({ context: { "aws:cdk:bundling-stacks": [] } });
  apps.push(app);
  return app;
};

export const removeSynthesisedApps = () => {
  for (const app of apps.splice(0)) rmSync(app.outdir, { recursive: true, force: true });
};
