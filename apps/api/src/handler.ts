import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

/** The parts of the API Gateway event that handlers use; a real Lambda event satisfies it. */
export type ApiEvent = Pick<
  APIGatewayProxyEventV2,
  "pathParameters" | "queryStringParameters" | "body"
>;

export type Handler = (event: ApiEvent) => Promise<APIGatewayProxyStructuredResultV2>;
