# Running the hosted app

This guide is for the maintainer: the person who holds the AWS account and releases the app. It covers deploying the hosted app, giving the team their accounts, releasing new versions, going back to an earlier one, and getting an admin back in. The app's pages are served from S3 through CloudFront, the API runs on Lambda behind API Gateway, and everyone signs in through a Cognito user pool ([ADR 0017](../adr/0017-hosting-on-lambda-and-cloudfront.md), [ADR 0018](../adr/0018-access-control-with-cognito.md)).

Start with [the remote database guide](remote-data.md). This guide assumes you've done its steps 1 to 3: you have the AWS account, the CLI, the `gangshow-admin` profile and a deployed stack.

Throughout, replace:
- `you@example.com` with your email address, for the budget alert;
- `<app address>` with the app's address, which the deploy prints as `AppUrl`;
- `<user pool id>` and `<check client id>` with the deploy's `UserPoolId` and `CheckClientId`;
- `<your username>` with the username you'll sign in with;
- `<check admin>`, `<check member>` and `<check read-only>` with three usernames kept for the post-deploy check, such as `check-admin`, `check-member` and `check-read-only`;
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

`pnpm infra:diff` shows what the deploy will change. Read it before you deploy: the table (`DataTable`), the user pool (`UserPool`) and the files bucket (`FilesBucket`) hold the show, the accounts and the scenery files, and a deploy should never replace or remove any of them. If the diff says it would, stop and ask for help. Use `pnpm infra:deploy`, never `pnpm deploy`, which is one of pnpm's own commands and never reaches AWS.

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

After every deploy, check the app refuses anyone not signed in, lets an admin in, keeps the admin-only actions from everyone else, and lets a Read-Only Team Member read but change nothing. The check signs in as three accounts kept for it: an Admin, a Casting Team Member and a Read-Only Team Member. This command creates them, or gives them fresh passwords, their roles, and enables them if they already exist. The three usernames must differ:

```bash
export AWS_PROFILE=gangshow-admin USER_POOL_ID=<user pool id> CHECK_CLIENT_ID=<check client id>
pnpm account check <check admin> <check member> <check read-only>
```

It prints the three passwords once. Then run the check:

```bash
pnpm check:hosted <app address> <check admin> <check member> <check read-only>
```

It asks for each password without showing what you type, then lists every request it made, each with `PASS` or `FAIL`. Type the passwords one after another: each sign-in lasts only 5 minutes. As the read-only account it sends every change the API has, and passes only if each is refused.

- **It ends with `PASS`**: the deploy is good.
- **It ends with `FAIL`**: don't use this deploy. If it's a release, go back to the previous version (section 5). If it's the first deploy, ask for help before giving anyone an account.

The check admin is a real admin with a password that never expires, so once the check has passed, sign in to the app and disable the three check accounts on the **Accounts** page. The next `pnpm account check` enables them again. Forget the passwords: the next run makes new ones.

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
4. Open **Accounts**, choose **Add account**, type a username, choose their role and choose **Save**. The role starts at **Read-Only Team Member**: choose **Casting Team Member** for anyone who changes the cast and casting. The app shows a temporary password once. Pass it to that person yourself, in person or by message, never in the same message as their username, and never in the app's notes. They choose their own password when they first sign in.
5. Do the same for everyone on the team. Make one other person you trust an admin too, by choosing **Admin** in their **Role** column, so the team isn't stuck if you're away.

A username is all the app holds about each adult volunteer ([ADR 0018](../adr/0018-access-control-with-cognito.md)), so choose one that doesn't need anything else, such as a first name and an initial.

On the **Accounts** page, any admin can also reset a forgotten password, disable the account of someone who's left, and change anyone else's role. An admin can't disable their own account or change their own role, and the only enabled admin stays an admin, so there's always at least one.

### Team roles

Every account has a role: Admin, Casting Team Member or Read-Only Team Member. Behind the scenes an account is an Admin, or has any mix of the department permissions Casting, Stage, Tech and Wardrobe, each a user pool group of the same name ([ADR 0026](../adr/0026-department-permissions-as-user-pool-groups.md)). Casting makes a Casting Team Member; an account with no permission, or only groups the app doesn't know, may only read. Stage, Tech and Wardrobe allow no change yet. Wardrobe used to be called Costume: anyone who had Costume ticked needs Wardrobe ticking ([ADR 0027](../adr/0027-costume-group-renamed-wardrobe.md)). An admin chooses each new account's role when adding it. Changing someone's role signs them out on every device within 5 minutes, and the new role applies when they sign back in.

**Once, straight after the first deploy that brings department permissions**, move every account out of the retiring `read-only` group:

```bash
export AWS_PROFILE=gangshow-admin USER_POOL_ID=<user pool id>
pnpm account roles
```

It takes each account out of the `read-only` group, leaving it with no permissions, so it may still only read, and says how many accounts it checked and moved. No one is signed out and no one's access changes. It's safe to run again: it only ever removes `read-only` and never adds a group. A later release deletes the group once the command reports nothing left to move.

## 4. Release a new version

Releases come from `main` ([ADR 0004](../adr/0004-versioning-with-release-please.md)). As changes are merged, release-please keeps a pull request open called `chore(main): release <next version>`, listing what's new. When you want to release, either use the shortcut below or follow the steps by hand.

**The shortcut.** `pnpm release` does the steps below for you (and, given a version, the going back in section 5), from your own machine and with your own AWS profile (nothing is stored or sent anywhere else):

```bash
export ALERT_EMAIL=you@example.com AWS_PROFILE=gangshow-admin
pnpm release
```

It needs a clean working tree, and it stops at the first thing that goes wrong rather than carrying on. It checks your AWS profile works before it touches anything, then switches to `main`, finds the open release pull request (by its branch, not just its title) and asks before it merges it. It merges with your admin bypass of the branch ruleset (`gh pr merge --admin`), because GitHub never runs the required checks on a release PR. Then it waits for the release's tag, checks the code really is at that tag, and shows you the `cdk diff`, listing anything it would remove or replace. It refuses a diff it can't read, and one that would replace or remove the table, the user pool or the files bucket. It asks before it deploys, naming the AWS account. After the deploy it offers the post-deploy check, reading the stack's outputs itself and using the check accounts `check-admin`, `check-member` and `check-read-only` (set `CHECK_ADMIN`, `CHECK_MEMBER` and `CHECK_READ_ONLY` for other names), then returns you to `main`. On a release it also says which version you replaced, so you know what to go back to. If you stop a deploy half way (Ctrl+C), check the stack's status in the AWS console before you run `pnpm release <version>` again: CloudFormation may still be updating.

By hand:

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

If a release goes wrong, deploy the previous one: `pnpm release <previous version>` (for example `pnpm release v0.8.0`) does the steps below and merges nothing. Going back changes only the pages and the API's code. The show's data, the team's accounts and the scenery files stay as they are: the table, the user pool and the files bucket outlive even a deleted stack, and a deploy doesn't change what's in them.

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

The account comes back enabled and an admin, with a new temporary password, printed once. It's signed out on every device within 5 minutes, in case the old password was stolen. Sign in at `<app address>` with the temporary password and choose a new one.

If the sign-in page says there have been too many attempts, Cognito has paused sign-in for that account after repeated wrong passwords. The pause grows with each wrong try, up to about 15 minutes, and restoring the account may not end it: wait, then sign in with the temporary password.

Then delete the `gangshow-admin` access key, as after every session.
