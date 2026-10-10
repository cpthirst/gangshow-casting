import { App } from "aws-cdk-lib";
import { AppStack } from "../lib/app-stack.ts";

new AppStack(new App(), "DevProjectTemplate");
