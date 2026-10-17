# Moving the show's data to the remote database

This guide is for the maintainer, the one person who runs the app and holds the AWS account. It moves a production's data from the files on your machine (`apps/api/data/<production>/`) into the DynamoDB table in AWS ([ADR 0015](../adr/0015-dynamodb-for-production-data.md)). Do the steps in order. Don't skip the checks: until the last step, the files on your machine are the only complete copy of the show.

You'll need about an hour the first time. Tell the team before you start, so nobody edits the cast during the move.

Throughout, replace:
- `<account-id>` with your 12-digit AWS account id;
- `<table>` with the table's name, which the deploy prints as `DataTableName`;
- `<production>` with the production, for example `2027`;
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
cd infra
AWS_PROFILE=gangshow-admin pnpm exec cdk bootstrap aws://<account-id>/eu-west-2 -c alertEmail=you@example.com
AWS_PROFILE=gangshow-admin pnpm exec cdk deploy -c alertEmail=you@example.com
cd ..
```

Use `pnpm exec cdk`, not `pnpm deploy`: that's one of pnpm's own commands and never reaches CDK.

The deploy prints `GangshowCasting.DataTableName = <table>`. Keep that name. It creates:
- the table, with 7-day point-in-time recovery and deletion protection, kept even if the stack is deleted;
- a monthly budget that emails you if AWS spend is forecast to pass about £5, or does. The budget covers the whole account.

To see what a later change would do before deploying it, run `AWS_PROFILE=gangshow-admin pnpm exec cdk diff -c alertEmail=you@example.com` in `infra`.

Then create the profile the app and the move will use: an IAM user, `gangshow-data`, with no console access, that can only read and write this one table. Attach this inline policy, filled in with your account id and table name:

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

## 4. Back up the data folder

From the repository's root, copy the whole data folder into a new folder only you can read, outside the repository:

```bash
mkdir -m 700 ~/gangshow-data-backup
cp -R apps/api/data/. ~/gangshow-data-backup/
```

It holds young people's names, so keep it somewhere your computer encrypts (FileVault on a Mac) and out of synced folders such as iCloud Drive or Dropbox. This is your safety net until the move is finished. Step 9 removes it.

## 5. Copy the production to the table

Stop the app first if it's running (`Ctrl+C` where you started `pnpm dev`), so nothing changes the files from here until step 8. Then, from the repository's root:

```bash
DATA_TABLE=<table> AWS_PROFILE=gangshow-data pnpm --filter api move copy <production>
```

The first line names the table, region and folder it's using: check they're right. It reports how many cast members, roles, notes and running order versions it copied, never anyone's name.

- **Safe to re-run.** Anything already copied is counted as "already there".
- **"Nothing copied: the remote database already holds different data".** The table has a record that differs from your files, named by collection and id. Nothing was written. Work out which is right before going on.
- **"No local data found".** Check the production id and that you're in the right folder.

## 6. Verify the copy

```bash
DATA_TABLE=<table> AWS_PROFILE=gangshow-data pnpm --filter api move verify <production>
```

This reads everything through the app's own API, once from the files and once from the table, and compares them.

- **A pass** lists the counts that match, and records the time beside your local data.
- **"Only in the remote database (kept)"** lists records the table holds that your files don't, such as notes saved there earlier. They're fine.
- **A failure** names what's missing or different and clears any earlier pass. Copy again, then verify again.

## 7. Use the table

Run the app against the table, and check the cast, roles, running order and notes look right:

```bash
DATA_TABLE=<table> AWS_PROFILE=gangshow-data pnpm dev
```

On start, the API says `data: everything in table <table> (eu-west-2)`.

### Going back

Until step 8, going back is just a setting: stop the app and run plain `pnpm dev`, in a shell where `DATA_TABLE` isn't set. It reads the files again. Anything saved while using the table is only in the table. Once step 8 removes the files, there's no going back to them, only to the backup from step 4.

## 8. Remove the local files

When you're happy the app works from the table:

```bash
pnpm --filter api move remove <production>
```

It refuses unless a verification passed after the last copy and no file has changed since. If the app ran on the files after you verified, stop it, then copy and verify again. It lists the files it will remove, and removes them only if you type the production id. Anything else keeps them all. It never touches the table or other productions.

## 9. Remove the backup

The cast are young people, and deleted data shouldn't linger ([ADR 0010](../adr/0010-cast-member-personal-data.md)). Once you've used the app from the table for a rehearsal or two and nothing is missing, delete the backup:

```bash
rm -rf ~/gangshow-data-backup
```

If your computer backs itself up (Time Machine, say), the backup folder may be in those backups too: remove it there as well. From now on, the table's 7-day point-in-time recovery is the only backup.

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
