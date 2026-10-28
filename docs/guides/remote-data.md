# Running the remote database

This guide is for the maintainer, the one person who runs the app and holds the AWS account. It sets up the DynamoDB table in AWS that holds the show's data ([ADR 0015](../adr/0015-dynamodb-for-production-data.md)), runs the app against it, and restores it if something goes wrong. Do the steps in order the first time.

Throughout, replace:
- `<account-id>` with your 12-digit AWS account id;
- `<table>` with the table's name, which the deploy prints as `DataTableName`;
- `you@example.com` with your email address.

None of these ever go in the repository.

## 1. Create the AWS account

1. Sign up at [aws.amazon.com](https://aws.amazon.com) with an email address only you use. That makes it the account's root user.
2. Turn on multi-factor authentication (MFA) for the root user: **IAM → Security credentials → Assign MFA device**. Then stop using the root user, except for billing and account settings.
3. In **IAM → Users**, create a user for yourself, for example `gangshow-admin`, with the `AdministratorAccess` policy, and turn on MFA for it too. You'll deploy with this user.

## 2. Set up your admin profile

Install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html). Create an access key for `gangshow-admin` (**IAM → Users → Security credentials → Create access key**, "Command Line Interface"), then run:

```bash
aws configure --profile gangshow-admin   # paste the key; region eu-west-2
```

Keys live in `~/.aws/credentials` on your machine only. Never put them in the repository, a `.env` file or a chat message. If a key leaks, or the laptop is lost, delete it in IAM straight away. MFA protects the console, not this key, so step 3 ends by deleting it.

## 3. Deploy the table and the budget alert

From the repository's root, prepare the account for CDK (the first time only), then deploy:

```bash
export ALERT_EMAIL=you@example.com AWS_PROFILE=gangshow-admin
pnpm --filter infra exec cdk bootstrap aws://<account-id>/eu-west-2
pnpm infra:deploy
```

Use `pnpm infra:deploy`, not `pnpm deploy`: that's one of pnpm's own commands and never reaches CDK. To set the address once for every shell, add the `export ALERT_EMAIL=…` line to your shell profile (such as `~/.zshrc`), not to the repository.

The deploy prints `GangshowCasting.DataTableName = <table>`. Keep that name. It creates:
- the table, with 7-day point-in-time recovery and deletion protection, kept even if the stack is deleted;
- a monthly budget that emails you if AWS spend is forecast to pass about £5, or does. The budget covers the whole account.

To see what a later change would do before deploying it, run `pnpm infra:diff` with the same two variables set.

Then create the profile the app will use: an IAM user, `gangshow-data`, with no console access, that can only read and write this one table. Attach this inline policy, filled in with your account id and table name:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:ConditionCheckItem"
      ],
      "Resource": "arn:aws:dynamodb:eu-west-2:<account-id>:table/<table>"
    }
  ]
}
```

Give it an access key, and run `aws configure --profile gangshow-data`. It can't delete or change the table itself, only the rows in it.

Finally, delete the `gangshow-admin` access key in IAM. Make a new one when you next need to deploy, and delete that afterwards too.

## 4. Use the table

Run the app against the table:

```bash
DATA_TABLE=<table> AWS_PROFILE=gangshow-data pnpm dev
```

On start, the API says `data: everything in table <table> (eu-west-2)`. Plain `pnpm dev`, in a shell where `DATA_TABLE` isn't set, uses the files in `apps/api/data` instead: the two never mix, and nothing copies one into the other. Starting a new production in the table needs a story first: the one-off copy that moved 2027 there was removed, and is in git history at PR #45.

### Old copies from the 2027 move

The move had you back up the data folder to `~/gangshow-data-backup`. It holds young people's names, and deleted data shouldn't linger ([ADR 0010](../adr/0010-cast-member-personal-data.md)). If it's still there, delete it, along with any production folders left in `apps/api/data` from before the move:

```bash
rm -rf ~/gangshow-data-backup
```

If your computer backs itself up (Time Machine, say), remove it from those backups too.

## Restoring from point-in-time recovery

If data was deleted or damaged in the last 7 days, restore the table as it was at a moment before the problem. You'll need an admin access key (step 2) for this. The restore always creates a new table. Give the time in UTC:

```bash
AWS_PROFILE=gangshow-admin aws dynamodb restore-table-to-point-in-time \
  --source-table-name <table> \
  --target-table-name <table>-restored \
  --restore-date-time <a time before the problem, in UTC, e.g. 2027-03-14T19:00:00Z> \
  --region eu-west-2
```

When `aws dynamodb describe-table --table-name <table>-restored --region eu-west-2` says it's `ACTIVE`, protect it the way the deploy protects the original, before anything uses it:

```bash
AWS_PROFILE=gangshow-admin aws dynamodb update-table --table-name <table>-restored \
  --deletion-protection-enabled --region eu-west-2
AWS_PROFILE=gangshow-admin aws dynamodb update-continuous-backups --table-name <table>-restored \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true,RecoveryPeriodInDays=7 \
  --region eu-west-2
```

Add the restored table to the data profile's policy, then point the app at it with `DATA_TABLE=<table>-restored`.

Once you're sure the restored table is right, don't leave two copies of the cast. Ask for a story to bring the restored table under the stack and retire the damaged one: its deletion protection has to come off, it has to be deleted, and the policy has to name only the table in use again.

Then delete the admin access key again.

## Next: hosting the app

To put the app online for the team, with sign-in, follow [the hosting guide](hosting.md).
