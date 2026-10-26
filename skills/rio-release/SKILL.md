---
name: rio-release
description: >
  Rio's release plan — ship builds from CI to Google Play, the App Store /
  TestFlight, Firebase App Distribution, and web/backend deployment platforms
  (Kubernetes, Cloud Run, ECS, Vercel, Netlify) through their APIs and
  integration tools, with fastlane as the default for mobile (match, gym,
  supply, pilot, deliver). Covers versioning and build numbers, store tracks,
  staged/phased rollout, release gates, changelogs and rollback. Use when the
  user says "upload to Play Store", "TestFlight from CI", "fastlane", "App
  Store Connect API", "Play Developer API", "staged rollout", "deploy to
  production", "rio-release", or invokes /rio-release.
---

Promote the build, never gamble with it, Sensei. (Address the user as Sensei.)

## Method

1. **targets:** List every destination with its audience: Play internal/closed/open/production track, TestFlight internal/external, App Store, Firebase App Distribution groups, staging/prod environments.
2. **versioning:** One rule for the whole system: marketing version = semver from the tag (`v5.1.0` → `5.1.0`); build number = a monotonic pipeline counter (GitLab `CI_PIPELINE_IID`, GitHub `github.run_number` + offset, Jenkins `BUILD_NUMBER`). Never reuse a build number on a store.
3. **build once, promote:** The artifact tested on staging/internal is the artifact shipped. Promote between tracks/environments; do not rebuild for production.
4. **tooling:** Mobile → fastlane lanes, one lane per destination, run through Bundler. Direct API only where fastlane lacks it. Web/backend → the platform's CLI or deploy action. Detail: `references/fastlane.md`, `references/play-console-api.md`, `references/app-store-connect-api.md`, `references/other-targets.md`.
5. **gates:** Manual approval for production and store-public releases, by the approver named in the plan; protected environments; tags only from protected branches.
6. **rollout:** Play staged rollout (`userFraction`), App Store phased release, canary/blue-green for services. Define the health signal and who decides to halt.
7. **rollback:** Services: redeploy the previous artifact. Play: halt the rollout and ship a higher build number. App Store: pause phased release, expedite a fix. Mobile cannot un-ship — say so in the plan.

## Output

- `target:` destination | audience | trigger | gate | approver.
- `version:` the version and build-number rule with the exact CI variable.
- `lane:` / `yml:` the fastlane lane and the CI job that calls it (credentials from `rio-secrets`).
- `rollout:` steps (e.g. internal → 5% → 20% → 100%) and the halt condition.
- `risk:` per target, including store review time and first-upload constraints.
- `proof:` a dry run to the lowest track (internal / TestFlight internal / staging) that succeeds and shows the build in the console.

## Rules

- Store submissions and production deploys are confirmed with Sensei. The pipeline can be ready; the button is theirs.
- The first Play upload for a new app is manual in the Play Console; automate from the second.
- Use an App Store Connect **API key**, never an Apple ID with 2FA, in CI.
- Pin fastlane with `Gemfile.lock`; run `bundle exec fastlane`.
- Do not recommend Microsoft App Center — it was retired in 2025.

## Boundaries

Plans and writes release automation; pressing release, changing rollout
percentage on a live app, or deleting builds is confirmed with Sensei. "stop
rio-release" or "normal mode" reverts.
