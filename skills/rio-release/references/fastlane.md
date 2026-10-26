# fastlane in CI

## Setup

```ruby
# Gemfile
source "https://rubygems.org"
gem "fastlane"
plugins_path = File.join(File.dirname(__FILE__), "fastlane", "Pluginfile")
eval_gemfile(plugins_path) if File.exist?(plugins_path)
```

Commit `Gemfile.lock`. CI runs `bundle install` (cache `vendor/bundle`) then `bundle exec fastlane <platform> <lane>`.

Directory: `fastlane/Fastfile`, `fastlane/Appfile` (bundle id / package name, team id), `fastlane/Matchfile`, `fastlane/Pluginfile` (e.g. `gem 'fastlane-plugin-firebase_app_distribution'`).

Environment: set `FASTLANE_SKIP_UPDATE_CHECK=1`, `FASTLANE_HIDE_CHANGELOG=1`, `CI=true`, and `LC_ALL=en_US.UTF-8` / `LANG=en_US.UTF-8` on runners.

## Key actions

| Action (alias) | Does |
|---|---|
| `setup_ci` | Creates a temporary keychain on CI (iOS) and sets match to readonly mode |
| `app_store_connect_api_key` | Loads the `.p8` key for all App Store Connect actions |
| `match` (`sync_code_signing`) | Fetches certs/profiles from an encrypted git repo, S3 or GCS |
| `increment_build_number` / `increment_version_code` (plugin) | Sets the build number from CI |
| `build_app` (`gym`) | Archives and exports the IPA |
| `upload_to_testflight` (`pilot`) | Uploads to TestFlight, optional external groups |
| `upload_to_app_store` (`deliver`) | Metadata, screenshots, submission |
| `gradle` | Runs Gradle tasks (`bundleRelease`) |
| `upload_to_play_store` (`supply`) | Uploads AAB/metadata, sets track and rollout |
| `firebase_app_distribution` (plugin) | Distributes to tester groups |

## Example Fastfile

```ruby
default_platform(:ios)

platform :ios do
  before_all do
    setup_ci if ENV["CI"]
  end

  lane :beta do
    api_key = app_store_connect_api_key(
      key_id: ENV["ASC_KEY_ID"],
      issuer_id: ENV["ASC_ISSUER_ID"],
      key_filepath: ENV["ASC_KEY_PATH"]          # file-type CI variable
    )
    match(type: "appstore", readonly: true, api_key: api_key)
    increment_build_number(build_number: ENV["BUILD_NUMBER"])
    build_app(scheme: "App", export_method: "app-store")
    upload_to_testflight(api_key: api_key, skip_waiting_for_build_processing: true)
  end
end

platform :android do
  lane :internal do
    gradle(
      task: "bundle", build_type: "Release",
      properties: {
        "android.injected.signing.store.file" => ENV["KEYSTORE_PATH"],
        "android.injected.signing.store.password" => ENV["KEYSTORE_PASSWORD"],
        "android.injected.signing.key.alias" => ENV["KEY_ALIAS"],
        "android.injected.signing.key.password" => ENV["KEY_PASSWORD"]
      }
    )
    upload_to_play_store(
      track: "internal",
      json_key: ENV["PLAY_JSON_PATH"],            # file-type CI variable
      skip_upload_metadata: true, skip_upload_images: true, skip_upload_screenshots: true
    )
  end

  lane :promote do |options|
    upload_to_play_store(
      track: "internal", track_promote_to: "production",
      rollout: options[:rollout] || "0.05",
      json_key: ENV["PLAY_JSON_PATH"],
      skip_upload_aab: true, skip_upload_metadata: true, skip_upload_images: true, skip_upload_screenshots: true
    )
  end
end
```

`promote` reuses the build already on internal — build once, promote.

## match

- Storage: private git repo (`git_url`), Google Cloud Storage or S3; encrypted with `MATCH_PASSWORD`.
- CI: always `readonly: true`. Regeneration (`match nuke` / new profiles) is a manual admin task — confirm with Sensei.
- Add new device UDIDs → `match(type: "development", force_for_new_devices: true)` from an admin machine.
- Schedule a weekly job that checks certificate and profile expiry and alerts at under 30 days.

## Flutter / React Native

- Flutter: build with `flutter build appbundle` / `flutter build ipa --export-options-plist=...`, then fastlane only for upload; or call `gradle`/`build_app` on the native projects.
- React Native: fastlane lanes live in `ios/fastlane` and `android/fastlane`, or one root Fastfile with `project_dir` settings.
