import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { AppStack } from "./app-stack.ts";

// Made-up address: the real one is given at deploy time and never committed.
const ALERT_EMAIL = "alerts@example.com";

const synth = () => {
  const stack = new AppStack(new App(), "Test", { alertEmail: ALERT_EMAIL });
  return { stack, template: Template.fromStack(stack) };
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
});
