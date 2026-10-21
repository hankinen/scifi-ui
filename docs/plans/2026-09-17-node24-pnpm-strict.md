# Node 24 and pnpm 11 Strict Migration Implementation Plan

WORK_ITEM: none
STEERING: none (docs/steering/README.md does not exist)

**Goal:** Run this monorepo on Node 24 with pnpm 11, isolated `node_modules`, and `workspace:` protocol for internal packages.
**Inputs:** User-confirmed Node 24 + pnpm 11 strict path; current npm workspaces, `package-lock.json`, Lerna 8, Turbo 2, Next 14.2 apps.
**Scope Boundaries:**
- In scope: Node 24 pin, pnpm 11 workspace, `workspace:` internal deps, CI/docs/scripts, lockfile migration, install/build/test, phantom-dependency fixes required to pass those commands.
- Out of scope: Next/TypeScript/Webpack upgrades, React 19, published package `engines` on npm, shamefully-hoist compatibility mode, git commit unless later requested.
**Assumptions:** Node 24 can be installed via `n` or a user-local prefix. pnpm 11 is used through Corepack. Lerna remains the publisher with `npmClient: pnpm`.

## Task List

### Task 1: Pin Node 24 and install the runtime

**Files:**
- Modify: `.nvmrc`
- Modify: `package.json`
- Modify: `README.md`

**Steps:**
1. Set `.nvmrc` to `v24`.
2. Set root `package.json` `engines.node` to `24` and add `engines.pnpm` to `>=11 <12`.
3. Install Node 24 with `n` (or `N_PREFIX` if `/usr/local` is not writable) and put it first on `PATH`.

**Verification:**
- Run: `node -v && python3 - <<'PY'\nimport json,pathlib\np=json.loads(pathlib.Path('package.json').read_text())\nprint(p['engines']['node'])\nprint(pathlib.Path('.nvmrc').read_text().strip())\nPY`
- Expect: Node reports `v24.x.x`; engines and `.nvmrc` are `24` / `v24`.

**Dependencies:** none
**Output:** Local Node 24 runtime and pinned engine files.

### Task 2: Switch the workspace to pnpm 11

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `lerna.json`
- Modify: `.npmrc`
- Modify: `.gitignore`

**Steps:**
1. Create `pnpm-workspace.yaml` with `packages: ["apps/*", "packages/*"]`.
2. Remove root `workspaces` and set `packageManager` to a pinned `pnpm@11.x.x` resolved from Corepack/npm.
3. Set `lerna.json` `npmClient` to `pnpm`.
4. Keep `.npmrc` `engine-strict=true`; do not add `shamefully-hoist=true`.
5. Ignore `package-lock.json` leftovers if needed; keep `pnpm-lock.yaml` tracked.

**Verification:**
- Run: `test -f pnpm-workspace.yaml && rg -n "npmClient|packageManager|packages:" lerna.json package.json pnpm-workspace.yaml`
- Expect: workspace file exists; `packageManager` starts with `pnpm@11`; Lerna uses pnpm.

**Dependencies:** Task 1
**Output:** pnpm workspace configuration without npm workspaces.

### Task 3: Convert internal dependencies to workspace protocol

**Files:**
- Modify: `packages/*/package.json`
- Modify: `apps/*/package.json`

**Steps:**
1. Collect workspace package names from `packages/*/package.json` and `apps/*/package.json`.
2. Rewrite matching `dependencies` / `devDependencies` / `peerDependencies` from `^1.0.0-next.*` to `workspace:^`.
3. Leave third-party registry dependencies unchanged.

**Verification:**
- Run: `rg -n '"(@arwes/|arwes)": "\\^1\\.0\\.0-next' packages apps --glob package.json; rg -n 'workspace:\\^' packages apps --glob package.json | head`
- Expect: no remaining `^1.0.0-next` specs on internal package names; `workspace:^` present.

**Dependencies:** Task 2
**Output:** Strict workspace-linked internal packages.

### Task 4: Replace npm commands in scripts and docs

**Files:**
- Modify: `package.json`
- Modify: `packages/*/package.json`
- Modify: `.husky/pre-push`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `static/assets/community/apps/README.md`
- Modify: `scripts/pkg-build-esm.sh`
- Modify: `scripts/pkg-build-cjs.sh`
- Modify: `apps/perf/scripts/dev.sh`
- Modify: `apps/perf/scripts/build.sh`

**Steps:**
1. Change root scripts from `npm run` to `pnpm` / `pnpm run`.
2. Change package `build` scripts from `npm run build-esm && npm run build-cjs` to `pnpm run build-esm && pnpm run build-cjs`.
3. Change husky pre-push to `pnpm integration`.
4. Update CI to Node 24, `pnpm/action-setup`, `cache: pnpm`, and `pnpm install --frozen-lockfile`.
5. Replace README / community docs `npm` / `npx` workflow commands with `pnpm` equivalents.
6. Change `npx tsc` / `npx webpack` / `npx cross-env` in shell scripts to `pnpm exec`.

**Verification:**
- Run: `rg -n "npm run |npm install|npx |node-version: 20|Node\\.js v20" package.json packages apps scripts .husky .github README.md static/assets/community/apps/README.md --glob '!package-lock.json'`
- Expect: no remaining npm workflow commands in those paths except historical comments if any.

**Dependencies:** Task 3
**Output:** All developer and CI entrypoints use pnpm and Node 24.

### Task 5: Generate the pnpm lockfile

**Files:**
- Create: `pnpm-lock.yaml`
- Delete: `package-lock.json`

**Steps:**
1. Enable Corepack and activate the pinned pnpm 11 version.
2. Remove existing `node_modules`.
3. Run `pnpm import` if `package-lock.json` still exists, then `pnpm install`.
4. Delete `package-lock.json` after a successful pnpm lockfile exists.

**Verification:**
- Run: `test -f pnpm-lock.yaml && test ! -f package-lock.json && pnpm -v`
- Expect: pnpm 11.x, lockfile present, npm lockfile gone.

**Dependencies:** Task 4
**Output:** Committable `pnpm-lock.yaml` and a pnpm `node_modules` tree.

### Task 6: Fix strict-resolver breakages and verify the toolchain

**Files:**
- Modify: relevant `package.json` files only if install/build/test reports missing dependencies
- Modify: `.npmrc` only if a documented pnpm 11 setting is required and is not hoist-all

**Steps:**
1. Run `pnpm install` and record any peer or missing-dependency errors.
2. Add missing direct dependencies to the package that imports them; do not enable `shamefully-hoist`.
3. Run `pnpm build`.
4. Run `pnpm format-check`, `pnpm lint-js`, `pnpm lint-md`, and `pnpm test -- --run`.

**Verification:**
- Run: `pnpm build && pnpm format-check && pnpm lint-js && pnpm lint-md && pnpm test -- --run`
- Expect: each command exits 0.

**Dependencies:** Task 5
**Output:** Node 24 + pnpm 11 workspace that installs, builds, lints, and tests.

## Execution Handoff

ROUTE: plan continues current-session execution after this plan is written and structure-checked. No separate executor is required. Stop only if Node 24 cannot be installed or install/build/test is blocked by an environment limit.

## Status Sync Suggestion

No work item file exists. Do not create a ledger entry unless the user asks.
