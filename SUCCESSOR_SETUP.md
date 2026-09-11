# Standalone project setup and release sequence

This project is prepared from predecessor commit `341c167b3f95809f6e40a2b11a13ea40879fecd0`, after merging PR #10 (reliability/UI/docs) and PR #11 (ALM None). It retains that Git ancestry. Its staging branch is `release/anthemreceiver-plus` in the old repository; that branch is a handoff source, not a PR to merge back into the old package's master branch.

## 1. Create the new local checkout and standalone GitHub repository

Run the supplied checkout commands on the computer where you keep development repositories, not inside the running Homebridge plugin directory. The proposed path is `~/devProjects/homebridge-anthemreceiver-plus`; the previous checkout is retained.

The checkout needs Git, Node.js, and GitHub CLI (`gh`). Authenticate `gh` to GitHub as `pponce` with `gh auth login --hostname github.com` if needed. Use the exact tested staging commit supplied with the handoff; do not silently include later branch changes.

After cloning and selecting that commit, run:

```bash
bash scripts/create-standalone-repository.sh
```

The script creates a new public repository using GitHub's normal repository-creation API, not the Fork action. It pushes the inherited commit history to `main`, enables issues, and sets the new origin. The old source remote is kept as `history-source` with pushes disabled. It does not delete or archive the old repository, copy old release tags, change the running Homebridge installation, or publish to npm.

If the target already exists, it must be a public standalone repository with no branches, or an exact repeat of the same `main` commit. Other content stops the script without a force-push. Git history is retained, but old PR conversations, issues, GitHub releases, secrets, settings and repository permissions are not copied. Those records remain in the original repository. Weekly Dependabot configuration and CI workflow files are included in the new source.

After setup, the printed repository metadata must show `fork: false`, `default_branch: main`, and `issues: true`. Check GitHub Actions. If repository access in ChatGPT is restricted to selected repositories, grant the GitHub connector access to this new repository so subsequent edits can be made there.

## 2. Verify the new repository and prepare npm access

Wait for `Build, Test and Package` to pass for the new repository's exact main commit. If GitHub asks to enable Actions, enable them and run the workflow. The four Node 22/24 × Homebridge 1/2 jobs exercise type checking, receiver tests, real-Homebridge migration, browser/theme checks and archive installation; a fifth job tests direct GitHub installation.

The candidate uses version `1.0.0-beta.1`. Name availability could not be established through the restricted preparation environment; successful GitHub creation does not reserve the npm package name. Check before publishing:

```bash
npm view homebridge-anthemreceiver-plus name version maintainers --json
```

An npm `E404` indicates the package was not found at that time; network/authentication errors do not establish availability. If another owner has published it, stop and choose a different name or resolve ownership. Authenticate to npm with `npm login` if needed. Do not use sudo for publishing from the development checkout.

## 3. Publish the beta when ready

From the new clean `main` checkout, explicitly run:

```bash
bash scripts/publish-beta.sh
```

The script requires local main to match GitHub main and a successful push or manually dispatched CI run for that commit. It installs dependencies, reruns build/runtime/migration/package checks, packs the compiled files, and publishes under npm's `beta` tag. It compares package integrity and creates a GitHub prerelease at the same commit. It does not intentionally promote the package to `latest` or install it into Homebridge. If publication succeeded but a later step failed, an identical package can be verified and the GitHub release completed on a rerun.

Normal npm authentication/2FA may prompt in your terminal. GitHub and npm credentials remain separate. The script checks `beta`, not `latest`, because this is a prerelease. It never prints authentication tokens.

## 4. Test migration on the running receiver installation

Read MIGRATION.md first. The new local development directory can coexist with the old one. Replacing the plugin in Homebridge is a separate operation and should preserve the actual host's prefix, configuration, bridge identity, accessory cache and persistence. Confirm whether the installation uses a child bridge before selecting exact host commands.

The predecessor was reported to work on the owner's MRX 540 8K. That report does not yet establish that the renamed package preserves the owner's Apple Home scenes and automations. Test those explicitly and record the result before describing migration as verified on hardware.

## 5. Stable release and Homebridge verification

After successful real migration and any fixes, choose the stable version (normally `1.0.0`), update changelog/release status, publish the tested archive under `latest`, and create its GitHub release. Do not republish an existing version. Use VERIFICATION_PREPARATION.md to prepare the Homebridge request and recheck the current requirements. No verification request is sent automatically.

Follow-up engineering: generate/review a dependency lockfile and adopt npm ci; extend hardware/child-bridge coverage. Current CI and beta publishing intentionally use the same unlocked installation approach inherited from the tested predecessor.

