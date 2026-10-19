# Changelog

## [1.5.0](https://github.com/cpthirst/gangshow-casting/compare/v1.4.0...v1.5.0) (2026-10-19)


### Features

* **web:** export the grid to Excel as any role, by the view switch (casting-overview-grid.E3.S4) ([#75](https://github.com/cpthirst/gangshow-casting/issues/75)) ([d16b944](https://github.com/cpthirst/gangshow-casting/commit/d16b944432cd8904d4553c784cf15c21321c0d7f))

## [1.4.0](https://github.com/cpthirst/gangshow-casting/compare/v1.3.0...v1.4.0) (2026-10-19)


### Features

* **web:** manage team roles, with access changes within 5 minutes (team-roles E3–E5) ([#73](https://github.com/cpthirst/gangshow-casting/issues/73)) ([7959aac](https://github.com/cpthirst/gangshow-casting/commit/7959aacaa9ccdf911e9a80100c619e934ebd8370))

## [1.3.0](https://github.com/cpthirst/gangshow-casting/compare/v1.2.0...v1.3.0) (2026-10-18)


### Features

* **web:** show every page read-only to Read-Only Team Members (team-roles E2) ([#71](https://github.com/cpthirst/gangshow-casting/issues/71)) ([55eaa22](https://github.com/cpthirst/gangshow-casting/commit/55eaa22eff91d64a32f5f645da9ad867397a9409))

## [1.2.0](https://github.com/cpthirst/gangshow-casting/compare/v1.1.0...v1.2.0) (2026-10-18)


### Features

* **api:** enforce the three roles in the API (team-roles.E1.S1) ([#69](https://github.com/cpthirst/gangshow-casting/issues/69)) ([7bca672](https://github.com/cpthirst/gangshow-casting/commit/7bca6727a074f565854f2ad7c890d8d36a332954))

## [1.1.0](https://github.com/cpthirst/gangshow-casting/compare/v1.0.0...v1.1.0) (2026-10-18)


### Features

* **web:** add and remove items (running-order.E3.S2) ([#66](https://github.com/cpthirst/gangshow-casting/issues/66)) ([3aa4c6a](https://github.com/cpthirst/gangshow-casting/commit/3aa4c6aca4f92598b38343c0d59e119926498303))

## 1.0.0 (2026-10-18)


### Features

* **api,web:** add roles to an item, with unique names (casting-roles) ([#18](https://github.com/cpthirst/gangshow-casting/issues/18)) ([2fcdcc0](https://github.com/cpthirst/gangshow-casting/commit/2fcdcc04547c0d912cee75f0e24453e1fe865b13))
* **api,web:** cast someone when adding a role (casting-roles.E1.S3) ([#20](https://github.com/cpthirst/gangshow-casting/issues/20)) ([cf20730](https://github.com/cpthirst/gangshow-casting/commit/cf207306187a1199bada39857834323f51b0835a))
* **api,web:** edit and remove roles, and manage ensemble members (casting-roles) ([#23](https://github.com/cpthirst/gangshow-casting/issues/23)) ([3e9b5d1](https://github.com/cpthirst/gangshow-casting/commit/3e9b5d117f2a3bc4d6ae5c65ddb41a1b4179b5de))
* **api,web:** remove a deleted cast member from every role (casting-roles.E3.S1) ([#21](https://github.com/cpthirst/gangshow-casting/issues/21)) ([6bdc47e](https://github.com/cpthirst/gangshow-casting/commit/6bdc47e181d1c920e52b7be00f8300897fdfa186))
* **api:** export the casting grid to Excel as an admin ([#60](https://github.com/cpthirst/gangshow-casting/issues/60)) ([adb53a5](https://github.com/cpthirst/gangshow-casting/commit/adb53a5476d92d2e47cd4e7b150f0da8c29bcb66))
* **api:** host every route on the remote data, with admin-only actions (hosting E2) ([#51](https://github.com/cpthirst/gangshow-casting/issues/51)) ([8f7ae4d](https://github.com/cpthirst/gangshow-casting/commit/8f7ae4d7b317c98e2acef5e167bbabbbd6649c7c))
* **api:** keep item notes in a remote DynamoDB table, with a budget alert (remote-data E1) ([#43](https://github.com/cpthirst/gangshow-casting/issues/43)) ([0c82d94](https://github.com/cpthirst/gangshow-casting/commit/0c82d941225f038a7eea4deb47d0d9d1e34821a7))
* **api:** keep the cast, roles and running order in the remote database (remote-data E2) ([#44](https://github.com/cpthirst/gangshow-casting/issues/44)) ([e067677](https://github.com/cpthirst/gangshow-casting/commit/e06767705c7ff43dc25a862042297afd4069a7e0))
* **api:** move a production's data to the remote database, safely (remote-data E3, E4) ([#45](https://github.com/cpthirst/gangshow-casting/issues/45)) ([0326b72](https://github.com/cpthirst/gangshow-casting/commit/0326b72a4b124349ac84fcbf0ea23ba7b93085a4))
* **infra:** host the API behind sign-in, with an admin from the repo (hosting E1) ([#49](https://github.com/cpthirst/gangshow-casting/issues/49)) ([8932e85](https://github.com/cpthirst/gangshow-casting/commit/8932e8507137fad256b9f385928d973d4287e5f4))
* **web:** add all the remaining cast to an ensemble in one go (casting-roles.E4.S1) ([#38](https://github.com/cpthirst/gangshow-casting/issues/38)) ([38c6a1d](https://github.com/cpthirst/gangshow-casting/commit/38c6a1d60cd041ee77e9cf49fa50a53a89df7e8f))
* **web:** add role totals and a casting grid to the Overview ([#59](https://github.com/cpthirst/gangshow-casting/issues/59)) ([cff8e7b](https://github.com/cpthirst/gangshow-casting/commit/cff8e7bfce8ad7e77d5b16550b8a5003a9f9013f))
* **web:** admins manage team accounts in the app (hosting E4) ([#53](https://github.com/cpthirst/gangshow-casting/issues/53)) ([0f90488](https://github.com/cpthirst/gangshow-casting/commit/0f9048813dcb1f2ce88da06573b4972c20898ffb))
* **web:** casting overview by section, ordered by casting score (casting-overview) ([#26](https://github.com/cpthirst/gangshow-casting/issues/26)) ([0a65d94](https://github.com/cpthirst/gangshow-casting/commit/0a65d9492735e4b3a00130beba5100fccf89d501))
* **web:** edit a running order item's details (running-order.E3.S1) ([#11](https://github.com/cpthirst/gangshow-casting/issues/11)) ([9a9d30b](https://github.com/cpthirst/gangshow-casting/commit/9a9d30bc956630a747113f083462c437f240d840))
* **web:** flag back-to-back and short-gap casting clashes, with a demo show (casting-rules) ([#30](https://github.com/cpthirst/gangshow-casting/issues/30)) ([a9bae8d](https://github.com/cpthirst/gangshow-casting/commit/a9bae8dc867589f432eccbc849c99f5fdf7b5440))
* **web:** keep notes on each item, shown on its page and the Items list (casting-item-overview.E3) ([#40](https://github.com/cpthirst/gangshow-casting/issues/40)) ([b6fd7fc](https://github.com/cpthirst/gangshow-casting/commit/b6fd7fcc9040d50968cbbae5f1d7cd4a7e07b410))
* **web:** list the show's items for casting (casting-items) ([#16](https://github.com/cpthirst/gangshow-casting/issues/16)) ([2ff0e51](https://github.com/cpthirst/gangshow-casting/commit/2ff0e5199772b47a6d2aebef443dd288808d095d))
* **web:** manage the cast list (cast-management) ([#12](https://github.com/cpthirst/gangshow-casting/issues/12)) ([1fbbf04](https://github.com/cpthirst/gangshow-casting/commit/1fbbf04fcf4a97c90b77efd23247c598a68b1de6))
* **web:** navigate between placeholder pages in a branded shell (app-shell.E1.S1) ([#4](https://github.com/cpthirst/gangshow-casting/issues/4)) ([612eadb](https://github.com/cpthirst/gangshow-casting/commit/612eadb96c8fe7bd6298a4d6f236497d9fbf4ff9))
* **web:** note how each cast member sings and acts (cast-management.E3.S1) ([#41](https://github.com/cpthirst/gangshow-casting/issues/41)) ([e4146ee](https://github.com/cpthirst/gangshow-casting/commit/e4146ee27bb4630dacbf30437f20cddaf9cd740f))
* **web:** open an item's casting page (casting-item-overview) ([#17](https://github.com/cpthirst/gangshow-casting/issues/17)) ([29a07fa](https://github.com/cpthirst/gangshow-casting/commit/29a07fa9c046a6b44eda3289b505402616eb219b))
* **web:** reorder the running order and save it as a new draft (running-order.E2.S1) ([#8](https://github.com/cpthirst/gangshow-casting/issues/8)) ([c8cdd25](https://github.com/cpthirst/gangshow-casting/commit/c8cdd25035b7085f84f419dd7a1f07810f4117fc))
* **web:** reorder the running order by drag and drop (running-order.E2.S2) ([#9](https://github.com/cpthirst/gangshow-casting/issues/9)) ([ad26bfc](https://github.com/cpthirst/gangshow-casting/commit/ad26bfc6afb482da155e5bf747e7daf07751306b))
* **web:** see the running clock (running-order.E1.S2) ([#7](https://github.com/cpthirst/gangshow-casting/issues/7)) ([07e6d4d](https://github.com/cpthirst/gangshow-casting/commit/07e6d4d4bb3a09578237070a3e6b030fa1ee42ec))
* **web:** show a Casting menu with Overview and Items (casting-menus) ([#15](https://github.com/cpthirst/gangshow-casting/issues/15)) ([7d37876](https://github.com/cpthirst/gangshow-casting/commit/7d37876ba7b56621a3b0ca01391db8f223e80616))
* **web:** show an item's roles as ordered cards (casting-item-overview.E2.S1) ([#19](https://github.com/cpthirst/gangshow-casting/issues/19)) ([d0b2e23](https://github.com/cpthirst/gangshow-casting/commit/d0b2e2336635f2196c3c91e80f8561596a06e64a))
* **web:** show casting clashes on the Items list and the Overview (casting-rules) ([#34](https://github.com/cpthirst/gangshow-casting/issues/34)) ([b4bb675](https://github.com/cpthirst/gangshow-casting/commit/b4bb6757ea92cf99bc80019e1bd48af300cb0f10))
* **web:** show each item's role counts (casting-items.E2.S1) ([#22](https://github.com/cpthirst/gangshow-casting/issues/22)) ([4d1a58b](https://github.com/cpthirst/gangshow-casting/commit/4d1a58bc068b21cf45df469f9bcbdc98011edd15))
* **web:** show each item's running time on the Items list ([#39](https://github.com/cpthirst/gangshow-casting/issues/39)) ([39f6d62](https://github.com/cpthirst/gangshow-casting/commit/39f6d62fdfc637e2addf3a9397cd6718522b37ff))
* **web:** show each person's show timeline on the Overview (casting-overview-timeline) ([#36](https://github.com/cpthirst/gangshow-casting/issues/36)) ([6534dee](https://github.com/cpthirst/gangshow-casting/commit/6534deecdaafba2b12d4dd5085c50a62cbbda4a9))
* **web:** sign in to the hosted app at one address (hosting E3) ([#52](https://github.com/cpthirst/gangshow-casting/issues/52)) ([9e447d3](https://github.com/cpthirst/gangshow-casting/commit/9e447d3e8ee18406fbd2fe9d7bf63f86569f4772))
* **web:** step to the previous and next item from an item's page ([#31](https://github.com/cpthirst/gangshow-casting/issues/31)) ([b16d7cf](https://github.com/cpthirst/gangshow-casting/commit/b16d7cf43290dce94333dc9bfe59426d4d98967c))
* **web:** use the menu on a phone (app-shell.E1.S2) ([#5](https://github.com/cpthirst/gangshow-casting/issues/5)) ([fc3a1b7](https://github.com/cpthirst/gangshow-casting/commit/fc3a1b7fb7e9f77fc35f2c84237345025992acc1))
* **web:** view the running order (running-order.E1.S1) ([#6](https://github.com/cpthirst/gangshow-casting/issues/6)) ([3b2c5bf](https://github.com/cpthirst/gangshow-casting/commit/3b2c5bff37f45c635b509b7042c77c589717418e))


### Bug Fixes

* **infra:** deploy with pnpm infra:deploy, which reaches CDK ([#50](https://github.com/cpthirst/gangshow-casting/issues/50)) ([9fe451a](https://github.com/cpthirst/gangshow-casting/commit/9fe451af920001bb63fd429ffbbf3bfb24fb5cf4))
* **infra:** remove the temp folders the stack tests synthesise into ([#57](https://github.com/cpthirst/gangshow-casting/issues/57)) ([3feaa6a](https://github.com/cpthirst/gangshow-casting/commit/3feaa6afaa3f55dc311e02fa0ed0d0f36eec3abb))
* **web:** consistent icon buttons and no sideways scrolling on phones ([#24](https://github.com/cpthirst/gangshow-casting/issues/24)) ([f39b44f](https://github.com/cpthirst/gangshow-casting/commit/f39b44f0f92a84e7b434d489597342d14db8cbfa))
* **web:** keep Previous and Next in place while stepping through items ([#33](https://github.com/cpthirst/gangshow-casting/issues/33)) ([9829960](https://github.com/cpthirst/gangshow-casting/commit/9829960fad71fe7fc1ad29e1c046a41a31d953f9))
* **web:** keep Sign out in view on desktop and tablet ([#56](https://github.com/cpthirst/gangshow-casting/issues/56)) ([192a239](https://github.com/cpthirst/gangshow-casting/commit/192a2394939812e0e74b5d3c5f27eda796909c19))
* **web:** line up the Items list's halves and size dropdowns to their options ([#37](https://github.com/cpthirst/gangshow-casting/issues/37)) ([2d5fb1a](https://github.com/cpthirst/gangshow-casting/commit/2d5fb1a847c21c84fb009705582430b03e697ab0))
