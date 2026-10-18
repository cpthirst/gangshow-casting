# Running the hosted app

This guide is for the maintainer: the person who holds the AWS account and releases the app. It covers deploying the hosted app, giving the team their accounts, releasing new versions, going back to an earlier one, and getting an admin back in. The app's pages are served from S3 through CloudFront, the API runs on Lambda behind API Gateway, and everyone signs in through a Cognito user pool ([ADR 0017](../adr/0017-hosting-on-lambda-and-cloudfront.md), [ADR 0018](../adr/0018-access-control-with-cognito.md)).

Start with [the remote database guide](remote-data.md). This guide assumes you've done its steps 1 to 3: you have the AWS account, the CLI, the `gangshow-admin` profile and a deployed stack.

Throughout, replace:
- `you@example.com` with your email address, for the budget alert;
- `<app address>` with the app's address, which the deploy prints as `AppUrl`;
- `<user pool id>` and `<check client id>` with the deploy's `UserPoolId` and `CheckClientId`;
- `<your username>` with the username you'll sign in with;
- `<check admin>` and `<check member>` with two usernames kept for the post-deploy check, such as `check-admin` and `check-member`;
- `<version>` with a release's tag, for example `v0.9.0`.

None of these ever go in the repository. The deploy's outputs aren't secret, but keep them out of it too.

## Before each session

You'll need an access key for `gangshow-admin`. The remote-data guide has you delete it after each use, so make a new one (**IAM → Users → gangshow-admin → Security credentials → Create access key**) and give it to the CLI:

```bash
aws configure --profile gangshow-admin   # paste the key; region eu-west-2
```

When you've finished, delete the key in IAM again.

## 1. Deploy

From the repository's root, on an up-to-date `main`:

```bash
git switch main
git pull
pnpm install
export ALERT_EMAIL=you@example.com AWS_PROFILE=gangshow-admin
pnpm infra:diff
pnpm infra:deploy
```

`pnpm infra:diff` shows what the deploy will change. Read it before you deploy: the table (`DataTable`) and the user pool (`UserPool`) hold the show and the accounts, and a deploy should never replace or remove either. If the diff says it would, stop and ask for help. Use `pnpm infra:deploy`, never `pnpm deploy`, which is one of pnpm's own commands and never reaches AWS.

The deploy builds the pages and the API on your machine, then uploads them. The first one takes about 15 minutes, as CloudFront sets up; later ones take a few. At the end it prints the stack's outputs:

- `GangshowCasting.AppUrl`: the app's address, the one to give the team;
- `GangshowCasting.UserPoolId` and `GangshowCasting.CheckClientId`: for the account and check commands below;
- `GangshowCasting.ApiUrl` and `GangshowCasting.WebClientId`: the app uses these itself; you won't need them.

To see them again later:

```bash
aws cloudformation describe-stacks --stack-name GangshowCasting --region eu-west-2 \
  --query "Stacks[0].Outputs" --output table
```

## 2. Run the post-deploy check

After every deploy, check the app refuses anyone not signed in, lets an admin in, and keeps the admin-only actions from everyone else. The check signs in as two accounts kept for it, one admin and one not. This command creates them, or gives them fresh passwords and enables them if they already exist:

```bash
export AWS_PROFILE=gangshow-admin USER_POOL_ID=<user pool id> CHECK_CLIENT_ID=<check client id>
pnpm account check <check admin> <check member>
```

It prints both passwords once. Then run the check:

```bash
pnpm check:hosted <app address> <check admin> <check member>
```

It asks for each password without showing what you type, then lists every request it made, each with `PASS` or `FAIL`.

- **It ends with `PASS`**: the deploy is good.
- **It ends with `FAIL`**: don't use this deploy. If it's a release, go back to the previous version (section 5). If it's the first deploy, ask for help before giving anyone an account.

The check admin is a real admin with a password that never expires, so once the check has passed, sign in to the app and disable both check accounts on the **Accounts** page. The next `pnpm account check` enables them again. Forget the passwords: the next run makes new ones.

## 3. Create the first admin and the team's accounts

After the first deploy, create your own admin account from the repository:

```bash
export AWS_PROFILE=gangshow-admin USER_POOL_ID=<user pool id>
pnpm account admin <your username>
```

It prints a temporary password once. Then:

1. Open `<app address>` in your browser. It takes you to the sign-in page.
2. Sign in with your username and the temporary password.
3. Choose your own password when asked. You'll use it from now on.
4. Open **Accounts**, choose **Add account**, type a username and choose **Save**. The app shows a temporary password once. Pass it to that person yourself, in person or by message, never in the same message as their username, and never in the app's notes. They choose their own password when they first sign in.
5. Do the same for everyone on the team. Make one other person you trust an admin too, with the **Make admin** action, so the team isn't stuck if you're away.

A username is all the app holds about each adult volunteer ([ADR 0018](../adr/0018-access-control-with-cognito.md)), so choose one that doesn't need anything else, such as a first name and an initial.

On the **Accounts** page, any admin can also reset a forgotten password, disable the account of someone who's left, and make an account an admin or remove admin. An admin can't disable their own account or remove their own admin role, so there's always at least one admin.

## 4. Release a new version

Releases come from `main` ([ADR 0004](../adr/0004-versioning-with-release-please.md)). As changes are merged, release-please keeps a pull request open called `chore(main): release <next version>`, listing what's new. When you want to release:

1. Merge that pull request on GitHub. That tags the release `v<version>` and publishes it on the repository's **Releases** page.
2. Note the version you're replacing: it's the release before this one on the **Releases** page. You'll need it to go back.
3. Deploy the new tag:

```bash
git fetch --tags
git switch --detach <version>
pnpm install
export ALERT_EMAIL=you@example.com AWS_PROFILE=gangshow-admin
pnpm infra:diff
pnpm infra:deploy
```

4. Run the post-deploy check (section 2), and disable the check accounts afterwards.
5. Go back to `main` with `git switch main`.

People already using the app pick up the new pages the next time they load it. A tab left open keeps working until then.

## 5. Go back to the previous version

If a release goes wrong, deploy the previous one. Going back changes only the pages and the API's code. The show's data and the team's accounts stay as they are: the stack keeps the table and the user pool, both protected from deletion, and a deploy doesn't change what's in them.

```bash
git fetch --tags
git switch --detach <previous version>
pnpm install
export ALERT_EMAIL=you@example.com AWS_PROFILE=gangshow-admin
pnpm infra:diff
pnpm infra:deploy
```

Read the diff first, as for any deploy. If it would change the table or the user pool, the release you're leaving changed them, and going back needs more than a deploy: stop and ask for help.

Then run the post-deploy check (section 2) and go back to `main` with `git switch main`. Fix the problem on `main` and release again; don't change the old release.

## 6. Get an admin back in

If an admin forgets their password, or their account is disabled, any other admin can fix it on the **Accounts** page: reset the password, or enable the account.

If no admin can sign in, restore one from the repository. It works for an existing account and makes a new one if the username is new:

```bash
export AWS_PROFILE=gangshow-admin USER_POOL_ID=<user pool id>
pnpm account admin <your username>
```

The account comes back enabled and an admin, with a new temporary password, printed once. It's signed out on every device within the hour, in case the old password was stolen. Sign in at `<app address>` with the temporary password and choose a new one.

If the sign-in page says there have been too many attempts, Cognito has paused sign-in for that account after repeated wrong passwords. The pause grows with each wrong try, up to about 15 minutes, and restoring the account may not end it: wait, then sign in with the temporary password.

Then delete the `gangshow-admin` access key, as after every session.
