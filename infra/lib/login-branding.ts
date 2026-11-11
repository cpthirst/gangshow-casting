import { readFileSync } from "node:fs";
import {
  CfnManagedLoginBranding,
  type IUserPool,
  type IUserPoolClient,
  type UserPoolDomain,
} from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

export const appAsset = (file: string) =>
  new URL(`../../apps/web/src/assets/${file}`, import.meta.url);

/** A colour from the app's stylesheet, as Cognito spells it: `rrggbbaa`, without the `#`. */
export function cssColour(css: string, name: string): string {
  const hex = new RegExp(`${name}:\\s*#([0-9a-fA-F]{6});`).exec(css)?.[1];
  if (!hex) throw new Error(`No colour ${name} in the app's stylesheet`);
  return `${hex.toLowerCase()}ff`;
}

/**
 * Cognito's sign-in pages in the app's look (hosting.E3.S4): its logo, and the colours of its
 * stylesheet, so they're chosen once. Light only, as the app has no dark mode. Settings left
 * out keep Cognito's defaults.
 */
export function addLoginBranding(
  scope: Construct,
  {
    userPool,
    client,
    domain,
  }: { userPool: IUserPool; client: IUserPoolClient; domain: UserPoolDomain },
) {
  const css = readFileSync(appAsset("styles.css"), "utf8");
  const app = (name: string) => cssColour(css, name);
  // White text is 4.53:1 on --red-deep, and over 9:1 on --red-darker.
  const button = (background: string) => ({
    backgroundColor: app(background),
    textColor: app("--white"),
  });

  const branding = new CfnManagedLoginBranding(scope, "LoginBranding", {
    userPoolId: userPool.userPoolId,
    clientId: client.userPoolClientId,
    useCognitoProvidedValues: false,
    assets: [
      {
        category: "FORM_LOGO",
        colorMode: "LIGHT",
        extension: "JPEG",
        bytes: readFileSync(appAsset("logo-small.jpg")).toString("base64"),
      },
    ],
    settings: {
      categories: { global: { colorSchemeMode: "LIGHT" } },
      componentClasses: {
        focusState: { lightMode: { borderColor: app("--red-deep") } },
        link: {
          lightMode: {
            defaults: { textColor: app("--red-darker") },
            hover: { textColor: app("--red-deep") },
          },
        },
      },
      components: {
        form: { logo: { enabled: true, formInclusion: "IN", location: "CENTER", position: "TOP" } },
        pageBackground: { image: { enabled: false }, lightMode: { color: app("--surface") } },
        pageText: {
          lightMode: {
            bodyColor: app("--text"),
            descriptionColor: app("--text"),
            headingColor: app("--text"),
          },
        },
        primaryButton: {
          lightMode: {
            defaults: button("--red-deep"),
            hover: button("--red-darker"),
            active: button("--red-darker"),
          },
        },
      },
    },
  });
  // Cognito refuses branding until the domain serves the newer pages.
  branding.node.addDependency(domain);
}
