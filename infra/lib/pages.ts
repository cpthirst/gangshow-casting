import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Annotations, AssetHashType, DockerImage, Duration, RemovalPolicy } from "aws-cdk-lib";
import type { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import {
  AccessLevel,
  AllowedMethods,
  type BehaviorOptions,
  CachePolicy,
  Distribution,
  Function as EdgeFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  type ResponseSecurityHeadersBehavior,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const webApp = fileURLToPath(new URL("../../apps/web", import.meta.url));

// The built app is one script and one stylesheet from its own address, with no inline code,
// so nothing else needs allowing. Signing in adds the sign-in service (hosting E3.S2).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders: ResponseSecurityHeadersBehavior = {
  contentSecurityPolicy: { contentSecurityPolicy: CONTENT_SECURITY_POLICY, override: true },
  frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
  strictTransportSecurity: {
    accessControlMaxAge: Duration.days(730),
    includeSubdomains: true,
    override: true,
  },
  contentTypeOptions: { override: true },
  referrerPolicy: { referrerPolicy: HeadersReferrerPolicy.SAME_ORIGIN, override: true },
};

// The router's pages have no file extension; everything with one is a built file. Runs at
// the edge on the pages' requests only, so the API's paths never reach it.
const SEND_PAGES_TO_THE_APP = `function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.split("/").pop();
  if (lastSegment.indexOf(".") === -1) request.uri = "/index.html";
  return request;
}`;

export interface PagesProps {
  api: HttpApi;
}

/** The web app's pages and the hosted API at one HTTPS address (ADR 0017). */
export class Pages extends Construct {
  readonly url: string;

  constructor(scope: Construct, id: string, { api }: PagesProps) {
    super(scope, id);

    // Holds only the built app, rebuilt on every deploy. CDK's default removal policy
    // (retain) leaves it behind if the stack is ever deleted; emptying it would need an
    // extra function in the stack.
    const bucket = new Bucket(this, "Bucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    const withHeaders = (id: string, cacheControl: string) =>
      new ResponseHeadersPolicy(this, id, {
        securityHeadersBehavior: securityHeaders,
        customHeadersBehavior: {
          customHeaders: [{ header: "Cache-Control", value: cacheControl, override: true }],
        },
      });
    // Listing lets S3 answer 404 for a missing file, rather than 403.
    const pagesOrigin = S3BucketOrigin.withOriginAccessControl(bucket, {
      originAccessLevels: [AccessLevel.READ, AccessLevel.LIST],
    });
    const assetsBehaviour: BehaviorOptions = {
      origin: pagesOrigin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      // Vite names each built file after its content, so a file never changes once deployed.
      responseHeadersPolicy: withHeaders("BuiltFileHeaders", "public, max-age=31536000, immutable"),
    };
    const apiBehaviour: BehaviorOptions = {
      // The API's $default stage has no path prefix; a named stage would need an originPath.
      origin: new HttpOrigin(
        `${api.apiId}.execute-api.${api.stack.region}.${api.stack.urlSuffix}`,
        {
          protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
        },
      ),
      viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: AllowedMethods.ALLOW_ALL,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      // Every header but Host (API Gateway needs its own), so the sign-in token goes through.
      originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      // The API's code sends this too, but the sign-in check's refusals never reach it.
      responseHeadersPolicy: withHeaders("ApiHeaders", "no-store"),
    };

    // No error-page fallback: that would turn the API's 401, 403 and 404 into the app's page.
    const distribution = new Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      // Europe and North America only: the cheapest, and the team is in Chester.
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: pagesOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // The app's page is fetched afresh each load, so a new release shows on the next one.
        cachePolicy: CachePolicy.CACHING_DISABLED,
        responseHeadersPolicy: withHeaders("PageHeaders", "no-cache"),
        functionAssociations: [
          {
            eventType: FunctionEventType.VIEWER_REQUEST,
            function: new EdgeFunction(this, "SendPagesToTheApp", {
              code: FunctionCode.fromInline(SEND_PAGES_TO_THE_APP),
              runtime: FunctionRuntime.JS_2_0,
            }),
          },
        ],
      },
      additionalBehaviors: { "/assets/*": assetsBehaviour, "/api/*": apiBehaviour },
    });
    // Listing could show the bucket's contents at its root, but the root is always the app's
    // page: by the default root object, and by the edge function's rewrite of "/".
    Annotations.of(distribution).acknowledgeWarning(
      "@aws-cdk/aws-cloudfront-origins:listBucketSecurityRisk",
      "The root is index.html, so the bucket's listing is never served",
    );

    new BucketDeployment(this, "Deployment", {
      sources: [webBuild()],
      destinationBucket: bucket,
      // An open tab may still ask for the files of the release it loaded.
      prune: false,
      logGroup: new LogGroup(this, "DeploymentLogs", {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    this.url = `https://${distribution.distributionDomainName}`;
  }
}

/**
 * The web app, built by Vite on the maintainer's machine when the stack is synthesised. A
 * failed build fails the synth on purpose, so `pnpm check` and a deploy never ship a broken app.
 */
function webBuild() {
  return Source.asset(webApp, {
    assetHashType: AssetHashType.OUTPUT,
    bundling: {
      // Required, but never used: the local build below always runs instead.
      image: DockerImage.fromRegistry("unused"),
      local: {
        tryBundle(outputDir) {
          const build = ["--filter", "web", "exec", "vite", "build", "--outDir", outputDir];
          // Its progress goes to stderr: stdout is CDK's.
          execFileSync("pnpm", [...build, "--emptyOutDir"], {
            cwd: repoRoot,
            stdio: ["ignore", process.stderr, "inherit"],
          });
          return true;
        },
      },
    },
  });
}
