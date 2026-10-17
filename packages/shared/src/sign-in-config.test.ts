import { describe, expect, it } from "vitest";
import { SignInConfig } from "./sign-in-config.ts";

const config = {
  clientId: "made-up-client",
  issuer: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_madeup",
  loginUrl: "https://made-up.auth.eu-west-2.amazoncognito.com",
  appUrl: "https://d111111abcdef8.cloudfront.net",
};

describe("SignInConfig", () => {
  it("accepts what the deploy writes for the pages", () => {
    expect(SignInConfig.parse(config)).toEqual(config);
  });

  it("refuses addresses that aren't HTTPS, so tokens never travel in the clear", () => {
    for (const key of ["issuer", "loginUrl", "appUrl"]) {
      expect(() => SignInConfig.parse({ ...config, [key]: "http://example.com" })).toThrow();
    }
  });

  it("refuses a missing client id", () => {
    expect(() => SignInConfig.parse({ ...config, clientId: "" })).toThrow();
  });
});
