# Mobile CI services: Bitrise, Codemagic, Xcode Cloud

Choose them when macOS capacity and signing integration matter more than owning runners. Step and action versions change often — pin to the current major the service's step library shows.

## Bitrise (`bitrise.yml`)

```yaml
format_version: "13"
default_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git
project_type: flutter

app:
  envs:
    - BITRISE_PROJECT_PATH: ios/Runner.xcworkspace
    - BITRISE_SCHEME: Runner

workflows:
  _setup:                                   # utility workflow, reused via before_run
    steps:
      - git-clone: {}
      - flutter-installer: {}

  test:
    before_run: [_setup]
    steps:
      - flutter-test: {}
      - deploy-to-bitrise-io: {}             # uploads test results + artifacts

  release-ios:
    before_run: [_setup]
    steps:
      - manage-ios-code-signing: {}          # uses the App Store Connect API connection set in the app settings
      - flutter-build:
          inputs:
            - platform: ios
      - xcode-archive:
          inputs:
            - distribution_method: app-store
      - deploy-to-itunesconnect-deliver: {}
```

- `before_run` / `after_run` chain workflows (reuse); **Pipelines** (stages/workflows with dependencies) give parallel workflows across VMs with artifact sharing between them.
- Triggers (push / PR / tag) and **scheduled builds** are configured in the app settings or the `trigger_map` / `triggers` section.
- Secrets in the Secrets tab (not exposed to PRs from forks by default); code signing files in the Code Signing tab.
- Validate locally: `bitrise validate`; run locally: `bitrise run test`.

## Codemagic (`codemagic.yaml`)

```yaml
workflows:
  ios-release:
    name: iOS release
    instance_type: mac_mini_m2
    max_build_duration: 60
    integrations:
      app_store_connect: ASC Team Key        # API key registered in Codemagic team settings
    environment:
      ios_signing:
        distribution_type: app_store
        bundle_identifier: com.example.app
      flutter: stable
      xcode: latest
    triggering:
      events: [tag]
      tag_patterns:
        - pattern: "v*"
    scripts:
      - name: Install
        script: flutter pub get
      - name: Build IPA
        script: flutter build ipa --export-options-plist=/Users/builder/export_options.plist
    artifacts:
      - build/ios/ipa/*.ipa
    publishing:
      app_store_connect:
        auth: integration
        submit_to_testflight: true
```

- Android: a sibling workflow with `publishing: google_play: { credentials: $GCLOUD_SERVICE_ACCOUNT_CREDENTIALS, track: internal }`, credentials in an environment group defined in the UI.
- Reuse with YAML anchors and `definitions:` at the top of the file.
- Manual builds can take **inputs** (check current docs for the `inputs` syntax and supported types) for track/environment choices.
- Scheduled builds are configured in the app settings.

## Xcode Cloud

- Configured in Xcode (Product → Xcode Cloud → Create Workflow) and App Store Connect — **no YAML** in the repo.
- Workflows: start conditions (branch, PR, tag, **schedule**), environment (Xcode/macOS version), actions (build, test, analyze, archive), post-actions (TestFlight internal/external, notify).
- Custom scripts in `ci_scripts/` at the repo root (executable):
  - `ci_post_clone.sh` — install tools (e.g. Flutter, CocoaPods `pod install`).
  - `ci_pre_xcodebuild.sh` — set build number from `$CI_BUILD_NUMBER`, generate config.
  - `ci_post_xcodebuild.sh` — upload dSYMs, notify.
- Secrets: environment variables marked secret in the workflow settings.
- Signing is automatic (cloud-managed). Test destinations are simulators chosen in the workflow.
- Use it for Apple-only pipelines; for Android in the same release flow, pair it with another CI and coordinate via tags.
