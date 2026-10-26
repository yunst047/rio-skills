# Azure Pipelines (`azure-pipelines.yml`)

```yaml
trigger:
  branches:
    include: [main]
  tags:
    include: ["v*"]

pr:
  branches:
    include: [main]

schedules:
  - cron: "17 19 * * *"            # UTC
    displayName: Nightly regression
    branches:
      include: [main]
    always: true                   # run even if nothing changed

parameters:                        # rendered as dropdowns / checkboxes on "Run pipeline"
  - name: deployEnv
    displayName: Target environment
    type: string
    default: staging
    values: [staging, production]
  - name: playTrack
    type: string
    default: internal
    values: [internal, alpha, beta, production]
  - name: dryRun
    type: boolean
    default: true

resources:
  repositories:
    - repository: templates
      type: git
      name: Platform/ci-templates
      ref: refs/tags/v1.4.0

stages:
  - stage: Test
    jobs:
      - job: Unit
        pool: { vmImage: ubuntu-latest }
        steps:
          - template: steps/setup-android.yml@templates
          - script: ./gradlew testDebugUnitTest
          - task: PublishTestResults@2
            condition: succeededOrFailed()
            inputs:
              testResultsFiles: "**/test-results/**/*.xml"

  - stage: Build
    dependsOn: Test
    jobs:
      - job: Android
        pool: { name: linux-build }
        steps:
          - script: ./gradlew bundleRelease
          - publish: app/build/outputs/bundle/release
            artifact: aab
      - job: iOS                     # runs in parallel with Android (no dependsOn between them)
        pool:
          name: mac-pool
          demands: [xcode -equals 16]
        steps:
          - script: bundle exec fastlane ios build
          - publish: build
            artifact: ipa

  - stage: E2E
    dependsOn: Build
    jobs:
      - job: Android
        strategy:
          matrix:
            api30: { API_LEVEL: "30" }
            api34: { API_LEVEL: "34" }
        pool: { name: android-emulator }
        steps:
          - download: current
            artifact: aab
          - script: ./ci/run-e2e.sh $(API_LEVEL)

  - stage: Release
    dependsOn: E2E
    condition: and(succeeded(), startsWith(variables['Build.SourceBranch'], 'refs/tags/v'))
    jobs:
      - deployment: Play
        environment: play-release    # approvals + Exclusive lock check configured on the environment
        pool: { name: deploy-prod }
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: aab
                - script: bundle exec fastlane android internal
                  env:
                    PLAY_TRACK: ${{ parameters.playTrack }}
```

- Stages are sequential by default (each depends on the previous); `dependsOn: []` makes a stage start immediately; jobs in a stage run in parallel unless `dependsOn` links them.
- Templates: `template: file.yml@repo` for stages, jobs, steps or variables; `extends:` a template to enforce a required structure.
- Concurrency: environment **Exclusive lock** check — one deployment at a time; set `lockBehavior: sequential` (all queued runs deploy in order) or `runLatest` (only the newest queued run deploys; the running one is not cancelled).
- Artifacts: `publish` / `download` (pipeline artifacts) for hand-off; `Cache@2` task for dependencies.
- Schedules defined in YAML override UI schedules for that pipeline.
