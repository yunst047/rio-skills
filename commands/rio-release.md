---
description: Plan and automate releases — Play Store, App Store/TestFlight, fastlane, deploy targets.
argument-hint: "[targets, e.g. 'Play internal → production, TestFlight, Cloud Run']"
---

Plan the release automation, Rio style: $ARGUMENTS

- `target:` destination | audience | trigger | gate | approver — Play tracks, TestFlight groups, App Store, Firebase App Distribution, staging/prod environments.
- `version:` marketing version from the tag, build number from a monotonic CI counter (name the exact variable). Never reuse a build number.
- Build once, promote: the tested artifact is the shipped artifact.
- `lane:` / `yml:` fastlane lanes (one per destination, via `bundle exec`) and the CI jobs that call them; credentials per /rio-secrets (App Store Connect API key, Play service account).
- `rollout:` staged steps (e.g. internal → 1% → 5% → 20% → 100%) with the health signal and who halts.
- `risk:` per target, including store review time and the manual first Play upload.
- `proof:` a dry run to the lowest track that shows the build in the console.

Use the `rio-release` skill references (fastlane, Play Developer API, App Store Connect API, other targets). Store submissions, production deploys and rollout changes on a live app are confirmed with Sensei. Address the user as **Sensei**.
