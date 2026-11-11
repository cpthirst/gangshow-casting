import { readFileSync } from "node:fs";
import { Template } from "aws-cdk-lib/assertions";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppStack } from "./app-stack.ts";
import { appAsset, cssColour } from "./login-branding.ts";
import { newApp, removeSynthesisedApps } from "./synth-for-test.ts";

describe("cssColour", () => {
  const css = ":root {\n  --red: #ED3F23; /* accents */\n  --text: #404040;\n}";

  it("reads a colour from the stylesheet in Cognito's spelling: lower case, no #, fully opaque", () => {
    expect(cssColour(css, "--red")).toBe("ed3f23ff");
    expect(cssColour(css, "--text")).toBe("404040ff");
  });

  it("refuses a colour the stylesheet doesn't have, so a renamed one can't go unnoticed", () => {
    expect(() => cssColour(css, "--blue")).toThrow("--blue");
  });
});

describe("the sign-in pages' look", () => {
  // One synth for the file, as each takes seconds.
  let template: Template;
  let branding: ReturnType<Template["findResources"]>[string] | undefined;
  beforeAll(() => {
    template = Template.fromStack(
      new AppStack(newApp(), "Test", { alertEmail: "alerts@example.com" }),
    );
    [branding] = Object.values(template.findResources("AWS::Cognito::ManagedLoginBranding"));
  });
  afterAll(removeSynthesisedApps);
  const settings = () => branding?.Properties.Settings;

  it("uses the newer managed login on the Essentials plan", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolDomain", { ManagedLoginVersion: 2 });
    template.hasResourceProperties("AWS::Cognito::UserPool", { UserPoolTier: "ESSENTIALS" });
  });

  it("is set up only once the domain serves the newer pages, which Cognito requires", () => {
    expect(branding?.DependsOn).toContainEqual(expect.stringMatching(/^UserPoolLoginDomain/));
  });

  it("is the pages' client's own, and only theirs, set here rather than in the console", () => {
    template.resourceCountIs("AWS::Cognito::ManagedLoginBranding", 1);
    expect(branding?.Properties).toMatchObject({
      UserPoolId: { Ref: expect.stringMatching(/^UserPool/) },
      ClientId: { Ref: expect.stringMatching(/^UserPoolWebClient/) },
      UseCognitoProvidedValues: false,
    });
  });

  it("shows the show's logo at the top of the form", () => {
    const logo = readFileSync(appAsset("logo-small.jpg")).toString("base64");

    expect(branding?.Properties.Assets).toEqual([
      { Category: "FORM_LOGO", ColorMode: "LIGHT", Extension: "JPEG", Bytes: logo },
    ]);
    expect(settings().components.form.logo).toMatchObject({
      enabled: true,
      formInclusion: "IN",
      position: "TOP",
    });
  });

  it("has the app's red buttons on its grey background, in its text colour", () => {
    const css = readFileSync(appAsset("styles.css"), "utf8");
    const app = (name: string) => cssColour(css, name);
    const { components } = settings();

    expect(components.primaryButton.lightMode.defaults).toEqual({
      backgroundColor: app("--red-deep"),
      textColor: app("--white"),
    });
    expect(components.pageBackground).toEqual({
      image: { enabled: false },
      lightMode: { color: app("--surface") },
    });
    expect(components.pageText.lightMode.bodyColor).toBe(app("--text"));
  });

  it("stays light when the phone is in dark mode, as the app does", () => {
    expect(settings().categories.global.colorSchemeMode).toBe("LIGHT");
  });
});
