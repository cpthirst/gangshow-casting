import { fileURLToPath } from "node:url";
import { ADMIN_GROUP, isAccountRoute, routeKeys } from "@app/shared";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AccessLogFormat } from "aws-cdk-lib/aws-apigateway";
import {
  HttpApi,
  HttpMethod,
  HttpStage,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { CfnBudget } from "aws-cdk-lib/aws-budgets";
import {
  AccountRecovery,
  CfnUserPoolClient,
  OAuthScope,
  UserPool,
  UserPoolClientIdentityProvider,
} from "aws-cdk-lib/aws-cognito";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { Pages } from "./pages.ts";

const entryPoint = (file: string) =>
  fileURLToPath(new URL(`../../apps/api/src/${file}`, import.meta.url));

// The methods the API's route list uses.
const HTTP_METHODS: Record<string, HttpMethod> = {
  GET: HttpMethod.GET,
  POST: HttpMethod.POST,
  PUT: HttpMethod.PUT,
  DELETE: HttpMethod.DELETE,
};

export interface AppStackProps extends StackProps {
  /** Where the budget alert goes: given at deploy time, never committed. */
  alertEmail: string;
}

// Changes here go through infra-reviewer (see CLAUDE.md → Review loop).
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    // London, so the cast's data stays in the UK (remote-data PRD).
    super(scope, id, { ...props, env: { ...props.env, region: "eu-west-2" } });

    // All production data in one table, one item per entity (ADR 0015). The key names
    // match apps/api/src/dynamo-table.ts. Don't rename "DataTable" or change the construct:
    // either replaces the table, orphaning the retained one with all the data.
    const table = new TableV2(this, "DataTable", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      // 7 days, so data deleted in the app is gone from every copy within a week (ADR 0010).
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
        recoveryPeriodInDays: 7,
      },
      // The only copy of the show's data: deleting it must be a separate, deliberate step.
      removalPolicy: RemovalPolicy.RETAIN,
      deletionProtection: true,
    });

    new CfnOutput(this, "DataTableName", {
      value: table.tableName,
      description: "Set DATA_TABLE to this to keep the API's data here",
    });

    // An email if the month's AWS spend is forecast to pass about £5, or does (remote-data
    // FR13). A forecast needs weeks of history, so a new account relies on the actual one.
    // Budgets are in US dollars: $7 is the nearest whole amount.
    new CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: 7, unit: "USD" },
      },
      notificationsWithSubscribers: ["FORECASTED", "ACTUAL"].map((notificationType) => ({
        notification: {
          notificationType,
          comparisonOperator: "GREATER_THAN",
          threshold: 100,
          thresholdType: "PERCENTAGE",
        },
        subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail }],
      })),
    });

    // The team's accounts (ADR 0018): usernames chosen by an admin, no email or phone, so
    // forgotten passwords are reset by an admin. Don't rename "UserPool": that replaces the
    // pool, and every account and password with it.
    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true },
      signInCaseSensitive: false,
      selfSignUpEnabled: false,
      accountRecovery: AccountRecovery.NONE,
      removalPolicy: RemovalPolicy.RETAIN,
      deletionProtection: true,
    });
    // Cognito's own sign-in pages, at <prefix>.auth.eu-west-2.amazoncognito.com. The prefix
    // must be unique in the region, and comes from this stack's construct path: renaming the
    // stack or "UserPool" changes it, replacing the domain.
    const loginDomain = userPool.addDomain("LoginDomain", {
      cognitoDomain: { domainPrefix: `gangshow-casting-${this.node.addr.slice(0, 8)}` },
    });
    // The pages' sign-in client: Cognito's sign-in pages by the code flow, which the pages
    // run with PKCE as a public client (ADR 0018). Its return addresses are set once the
    // pages' address exists, below.
    const webClient = userPool.addClient("WebClient", {
      generateSecret: false,
      preventUserExistenceErrors: true,
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
      oAuth: { flows: { authorizationCodeGrant: true }, scopes: [OAuthScope.OPENID] },
      // Signing out revokes the day's refresh token (Cognito's default, made explicit).
      enableTokenRevocation: true,
      // Any key here makes CDK list only refresh tokens: no password sign-in on this client.
      authFlows: { userSrp: false },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      // The PRD's 1-day sign-in.
      refreshTokenValidity: Duration.days(1),
    });
    // The post-deploy check's sign-in (hosting FR17). Admin-initiated password sign-in needs
    // the maintainer's AWS credentials, so this client is no way in for anyone else.
    const checkClient = userPool.addClient("CheckClient", {
      generateSecret: false,
      preventUserExistenceErrors: true,
      disableOAuth: true,
      authFlows: { adminUserPassword: true },
      // One sign-in per run: the shortest lifetimes Cognito allows, as a check account is an admin.
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.hours(1),
    });
    // Admins manage accounts, delete cast members and save running orders (ADR 0018).
    userPool.addGroup("AdminGroup", { groupName: ADMIN_GROUP });

    // The API's handlers, one function per group (ADR 0017), with a month of logs each.
    const nodeFunction = (id: string, entry: string, environment: Record<string, string>) =>
      new NodejsFunction(this, id, {
        entry: entryPoint(entry),
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        // Inside API Gateway's 30-second limit, so a slow request fails here first.
        timeout: Duration.seconds(10),
        bundling: { format: OutputFormat.ESM, minify: true },
        environment,
        logGroup: new LogGroup(this, `${id}Logs`, {
          retention: RetentionDays.ONE_MONTH,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      });

    // The API keeps everything in the table (apps/api/src/data-stores.ts); the region
    // defaults to London, where the table is.
    const dataFunction = nodeFunction("ApiFunction", "lambda.ts", { DATA_TABLE: table.tableName });
    // Reads and writes the table's items, and nothing else in DynamoDB (hosting E2.S1).
    table.grantReadWriteData(dataFunction);
    const apiIntegration = new HttpLambdaIntegration("ApiIntegration", dataFunction);

    // The only function allowed to manage the team's accounts (ADR 0017, ADR 0018), and only
    // with the actions the account routes use.
    const accountsFunction = nodeFunction("AccountsFunction", "accounts-lambda.ts", {
      USER_POOL_ID: userPool.userPoolId,
    });
    userPool.grant(
      accountsFunction,
      "cognito-idp:ListUsers",
      "cognito-idp:ListUsersInGroup",
      "cognito-idp:AdminCreateUser",
    );
    const accountsIntegration = new HttpLambdaIntegration("AccountsIntegration", accountsFunction);

    // Every route, and the $default catch-all, needs a token from the team's pool, so an
    // unknown path gets 401 rather than 404 (ADR 0018).
    const api = new HttpApi(this, "Api", {
      createDefaultStage: false,
      defaultAuthorizer: new HttpUserPoolAuthorizer("TeamSignIn", userPool, {
        userPoolClients: [webClient, checkClient],
      }),
      defaultIntegration: apiIntegration,
    });
    // Exactly the API's own route list, so every route it serves is hosted and guarded.
    for (const key of routeKeys) {
      const [method = "", path = ""] = key.split(" ");
      const httpMethod = HTTP_METHODS[method];
      if (!httpMethod) throw new Error(`No HTTP method for the route ${key}`);
      const integration = isAccountRoute(key) ? accountsIntegration : apiIntegration;
      api.addRoutes({ path, methods: [httpMethod], integration });
    }

    const accessLogs = new LogGroup(this, "ApiAccessLogs", {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const stage = new HttpStage(this, "ApiStage", {
      httpApi: api,
      autoDeploy: true,
      // Shared by every caller, so a flood can't run up the bill (ADR 0017).
      throttle: { rateLimit: 20, burstLimit: 40 },
      accessLogSettings: {
        destination: new LogGroupLogDestination(accessLogs),
        // What was asked for and how it went; never bodies, which may hold cast data, nor
        // IP addresses, which are personal data the PRD doesn't need.
        format: AccessLogFormat.custom(
          JSON.stringify({
            requestId: "$context.requestId",
            time: "$context.requestTime",
            routeKey: "$context.routeKey",
            status: "$context.status",
            error: "$context.authorizer.error",
            latency: "$context.responseLatency",
          }),
        ),
      },
    });

    const pages = new Pages(this, "Pages", {
      api,
      signIn: {
        clientId: webClient.userPoolClientId,
        issuer: userPool.userPoolProviderUrl,
        loginUrl: loginDomain.baseUrl(),
      },
    });
    // The client must exist before the API (its sign-in check names it) and the API before
    // the pages (they route to it), so the client gets the pages' address afterwards.
    const webClientResource = webClient.node.defaultChild;
    if (!(webClientResource instanceof CfnUserPoolClient)) throw new Error("No web client");
    webClientResource.callbackUrLs = [pages.url];
    webClientResource.logoutUrLs = [pages.url];

    new CfnOutput(this, "AppUrl", {
      value: pages.url,
      description: "The app's address, for the team and the post-deploy check",
    });
    // Reachable too, behind the same sign-in check (ADR 0017).
    new CfnOutput(this, "ApiUrl", { value: stage.url, description: "The API's own address" });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "WebClientId", { value: webClient.userPoolClientId });
    new CfnOutput(this, "CheckClientId", { value: checkClient.userPoolClientId });
  }
}
