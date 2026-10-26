# GitLab CI (`.gitlab-ci.yml`)

## Skeleton with reuse

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_PIPELINE_SOURCE == "web"
  auto_cancel:
    on_new_commit: interruptible      # cancel only jobs marked interruptible

stages: [lint, test, build, e2e, deploy]

default:
  interruptible: true                 # safe default; deploy jobs override to false
  retry:
    max: 1
    when: [runner_system_failure, stuck_or_timeout_failure]   # infra only, never script_failure
  timeout: 30m

variables:
  GRADLE_USER_HOME: $CI_PROJECT_DIR/.gradle

include:
  - local: ci/android.yml
  - project: group/ci-templates
    ref: v1.4.0
    file: /templates/fastlane.yml

.android_base:
  image: ghcr.io/cirruslabs/android-sdk:34
  tags: [linux-build]
  cache:
    key:
      files: [gradle/wrapper/gradle-wrapper.properties, gradle/libs.versions.toml]
    paths: [.gradle/caches, .gradle/wrapper]
    policy: pull

.ios_base:
  tags: [macos-xcode-16]
  before_script:
    - bundle install --path vendor/bundle
```

- `extends: .android_base` merges the hidden job into the job (deep merge of hashes; arrays are replaced).
- `!reference [.ios_base, before_script]` reuses one key — useful to combine script lists:

```yaml
.setup_ruby:
  script:
    - bundle install --path vendor/bundle

build:ios:
  extends: .ios_base
  stage: build
  script:
    - !reference [.setup_ruby, script]
    - bundle exec fastlane ios build
```

- YAML anchors (`&x` / `<<: *x`) work only inside one file; prefer `extends` / `!reference`, which work across `include`.
- CI/CD components with typed inputs:

```yaml
include:
  - component: $CI_SERVER_FQDN/group/components/android-build@1.4.0
    inputs:
      api_level: "34"
      module: app
```

## Linear, parallel and DAG

```yaml
test:unit:
  extends: .android_base
  stage: test
  needs: []                        # start immediately, do not wait for lint stage
  script: ./gradlew testDebugUnitTest
  artifacts:
    when: always
    reports:
      junit: app/build/test-results/testDebugUnitTest/*.xml

build:android:
  extends: .android_base
  stage: build
  needs: [test:unit]               # DAG: only waits for unit tests
  script: ./gradlew bundleRelease
  artifacts:
    paths: [app/build/outputs/bundle/release/app-release.aab]
    expire_in: 7 days

e2e:android:
  stage: e2e
  tags: [android-emulator]
  needs:
    - job: build:android
      artifacts: true              # hand-off across runners via the artifact store
  parallel:
    matrix:
      - API_LEVEL: ["30", "34"]
  script: ./ci/run-e2e.sh "$API_LEVEL"
  artifacts:
    when: always
    reports:
      junit: e2e-results/*.xml
```

- Jobs in the same stage run in parallel (subject to runner capacity).
- `needs: []` decouples a job from stage order; `needs:` lists make a DAG; jobs without `needs` wait for all previous stages.
- `dependencies: []` stops downloading artifacts a job doesn't need (default downloads all from previous stages).
- `needs:` can reference `parallel:matrix` jobs: `needs: [{ job: e2e:android, parallel: { matrix: [{ API_LEVEL: "34" }] } }]`.

## Concurrency without destroying running jobs

```yaml
deploy:production:
  stage: deploy
  tags: [deploy-prod]
  interruptible: false             # never auto-cancelled by a newer pipeline
  resource_group: production       # one at a time; others queue, none is killed
  environment:
    name: production
    url: https://app.example.com
  rules:
    - if: $CI_COMMIT_TAG
      when: manual
  script: ./ci/deploy.sh
```

- `resource_group` queues jobs; set the group's process mode (`unordered`, `oldest_first`, `newest_first`, `newest_ready_first`) via the API when order matters.
- Auto-cancel (`workflow:auto_cancel:on_new_commit: interruptible`) only touches jobs that are `interruptible: true` — keep deploys `false`.
- Physical devices: `resource_group: device-pixel8` on each job that uses that device.

## Artifacts vs cache

| | artifacts | cache |
|---|---|---|
| Purpose | Results and hand-off between jobs/runners | Speed (dependencies) |
| Guaranteed | Yes, within `expire_in` | No — best effort |
| Cross-runner | Yes (GitLab artifact store) | Only with distributed cache |
| Reports | `artifacts:reports:junit`, `coverage_report`, `dotenv` | — |

Pass values between jobs with `artifacts:reports:dotenv` (e.g. computed `VERSION=5.1.0`).

## Dropdown variables (Run pipeline form)

```yaml
variables:
  DEPLOY_ENV:
    value: "staging"
    options: ["staging", "production"]
    description: "Target environment for manual runs"
  PLAY_TRACK:
    value: "internal"
    options: ["internal", "alpha", "beta", "production"]
    description: "Google Play track"
  ROLLOUT:
    value: "0.05"
    options: ["0.01", "0.05", "0.2", "1.0"]
    description: "Staged rollout fraction"
```

`value` must be one of `options`. These appear as dropdowns when running a pipeline from the UI (Build → Pipelines → Run pipeline). For includes/components, `spec: inputs: <name>: options: [...]` gives typed inputs.

## Schedules

Created in Build → Pipeline schedules (cron + timezone + branch + variables), or via API. Gate jobs:

```yaml
nightly:e2e:
  extends: .android_base
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule" && $SCHEDULE_KIND == "nightly"
  script: ./ci/run-e2e.sh all
```

Exclude heavy jobs from schedules they don't belong to with `- if: $CI_PIPELINE_SOURCE == "schedule"` → `when: never` first in the rule list.

## Downstream pipelines

```yaml
trigger:app:
  stage: deploy
  trigger:
    project: group/mobile-app
    branch: main
    strategy: depend
  variables:
    API_VERSION: $CI_COMMIT_TAG
```
