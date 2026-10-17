import { App } from "aws-cdk-lib";
import { alertEmailFrom } from "../lib/alert-email.ts";
import { AppStack } from "../lib/app-stack.ts";

const app = new App();
new AppStack(app, "GangshowCasting", { alertEmail: alertEmailFrom(app) });
