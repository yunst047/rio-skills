# Bitbucket Pipelines and CircleCI

## Bitbucket Pipelines (`bitbucket-pipelines.yml`)

```yaml
image: eclipse-temurin:17

definitions:
  caches:
    gradle-wrapper: ~/.gradle/wrapper
  steps:
    - step: &unit
        name: Unit tests
        caches: [gradle, gradle-wrapper]
        script:
          - ./gradlew testDebugUnitTest
        # JUnit XML under test-results/ or test-reports/ is picked up automatically
    - step: &build-android
        name: Build Android
        script:
          - ./gradlew bundleRelease
        artifacts:                       # passed to all later steps in this pipeline
          - app/build/outputs/bundle/release/*.aab

pipelines:
  pull-requests:
    "**":
      - step: *unit
  branches:
    main:
      - step: *unit
      - parallel:
          - step: *build-android
          - step:
              name: Build iOS
              runs-on: [self.hosted, macos]
              script:
                - bundle exec fastlane ios build
      - step:
          name: Deploy internal
          deployment: release            # deployment environments serialise deploys per environment
          trigger: manual
          oidc: true
          script:
            - bundle exec fastlane android internal
  custom:                                # run from the UI, optionally on a schedule
    release:
      - variables:
          - name: PLAY_TRACK
            default: internal
            allowed-values: [internal, alpha, beta, production]   # dropdown
      - step:
          name: Release
          deployment: production
          script:
            - bundle exec fastlane android promote track:$PLAY_TRACK
```

- YAML anchors are the reuse mechanism within the file; shared configuration across repos is available on some plans (check your workspace).
- Steps run sequentially; `parallel:` groups run together; `stage:` groups steps sharing a deployment.
- Schedules: Repository settings → Pipelines → Schedules, pointing at a branch pipeline or a `custom` pipeline.
- Artifacts declared on a step flow to subsequent steps; use `download: false` on steps that don't need them.

## CircleCI (`.circleci/config.yml`)

```yaml
version: 2.1

parameters:                              # pipeline parameters: set via API / UI trigger / schedule
  run-nightly:
    type: boolean
    default: false
  play-track:
    type: enum
    enum: [internal, alpha, beta, production]
    default: internal

executors:
  android:
    docker:
      - image: cimg/android:2024.01
    resource_class: large
  macos:
    macos:
      xcode: "16.2"

commands:
  setup-ruby:
    steps:
      - run: bundle install --path vendor/bundle

jobs:
  unit:
    executor: android
    steps:
      - checkout
      - run: ./gradlew testDebugUnitTest
      - store_test_results:
          path: app/build/test-results
  build-android:
    executor: android
    steps:
      - checkout
      - run: ./gradlew bundleRelease
      - persist_to_workspace:            # hand-off to downstream jobs in the workflow
          root: .
          paths: [app/build/outputs/bundle/release]
  deploy-internal:
    executor: android
    steps:
      - checkout
      - attach_workspace: { at: . }
      - setup-ruby
      - run: bundle exec fastlane android internal track:<< pipeline.parameters.play-track >>

workflows:
  main:
    when:
      not: << pipeline.parameters.run-nightly >>
    jobs:
      - unit
      - build-android:
          requires: [unit]
      - hold:
          type: approval
          requires: [build-android]
      - deploy-internal:
          requires: [hold]
          context: [play-release]
          serial-group: << pipeline.project.slug >>/play-release   # serialise deploys across pipelines
  nightly:
    when: << pipeline.parameters.run-nightly >>
    jobs:
      - unit
```

- `requires:` builds the DAG; jobs without it run in parallel. `matrix:` on a workflow job fans out.
- Workspaces (`persist_to_workspace` / `attach_workspace`) pass files between jobs; `store_artifacts` keeps files for download; caches (`save_cache` / `restore_cache`) for speed.
- Scheduled pipelines / triggers are configured in project settings with parameter values (e.g. `run-nightly: true`).
- `serial-group` serialises jobs across pipelines; confirm availability on your plan, otherwise use an external lock.
- Orbs give versioned reusable config (`orbs: android: circleci/android@x.y`).
