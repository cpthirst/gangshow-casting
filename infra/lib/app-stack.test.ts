import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { AppStack } from "./app-stack.ts";

describe("AppStack", () => {
  // Placeholder for the empty scaffold: the first story that adds a resource replaces this
  // with assertions on the properties that matter (ADR 0005).
  it("starts with no resources", () => {
    const template = Template.fromStack(new AppStack(new App(), "Test"));

    expect(template.toJSON().Resources ?? {}).toEqual({});
  });
});
