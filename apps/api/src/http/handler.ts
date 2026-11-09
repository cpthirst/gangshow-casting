import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { productionIdOf } from "./params.ts";

/** The parts of the API Gateway event that handlers use; a real Lambda event satisfies it. */
export type ApiEvent = Pick<
  APIGatewayProxyEventV2,
  "pathParameters" | "queryStringParameters" | "body"
> & {
  /** The signed-in token's claims, from API Gateway's JWT authorizer; none locally. */
  requestContext?: { authorizer?: { jwt?: { claims?: Record<string, unknown> } } };
};

export type Handler = (event: ApiEvent) => Promise<APIGatewayProxyStructuredResultV2>;

/** A handler for a route under a production: 404 for a {productionId} no production could have. */
export const inProduction =
  (handle: (productionId: string, event: ApiEvent) => ReturnType<Handler>): Handler =>
  async (event) => {
    const productionId = productionIdOf(event);
    return productionId === undefined ? { statusCode: 404 } : handle(productionId, event);
  };
