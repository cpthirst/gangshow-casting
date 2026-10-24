import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isAccountRoute, routeKeys } from "@app/shared";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { CachePolicy, OriginRequestPolicy } from "aws-cdk-lib/aws-cloudfront";
import { afterEach, describe, expect, it } from "vitest";
import { AppStack } from "./app-stack.ts";
import { newApp, removeSynthesisedApps } from "./synth-for-test.ts";

// Made-up address: the real one is given at deploy time and never committed.
const ALERT_EMAIL = "alerts@example.com";

// Skips bundling the Lambda code, which `pnpm synth` checks for real, so each test stays fast.
const synth = () => {
  const stack = new AppStack(newApp(), "Test", { alertEmail: ALERT_EMAIL });
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
  afterEach(removeSynthesisedApps);

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

    it("removes each usage record once its expiry passes, 90 days on (ADR 0023)", () => {
      synth().template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
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

    it("gives the pages' client no secret, 5-minute tokens and a 1-day sign-in", () => {
      expect(clientNamed(synth().template, "WebClient")).toMatchObject({
        GenerateSecret: false,
        // No password sign-in through this client; only hosted sign-in (ADR 0018).
        ExplicitAuthFlows: ["ALLOW_REFRESH_TOKEN_AUTH"],
        PreventUserExistenceErrors: "ENABLED",
        // Cognito's shortest, so a role change, disable or reset bites within 5 minutes
        // (team-roles FR12, FR13); pages renew them from the day's sign-in.
        AccessTokenValidity: 5,
        IdTokenValidity: 5,
        RefreshTokenValidity: 1440,
        TokenValidityUnits: { AccessToken: "minutes", IdToken: "minutes", RefreshToken: "minutes" },
      });
    });

    it("gives the team Cognito's sign-in pages, on the pool's own prefix domain", () => {
      synth().template.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
        Domain: Match.stringLikeRegexp("^gangshow-casting-[a-z0-9]+$"),
        UserPoolId: { Ref: Match.stringLikeRegexp("^UserPool") },
        CustomDomainConfig: Match.absent(),
      });
    });

    it("signs the pages in only by the code flow, returning to the app's address", () => {
      const appAddress = {
        "Fn::Join": [
          "",
          [
            "https://",
            { "Fn::GetAtt": [expect.stringMatching(/^PagesDistribution/), "DomainName"] },
            "/",
          ],
        ],
      };

      expect(clientNamed(synth().template, "WebClient")).toMatchObject({
        AllowedOAuthFlowsUserPoolClient: true,
        AllowedOAuthFlows: ["code"],
        AllowedOAuthScopes: ["openid"],
        SupportedIdentityProviders: ["COGNITO"],
        CallbackURLs: [appAddress],
        LogoutURLs: [appAddress],
        // Signing out revokes the day's refresh token.
        EnableTokenRevocation: true,
      });
    });

    it("has an admin group", () => {
      synth().template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
        GroupName: "admin",
        UserPoolId: { Ref: Match.stringLikeRegexp("UserPool") },
      });
    });

    it("has a group for each of the other team roles (ADR 0020)", () => {
      const { template } = synth();

      for (const groupName of ["casting", "read-only"]) {
        template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
          GroupName: groupName,
          UserPoolId: { Ref: Match.stringLikeRegexp("UserPool") },
        });
      }
      template.resourceCountIs("AWS::Cognito::UserPoolGroup", 3);
    });

    it("gives the post-deploy check a client that only takes sign-ins made with AWS credentials", () => {
      const { template } = synth();

      expect(clientNamed(template, "CheckClient")).toMatchObject({
        GenerateSecret: false,
        ExplicitAuthFlows: ["ALLOW_ADMIN_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
        AllowedOAuthFlowsUserPoolClient: false,
        PreventUserExistenceErrors: "ENABLED",
        // One sign-in per run, so its tokens last no longer than the shortest Cognito allows.
        AccessTokenValidity: 5,
        IdTokenValidity: 5,
        RefreshTokenValidity: 60,
      });
      template.hasOutput("CheckClientId", {
        Value: { Ref: Match.stringLikeRegexp("CheckClient") },
      });
    });
  });

  describe("hosted API (ADR 0017)", () => {
    it("hosts exactly one route for each in the API's route list, on two Node functions", () => {
      const { template } = synth();

      // The pages' deployment brings its own function, in Python; the API's are the Node ones.
      const functions = resourcesOfType(template, "AWS::Lambda::Function");
      const apiFunctions = functions.filter((f) => f.Properties.Runtime.startsWith("nodejs"));
      expect(apiFunctions.map((f) => f.Properties)).toEqual([
        expect.objectContaining({ Runtime: "nodejs24.x", Handler: "index.handler" }),
        expect.objectContaining({ Runtime: "nodejs24.x", Handler: "index.handler" }),
      ]);
      const routes = resourcesOfType(template, "AWS::ApiGatewayV2::Route");
      const hosted = routes.map((r) => r.Properties.RouteKey).filter((key) => key !== "$default");
      expect(hosted.sort()).toEqual([...routeKeys].sort());
    });

    it("sends the account routes to the accounts function, and every other route to the API's", () => {
      const { template } = synth();

      const integrations = template.findResources("AWS::ApiGatewayV2::Integration");
      const functionOf = (routeTarget: unknown) => {
        const target = JSON.stringify(routeTarget);
        const [, integration] =
          Object.entries(integrations).find(([id]) => target.includes(id)) ?? [];
        return JSON.stringify(integration?.Properties.IntegrationUri).match(
          /(Api|Accounts)Function/,
        )?.[1];
      };
      const routes = resourcesOfType(template, "AWS::ApiGatewayV2::Route");
      for (const route of routes) {
        const expected = isAccountRoute(route.Properties.RouteKey) ? "Accounts" : "Api";
        expect([route.Properties.RouteKey, functionOf(route.Properties.Target)]).toEqual([
          route.Properties.RouteKey,
          expected,
        ]);
      }
    });

    it("lets only the accounts function manage the team's accounts, with just the actions it uses", () => {
      const { template } = synth();

      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: { Variables: { USER_POOL_ID: { Ref: Match.stringLikeRegexp("UserPool") } } },
      });
      const policies = resourcesOfType(template, "AWS::IAM::Policy");
      const grants = policies.flatMap((p) =>
        p.Properties.PolicyDocument.Statement.map((statement: { Action: unknown }) => ({
          role: JSON.stringify(p.Properties.Roles),
          statement,
        })),
      );
      const cognito = grants.filter((g) =>
        JSON.stringify(g.statement.Action).includes("cognito-idp:"),
      );
      expect(cognito.map((g) => g.role)).toEqual([expect.stringMatching(/AccountsFunction/)]);
      expect(cognito[0]?.statement).toEqual(
        expect.objectContaining({
          Action: [
            "cognito-idp:ListUsers",
            "cognito-idp:ListUsersInGroup",
            "cognito-idp:AdminGetUser",
            "cognito-idp:AdminListGroupsForUser",
            "cognito-idp:AdminCreateUser",
            "cognito-idp:AdminSetUserPassword",
            "cognito-idp:AdminEnableUser",
            "cognito-idp:AdminDisableUser",
            "cognito-idp:AdminUserGlobalSignOut",
            "cognito-idp:AdminAddUserToGroup",
            "cognito-idp:AdminRemoveUserFromGroup",
          ],
          Resource: { "Fn::GetAtt": [expect.stringMatching(/^UserPool/), "Arn"] },
        }),
      );
      // The accounts function never touches the show's data.
      const accountsGrants = grants.filter((g) => /AccountsFunction/.test(g.role));
      expect(JSON.stringify(accountsGrants)).not.toContain("dynamodb:");
    });

    it("keeps the API's data in the data table, which is all of the data store it may use", () => {
      const { template } = synth();

      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: { Variables: { DATA_TABLE: { Ref: Match.stringLikeRegexp("DataTable") } } },
      });
      const policies = resourcesOfType(template, "AWS::IAM::Policy");
      const statements = policies.flatMap((p) => p.Properties.PolicyDocument.Statement);
      const dynamo = statements.filter((s) => JSON.stringify(s.Action).includes("dynamodb:"));
      const actions = dynamo.flatMap((s) => s.Action);
      // What the stores send (apps/api/src/dynamo-*.ts); transactions need the condition check.
      expect(actions).toEqual(
        expect.arrayContaining([
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:ConditionCheckItem",
        ]),
      );
      // Items only: never creating, changing or deleting tables or their backups.
      expect(actions.filter((a) => /Table|Backup|PointInTime/.test(a))).toEqual([
        "dynamodb:DescribeTable",
      ]);
      // Each grant is on the data table itself: no wildcard, and no other table.
      for (const statement of dynamo) {
        expect(statement.Resource).toEqual({
          "Fn::GetAtt": [expect.stringMatching(/^DataTable/), "Arn"],
        });
      }
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
      expect(routes.map((r) => r.Properties.RouteKey).sort()).toEqual(
        ["$default", ...routeKeys].sort(),
      );
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

    it("keeps every log for 30 days: the API's, its functions' and the pages' deployment's", () => {
      const { template } = synth();

      const logGroups = resourcesOfType(template, "AWS::Logs::LogGroup");
      expect(logGroups).toHaveLength(4);
      for (const group of logGroups) expect(group.Properties.RetentionInDays).toBe(30);
      template.hasResourceProperties("AWS::Lambda::Function", {
        LoggingConfig: { LogGroup: { Ref: Match.stringLikeRegexp("ApiFunctionLogs") } },
      });
      template.hasResourceProperties("AWS::Lambda::Function", {
        LoggingConfig: { LogGroup: { Ref: Match.stringLikeRegexp("AccountsFunctionLogs") } },
      });
      template.hasResourceProperties("AWS::Lambda::Function", {
        LoggingConfig: { LogGroup: { Ref: Match.stringLikeRegexp("PagesDeploymentLogs") } },
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

  describe("hosted pages, at one address with the API (ADR 0017)", () => {
    it("serves the pages from the pages bucket and /api/* from the hosted API, over HTTPS", () => {
      const { template } = synth();

      const config = distributionConfig(template);
      expect(originOf(config, config.DefaultCacheBehavior)).toMatchObject({
        DomainName: { "Fn::GetAtt": [expect.stringMatching(/^PagesBucket/), "RegionalDomainName"] },
        OriginAccessControlId: { "Fn::GetAtt": [expect.any(String), "Id"] },
      });
      const api = originOf(config, behaviourFor(config, "/api/*"));
      expect(JSON.stringify(api?.DomainName)).toMatch(/"Ref":"Api\w+".*execute-api/);
      // The routes already start with /api, so the path reaches the API as it is.
      expect(api?.OriginPath).toBeUndefined();
      expect(api?.CustomOriginConfig).toMatchObject({ OriginProtocolPolicy: "https-only" });
      template.hasOutput("AppUrl", {
        Value: {
          "Fn::Join": ["", ["https://", Match.objectLike({ "Fn::GetAtt": Match.anyValue() }), "/"]],
        },
      });
    });

    it("redirects the pages from plain HTTP to HTTPS, and never answers the API over HTTP", () => {
      const config = distributionConfig(synth().template);

      expect(config.DefaultCacheBehavior.ViewerProtocolPolicy).toBe("redirect-to-https");
      expect(behaviourFor(config, "/api/*").ViewerProtocolPolicy).toBe("https-only");
    });

    describe("a page deep in the app", () => {
      const rewrite = () => {
        const { template } = synth();
        const [fn] = resourcesOfType(template, "AWS::CloudFront::Function");
        const code: string = fn?.Properties.FunctionCode;
        const handler = new Function(`${code}; return handler;`)();
        return (uri: string) => handler({ request: { uri } }).uri;
      };

      it("loads the app for a page's own address, such as /cast or /cast/123", () => {
        const toApp = rewrite();

        for (const uri of ["/", "/cast", "/cast/123", "/casting/items/abc-1"]) {
          expect(toApp(uri)).toBe("/index.html");
        }
      });

      it("leaves the address of a file alone, so a missing one is still not found", () => {
        const toApp = rewrite();

        expect(toApp("/assets/missing.js")).toBe("/assets/missing.js");
        expect(toApp("/assets/index-C93hsal6.css")).toBe("/assets/index-C93hsal6.css");
      });

      it("rewrites only the pages' requests, never the API's", () => {
        const config = distributionConfig(synth().template);

        expect(config.DefaultCacheBehavior.FunctionAssociations).toEqual([
          { EventType: "viewer-request", FunctionARN: expect.anything() },
        ]);
        expect(behaviourFor(config, "/api/*").FunctionAssociations).toBeUndefined();
        expect(behaviourFor(config, "/assets/*").FunctionAssociations).toBeUndefined();
      });

      // Without leave to list the bucket, S3 answers 403 for a missing file, not 404.
      it("lets the distribution tell a missing file from a forbidden one", () => {
        const actions = pagesBucketStatements(synth().template).flatMap((s) => s.Action);

        expect(actions).toEqual(expect.arrayContaining(["s3:GetObject", "s3:ListBucket"]));
      });
    });

    // A distribution-wide error page would turn the API's 401, 403 and 404 into the app's page.
    it("passes the API's error statuses and bodies through unchanged", () => {
      expect(distributionConfig(synth().template).CustomErrorResponses).toBeUndefined();
    });

    it("never caches the API's requests at the edge, and passes the sign-in header on", () => {
      const api = behaviourFor(distributionConfig(synth().template), "/api/*");

      expect(api).toMatchObject({
        CachePolicyId: CachePolicy.CACHING_DISABLED.cachePolicyId,
        // Every header but Host, so Authorization reaches API Gateway's sign-in check.
        OriginRequestPolicyId:
          OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER.originRequestPolicyId,
        AllowedMethods: expect.arrayContaining(["GET", "POST", "PUT", "DELETE"]),
      });
    });

    // The sign-in check's 401s come from API Gateway and never pass through the API's code.
    it("tells browsers not to keep any API response, even the sign-in check's refusals", () => {
      const { template } = synth();

      const headers = responseHeadersFor(template, "/api/*");
      expect(headers.CustomHeadersConfig.Items).toContainEqual({
        Header: "Cache-Control",
        Value: "no-store",
        Override: true,
      });
    });

    it("keeps the pages' files private, readable only through the app's address", () => {
      const { template } = synth();

      template.hasResourceProperties("AWS::S3::Bucket", {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
      const allowed = pagesBucketStatements(template).filter((s) => s.Effect === "Allow");
      // The deployment's own role writes the files; it gets its grant on the role, not here.
      expect(allowed.length).toBeGreaterThan(0);
      for (const statement of allowed) {
        expect(statement.Principal).toEqual({ Service: "cloudfront.amazonaws.com" });
        // Only this distribution, not every CloudFront distribution in AWS.
        expect(Object.keys(statement.Condition.StringEquals)).toEqual(["AWS:SourceArn"]);
        expect(JSON.stringify(statement.Condition)).toMatch(/PagesDistribution/);
      }
    });

    it("forbids framing the pages, limits where scripts load from, and keeps browsers on HTTPS", () => {
      const { template } = synth();

      for (const path of [undefined, "/assets/*"]) {
        const security = responseHeadersFor(template, path).SecurityHeadersConfig;
        expect(security).toMatchObject({
          FrameOptions: { FrameOption: "DENY", Override: true },
          StrictTransportSecurity: {
            AccessControlMaxAgeSec: 63072000,
            IncludeSubdomains: true,
            Override: true,
          },
          ContentTypeOptions: { Override: true },
        });
        // As CloudFormation has it: the login domain is only known at deploy time.
        const policy = JSON.stringify(security.ContentSecurityPolicy.ContentSecurityPolicy);
        for (const directive of [
          "script-src 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
        ]) {
          expect(policy).toMatch(new RegExp(`${directive}(;|")`));
        }
      }
    });

    it("lets the pages ask the team's login domain for sign-in tokens, and nowhere else", () => {
      const security = responseHeadersFor(synth().template, undefined).SecurityHeadersConfig;

      expect(JSON.stringify(security.ContentSecurityPolicy.ContentSecurityPolicy)).toMatch(
        /connect-src 'self' https:\/\/",\{"Ref":"UserPoolLoginDomain\w+"\},"\.auth\.eu-west-2\.amazoncognito\.com;/,
      );
    });

    it("tells the pages where to sign in, in a config file written at deploy", () => {
      const { stack, template } = synth();
      const [deployment] = resourcesOfType(template, "Custom::CDKBucketDeployment");
      // The values are only known at deploy, so the file holds markers the deploy fills in.
      const markers: Record<string, unknown> = Object.assign(
        {},
        ...(deployment?.Properties.SourceMarkers ?? []),
      );
      const config = Object.fromEntries(
        Object.entries(deployedConfig(stack)).map(([key, marker]) => [
          key,
          JSON.stringify(markers[String(marker)]),
        ]),
      );

      expect(Object.keys(config).sort()).toEqual(["appUrl", "clientId", "issuer", "loginUrl"]);
      expect(config.clientId).toMatch(/"Ref":"UserPoolWebClient/);
      expect(config.issuer).toMatch(/"Fn::GetAtt":\["UserPool\w+","ProviderURL"/);
      expect(config.loginUrl).toMatch(/"Ref":"UserPoolLoginDomain/);
      expect(config.appUrl).toMatch(
        /"Fn::GetAtt":\["PagesDistribution\w+","DomainName"\]\},"\/\\""/,
      );
    });

    it("serves the config file fresh on every load, so a new deploy's sign-in is picked up", () => {
      const config = distributionConfig(synth().template);

      // It has no behaviour of its own, so it's served by the pages' default: never cached.
      const patterns = config.CacheBehaviors.map((b: Behaviour) => b.PathPattern);
      expect(patterns).toEqual(["/assets/*", "/api/*"]);
      expect(config.DefaultCacheBehavior.CachePolicyId).toBe(
        CachePolicy.CACHING_DISABLED.cachePolicyId,
      );
    });

    describe("a new release", () => {
      it("is picked up on the next load, as the app's page is never cached", () => {
        const { template } = synth();

        const config = distributionConfig(template);
        expect(config.DefaultCacheBehavior.CachePolicyId).toBe(
          CachePolicy.CACHING_DISABLED.cachePolicyId,
        );
        expect(responseHeadersFor(template, undefined).CustomHeadersConfig.Items).toContainEqual({
          Header: "Cache-Control",
          Value: "no-cache",
          Override: true,
        });
      });

      // Vite names each built file after its content, so a new release has new names.
      it("keeps the built files cached for a year, as their names change with their content", () => {
        const { template } = synth();

        expect(behaviourFor(distributionConfig(template), "/assets/*").CachePolicyId).toBe(
          CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
        );
        expect(responseHeadersFor(template, "/assets/*").CustomHeadersConfig.Items).toContainEqual({
          Header: "Cache-Control",
          Value: "public, max-age=31536000, immutable",
          Override: true,
        });
      });

      it("deploys the web app's build into the pages bucket, keeping the last release's files", () => {
        synth().template.hasResourceProperties("Custom::CDKBucketDeployment", {
          DestinationBucketName: { Ref: Match.stringLikeRegexp("^PagesBucket") },
          // An open tab may still ask for the release it loaded.
          Prune: false,
        });
      });
    });
  });
});

// The distribution's config, and the parts of it the pages' tests look at.
type Behaviour = {
  PathPattern?: string;
  TargetOriginId: string;
  ViewerProtocolPolicy: string;
  CachePolicyId: string;
  ResponseHeadersPolicyId?: { Ref: string };
  FunctionAssociations?: unknown[];
};

const distributionConfig = (template: Template) => {
  const [distribution] = resourcesOfType(template, "AWS::CloudFront::Distribution");
  return distribution?.Properties.DistributionConfig;
};

const behaviourFor = (config: { CacheBehaviors: Behaviour[] }, path: string) => {
  const behaviour = config.CacheBehaviors.find((b) => b.PathPattern === path);
  if (!behaviour) throw new Error(`No behaviour for ${path}`);
  return behaviour;
};

type Origin = { Id: string; [property: string]: unknown };

const originOf = (config: { Origins: Origin[] }, behaviour: Behaviour) =>
  config.Origins.find((o) => o.Id === behaviour.TargetOriginId);

/** The response headers policy on a path's behaviour; no path means the pages' default. */
const responseHeadersFor = (template: Template, path: string | undefined) => {
  const config = distributionConfig(template);
  const behaviour = path ? behaviourFor(config, path) : config.DefaultCacheBehavior;
  const policies = template.findResources("AWS::CloudFront::ResponseHeadersPolicy");
  const policy = policies[behaviour.ResponseHeadersPolicyId?.Ref ?? ""];
  if (!policy) throw new Error(`No response headers policy for ${path ?? "the pages"}`);
  return policy.Properties.ResponseHeadersPolicyConfig;
};

type Statement = {
  Effect: string;
  Action: string | string[];
  Principal: unknown;
  Condition: { StringEquals: Record<string, unknown> };
};

/** The config.json the deploy puts next to the pages, as synthesised (markers for values). */
function deployedConfig(stack: AppStack): Record<string, unknown> {
  const assembly = App.of(stack)?.synth();
  if (!assembly) throw new Error("No app to synthesise");
  const assetDirs = readdirSync(assembly.directory).filter((name) => name.startsWith("asset."));
  for (const dir of assetDirs) {
    const file = join(assembly.directory, dir, "config.json");
    // A marker stands in for a whole JSON value, quotes and all.
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, "utf8").replaceAll(/<<marker:[^>]+>>/g, '"$&"'));
    }
  }
  throw new Error("No config.json in the deployment");
}

const pagesBucketStatements = (template: Template): Statement[] => {
  const [policy] = resourcesOfType(template, "AWS::S3::BucketPolicy");
  return policy?.Properties.PolicyDocument.Statement ?? [];
};
