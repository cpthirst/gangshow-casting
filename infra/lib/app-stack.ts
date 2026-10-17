import { CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

// Changes here go through infra-reviewer (see CLAUDE.md → Review loop).
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
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
  }
}
