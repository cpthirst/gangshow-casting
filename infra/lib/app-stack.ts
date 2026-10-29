import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ADMIN_GROUP,
  CASTING_GROUP,
  DIRECTOR_GROUP,
  isAccountRoute,
  READ_ONLY_GROUP,
  type RouteKey,
  routeKeys,
  STAGE_GROUP,
  TECH_GROUP,
  WARDROBE_GROUP,
} from "@app/shared";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AccessLogFormat } from "aws-cdk-lib/aws-apigateway";
import {
  CfnStage,
  HttpApi,
  HttpMethod,
  type HttpRoute,
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
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { Pages } from "./pages.ts";

/** The version release-please keeps in the root package.json, which the API's health route
 *  reports as APP_VERSION. The dev server sets it the same way (releaseVersion in
 *  apps/api/src/dev-server.ts); the two packages share no code. */
function releaseVersion(): string {
  const { version } = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  if (typeof version !== "string") throw new Error("The root package.json has no version");
  return version;
}

const entryPoint = (file: string) =>
  fileURLToPath(new URL(`../../apps/api/src/${file}`, import.meta.url));

// The methods the API's route list uses.
// Open to every role, so it has its own limit (ADR 0024).
const USAGE_ROUTE: RouteKey = "POST /api/usage";

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
    // match apps/api/src/storage/dynamo-table.ts. Don't rename "DataTable" or change the construct:
    // either replaces the table, orphaning the retained one with all the data.
    const table = new TableV2(this, "DataTable", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      // Rows with this time (epoch seconds) are removed once it passes: usage after 90 days
      // (ADR 0023). Changing it in place keeps the table and its data.
      timeToLiveAttribute: "expiresAt",
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

    // Each item's scenery files, keyed <production>/<item id>/scenery/<name> (ADR 0030). Never
    // public: only the API reaches it, behind the sign-in. No versioning, so a replaced or
    // deleted file is gone. Don't rename "FilesBucket": that replaces the bucket, orphaning the
    // retained one with every file.
    const filesBucket = new Bucket(this, "FilesBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // The only copy of the files: deleting it must be a separate, deliberate step.
      removalPolicy: RemovalPolicy.RETAIN,
    });

    new CfnOutput(this, "FilesBucketName", {
      value: filesBucket.bucketName,
      description: "Set FILES_BUCKET to this to keep the API's scenery files here",
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
      // Cognito's shortest, so a role change, disable or reset bites within 5 minutes
      // (team-roles FR12, FR13). Pages renew them from the day's sign-in as they run out.
      accessTokenValidity: Duration.minutes(5),
      idTokenValidity: Duration.minutes(5),
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
      // One sign-in per run, as a check account is an admin: Cognito's shortest token
      // lifetimes, and an hour's refresh token, its shortest too.
      accessTokenValidity: Duration.minutes(5),
      idTokenValidity: Duration.minutes(5),
      refreshTokenValidity: Duration.hours(1),
    });
    // Admins manage accounts, delete cast members and save running orders (ADR 0018).
    userPool.addGroup("AdminGroup", { groupName: ADMIN_GROUP });
    // One group per department's permission (ADR 0026). An account in none, nor admin, may only read.
    userPool.addGroup("CastingGroup", { groupName: CASTING_GROUP });
    userPool.addGroup("StageGroup", { groupName: STAGE_GROUP });
    userPool.addGroup("TechGroup", { groupName: TECH_GROUP });
    userPool.addGroup("WardrobeGroup", { groupName: WARDROBE_GROUP });
    // Changes every Production department, but not casting or the show (ADR 0029). Starts empty.
    userPool.addGroup("DirectorGroup", { groupName: DIRECTOR_GROUP });
    // Retiring: `pnpm account roles` moves everyone out, then a later release deletes it.
    userPool.addGroup("ReadOnlyGroup", { groupName: READ_ONLY_GROUP });

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

    // The API keeps everything in the table, and scenery files in the bucket
    // (apps/api/src/storage/data-stores.ts); both are in London.
    const dataFunction = nodeFunction("ApiFunction", "lambda.ts", {
      DATA_TABLE: table.tableName,
      FILES_BUCKET: filesBucket.bucketName,
      APP_VERSION: releaseVersion(),
    });
    // Reads and writes the table's items, and nothing else in DynamoDB (hosting E2.S1).
    table.grantReadWriteData(dataFunction);
    // Lists the files, and reads only scenery files, to sign the short-lived links that open or
    // download them (ADR 0030). Uploads will add only what they need.
    dataFunction.addToRolePolicy(
      new PolicyStatement({ actions: ["s3:ListBucket"], resources: [filesBucket.bucketArn] }),
    );
    dataFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [filesBucket.arnForObjects("*/*/scenery/*")],
      }),
    );
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
      "cognito-idp:AdminGetUser",
      "cognito-idp:AdminListGroupsForUser",
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminSetUserPassword",
      "cognito-idp:AdminEnableUser",
      "cognito-idp:AdminDisableUser",
      "cognito-idp:AdminUserGlobalSignOut",
      "cognito-idp:AdminAddUserToGroup",
      "cognito-idp:AdminRemoveUserFromGroup",
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
    let usageRoute: HttpRoute[] = [];
    for (const key of routeKeys) {
      const [method = "", path = ""] = key.split(" ");
      const httpMethod = HTTP_METHODS[method];
      if (!httpMethod) throw new Error(`No HTTP method for the route ${key}`);
      const integration = isAccountRoute(key) ? accountsIntegration : apiIntegration;
      const added = api.addRoutes({ path, methods: [httpMethod], integration });
      if (key === USAGE_ROUTE) usageRoute = added;
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
    // Recording usage is open to every role, so one account mustn't flood it: it gets its own,
    // tighter limit on top of the stage's (ADR 0024). The route must exist before its setting.
    if (usageRoute.length === 0) throw new Error(`No route ${USAGE_ROUTE} to limit`);
    const stageResource = stage.node.defaultChild;
    if (!(stageResource instanceof CfnStage)) throw new Error("No API stage resource");
    // Passed to CloudFormation as it is, so in its own spelling.
    stageResource.routeSettings = {
      [USAGE_ROUTE]: { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
    };
    stageResource.node.addDependency(...usageRoute);

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
