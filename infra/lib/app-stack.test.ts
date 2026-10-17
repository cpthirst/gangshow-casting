import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { AppStack } from "./app-stack.ts";

// Made-up address: the real one is given at deploy time and never committed.
const ALERT_EMAIL = "alerts@example.com";

// Skips bundling the Lambda code, which `pnpm synth` checks for real, so each test stays fast.
const synth = () => {
  const app = new App({ context: { "aws:cdk:bundling-stacks": [] } });
  const stack = new AppStack(app, "Test", { alertEmail: ALERT_EMAIL });
  return { stack, template: Template.fromStack(stack) };
};

const resourcesOfType = (template: Template, type: string) =>
  Object.values(template.findResources(type));

/** One user pool client's properties, found by its construct id, so a test can't match the other. */
const clientNamed = (template: Template, id: string) => {
  const clients = Object.entries(template.findResources("AWS::Cognito::UserPoolClient"));
  return clients.find(([logicalId]) => logicalId.includes(id))?.[1].Properties;
};

describe("AppStack", () => {
  it("lives in London, keeping the cast's data in the UK", () => {
    expect(synth().stack.region).toBe("eu-west-2");
  });

  describe("production data table (ADR 0015)", () => {
    it("is one pay-per-request table keyed by partition and sort key", () => {
      const { template } = synth();

      template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        BillingMode: "PAY_PER_REQUEST",
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
      });
    });

    it("is encrypted at rest and keeps 7 days of point-in-time recovery", () => {
      synth().template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        // DynamoDB always encrypts at rest; with no override it uses a free AWS-owned key.
        SSESpecification: Match.absent(),
        Replicas: [
          Match.objectLike({
            PointInTimeRecoverySpecification: {
              PointInTimeRecoveryEnabled: true,
              RecoveryPeriodInDays: 7,
            },
          }),
        ],
      });
    });

    it("survives the stack being deleted, and can't be deleted by accident", () => {
      const { template } = synth();

      template.hasResource("AWS::DynamoDB::GlobalTable", {
        DeletionPolicy: "Retain",
        UpdateReplacePolicy: "Retain",
      });
      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        Replicas: [Match.objectLike({ DeletionProtectionEnabled: true })],
      });
    });

    it("outputs the table's name, for the API's configuration", () => {
      synth().template.hasOutput("DataTableName", {});
    });
  });

  describe("budget alert (remote-data FR13)", () => {
    it("is a monthly cost budget of about £5", () => {
      synth().template.hasResourceProperties("AWS::Budgets::Budget", {
        Budget: {
          BudgetType: "COST",
          TimeUnit: "MONTHLY",
          BudgetLimit: { Amount: 7, Unit: "USD" },
        },
      });
    });

    // A forecast needs weeks of history, so a new account is also warned on actual spend.
    it("emails the given address when the month's spend is forecast to pass it, or does", () => {
      const alertWhen = (type: string) => ({
        Notification: {
          NotificationType: type,
          ComparisonOperator: "GREATER_THAN",
          Threshold: 100,
          ThresholdType: "PERCENTAGE",
        },
        Subscribers: [{ SubscriptionType: "EMAIL", Address: ALERT_EMAIL }],
      });

      synth().template.hasResourceProperties("AWS::Budgets::Budget", {
        NotificationsWithSubscribers: [alertWhen("FORECASTED"), alertWhen("ACTUAL")],
      });
    });
  });

  describe("team user pool (ADR 0018)", () => {
    it("signs people in by username, ignoring case", () => {
      synth().template.hasResourceProperties("AWS::Cognito::UserPool", {
        UsernameConfiguration: { CaseSensitive: false },
        UsernameAttributes: Match.absent(),
        AliasAttributes: Match.absent(),
      });
    });

    it("doesn't let anyone create their own account", () => {
      synth().template.hasResourceProperties("AWS::Cognito::UserPool", {
        AdminCreateUserConfig: Match.objectLike({ AllowAdminCreateUserOnly: true }),
      });
    });

    it("holds no email or phone, and offers no account recovery by message", () => {
      const { template } = synth();

      const [pool] = resourcesOfType(template, "AWS::Cognito::UserPool");
      const attributes = JSON.stringify(pool?.Properties?.Schema ?? []);
      expect(attributes).not.toMatch(/email|phone/);
      template.hasResourceProperties("AWS::Cognito::UserPool", {
        AutoVerifiedAttributes: Match.absent(),
        AccountRecoverySetting: { RecoveryMechanisms: [{ Name: "admin_only", Priority: 1 }] },
      });
    });

    it("survives the stack being deleted, and can't be deleted by accident", () => {
      const { template } = synth();

      template.hasResource("AWS::Cognito::UserPool", {
        DeletionPolicy: "Retain",
        UpdateReplacePolicy: "Retain",
      });
      template.hasResourceProperties("AWS::Cognito::UserPool", { DeletionProtection: "ACTIVE" });
    });

    it("gives the pages' client no secret, 1-hour tokens and a 1-day sign-in", () => {
      expect(clientNamed(synth().template, "WebClient")).toMatchObject({
        GenerateSecret: false,
        // No password sign-in through this client; only hosted sign-in (ADR 0018).
        ExplicitAuthFlows: ["ALLOW_REFRESH_TOKEN_AUTH"],
        PreventUserExistenceErrors: "ENABLED",
        AccessTokenValidity: 60,
        IdTokenValidity: 60,
        RefreshTokenValidity: 1440,
        TokenValidityUnits: { AccessToken: "minutes", IdToken: "minutes", RefreshToken: "minutes" },
      });
    });

    it("has an admin group", () => {
      synth().template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
        GroupName: "admin",
        UserPoolId: { Ref: Match.stringLikeRegexp("UserPool") },
      });
    });

    it("gives the post-deploy check a client that only takes sign-ins made with AWS credentials", () => {
      const { template } = synth();

      expect(clientNamed(template, "CheckClient")).toMatchObject({
        GenerateSecret: false,
        ExplicitAuthFlows: ["ALLOW_ADMIN_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
        AllowedOAuthFlowsUserPoolClient: false,
        PreventUserExistenceErrors: "ENABLED",
        // One sign-in per run, so its tokens last no longer than the shortest Cognito allows.
        AccessTokenValidity: 60,
        IdTokenValidity: 60,
        RefreshTokenValidity: 60,
      });
      template.hasOutput("CheckClientId", {
        Value: { Ref: Match.stringLikeRegexp("CheckClient") },
      });
    });
  });

  describe("hosted API (ADR 0017)", () => {
    it("serves GET /api/health from a function running the API's entry point", () => {
      const { template } = synth();

      template.resourceCountIs("AWS::Lambda::Function", 1);
      template.hasResourceProperties("AWS::Lambda::Function", {
        Runtime: "nodejs24.x",
        Handler: "index.handler",
      });
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey: "GET /api/health",
        Target: Match.anyValue(),
      });
    });

    it("requires a sign-in token from the team's user pool on every route", () => {
      const { template } = synth();

      template.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
        AuthorizerType: "JWT",
        IdentitySource: ["$request.header.Authorization"],
        JwtConfiguration: {
          Audience: [
            { Ref: Match.stringLikeRegexp("WebClient") },
            { Ref: Match.stringLikeRegexp("CheckClient") },
          ],
          Issuer: Match.objectLike({
            "Fn::Join": ["", Match.arrayWith([{ Ref: Match.stringLikeRegexp("UserPool") }])],
          }),
        },
      });
      const routes = resourcesOfType(template, "AWS::ApiGatewayV2::Route");
      expect(routes.map((r) => r.Properties.RouteKey).sort()).toEqual([
        "$default",
        "GET /api/health",
      ]);
      for (const route of routes) {
        expect(route.Properties).toMatchObject({
          AuthorizationType: "JWT",
          AuthorizerId: { Ref: expect.stringMatching(/TeamSignIn/) },
        });
      }
    });

    it("limits requests to 20 a second, with bursts of up to 40", () => {
      synth().template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
        StageName: "$default",
        DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
      });
    });

    it("keeps the API's and the function's logs for 30 days", () => {
      const { template } = synth();

      const logGroups = resourcesOfType(template, "AWS::Logs::LogGroup");
      expect(logGroups).toHaveLength(2);
      for (const group of logGroups) expect(group.Properties.RetentionInDays).toBe(30);
      template.hasResourceProperties("AWS::Lambda::Function", {
        LoggingConfig: { LogGroup: { Ref: Match.stringLikeRegexp("ApiFunctionLogs") } },
      });
    });

    it("logs who asked for what and the status, never request or response bodies", () => {
      const [stage] = resourcesOfType(synth().template, "AWS::ApiGatewayV2::Stage");
      const format = JSON.parse(stage?.Properties.AccessLogSettings.Format ?? "{}");

      expect(Object.keys(format)).toEqual(
        expect.arrayContaining(["requestId", "routeKey", "status"]),
      );
      expect(JSON.stringify(format)).not.toMatch(/body/i);
    });
  });
});
