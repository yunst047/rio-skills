# GitHub Actions (`.github/workflows/*.yml`)

Action versions shown are majors the author last verified; pin to a full commit SHA in real repos and let Dependabot/Renovate bump them.

## Skeleton

```yaml
name: mobile

on:
  pull_request:
  push:
    branches: [main]
    tags: ["v*"]
  schedule:
    - cron: "17 19 * * *"          # 02:17 Asia/Jakarta (UTC+7) — cron is UTC
  workflow_dispatch:
    inputs:
      environment:
        description: Target environment
        type: environment
        required: true
      play_track:
        description: Google Play track
        type: choice
        options: [internal, alpha, beta, production]
        default: internal
      rollout:
        description: Staged rollout fraction
        type: choice
        options: ["0.01", "0.05", "0.2", "1.0"]
        default: "0.05"
      dry_run:
        type: boolean
        default: true

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}   # cancel superseded PR runs only

jobs:
  unit:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: "17", cache: gradle }
      - run: ./gradlew testDebugUnitTest
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: unit-reports
          path: app/build/test-results/
          retention-days: 7

  build-android:
    needs: unit
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew bundleRelease
      - uses: actions/upload-artifact@v4
        with:
          name: aab
          path: app/build/outputs/bundle/release/app-release.aab
          retention-days: 7

  e2e-android:
    needs: build-android
    runs-on: ubuntu-24.04
    strategy:
      fail-fast: false
      matrix:
        api-level: [30, 34]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: aab, path: dist }
      - run: ./ci/run-e2e.sh ${{ matrix.api-level }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: e2e-reports-${{ matrix.api-level }}     # unique name per matrix leg (required in v4)
          path: e2e-results/

  deploy-internal:
    needs: [e2e-android]
    if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-24.04
    environment: release                                 # protection rules + environment secrets
    concurrency:
      group: play-release
      cancel-in-progress: false                          # queue; never kill a running upload
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: aab, path: dist }
      - run: bundle exec fastlane android internal
        env:
          PLAY_TRACK: ${{ inputs.play_track || 'internal' }}
```

## Sequencing

- Jobs run **in parallel by default**; `needs:` makes the DAG. A job with `needs: [a, b]` is the fan-in.
- `strategy.matrix` fans out; `max-parallel` caps it; `fail-fast: false` keeps other legs running.
- Conditions on upstream outcome: `if: ${{ always() }}`, `failure()`, `!cancelled()`, `needs.build.result == 'success'`.
- Pass small values between jobs with `outputs:` (`echo "version=5.1.0" >> "$GITHUB_OUTPUT"`); pass files with artifacts.

## Concurrency rules

- Workflow-level `concurrency` with `cancel-in-progress: true` only for PR validation.
- Deploy jobs: their own `concurrency.group` per environment with `cancel-in-progress: false`. Note: a group holds **one running + one pending**; a newer pending run replaces the older *pending* one (the running one is untouched). If every deploy must run, serialise by environment protection or a queue instead.
- Devices: `concurrency: { group: device-pixel8, cancel-in-progress: false }`.

## Reuse

**Reusable workflow** (`.github/workflows/android-build.yml` in a templates repo):

```yaml
on:
  workflow_call:
    inputs:
      module: { type: string, default: app }
    secrets:
      KEYSTORE_B64: { required: true }
    outputs:
      aab-artifact:
        value: ${{ jobs.build.outputs.artifact }}

jobs:
  build:
    runs-on: ubuntu-24.04
    outputs:
      artifact: aab-${{ github.run_id }}
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew :${{ inputs.module }}:bundleRelease
```

Caller: `jobs: build: uses: org/ci-templates/.github/workflows/android-build.yml@v1.4.0` with `with:` and `secrets: inherit` (or explicit secrets).

**Composite action** (`.github/actions/setup-mobile/action.yml`) for repeated *steps*:

```yaml
name: setup-mobile
runs:
  using: composite
  steps:
    - uses: actions/setup-java@v4
      with: { distribution: temurin, java-version: "17", cache: gradle }
    - uses: ruby/setup-ruby@v1
      with: { bundler-cache: true }
```

Use: `- uses: ./.github/actions/setup-mobile`.

## Artifacts vs cache

- `actions/upload-artifact` / `download-artifact` v4: artifacts are immutable and names must be unique within a run; download several with `pattern: e2e-reports-*` and `merge-multiple: true`.
- `actions/cache` (or the `cache:` input of setup actions) for dependencies only.
- Cross-workflow hand-off: `download-artifact` with `run-id` + `github-token`, or publish to a registry/release.

## Schedules

`on.schedule` in YAML, UTC, default branch only, best-effort timing; public repos auto-disable scheduled workflows after 60 days without activity. Distinguish multiple crons with `github.event.schedule`:

```yaml
jobs:
  nightly-e2e:
    if: github.event.schedule == '17 19 * * *'
    runs-on: ubuntu-24.04
    steps:
      - run: echo nightly
```
