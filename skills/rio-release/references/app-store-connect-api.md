# App Store Connect API and TestFlight

## API key

- App Store Connect → Users and Access → Integrations → **Team keys**. Generate a key with the minimum role (App Manager for uploads and TestFlight; Developer is not enough for some release actions).
- You receive a `.p8` file (downloadable **once**), a **Key ID** and the team **Issuer ID**.
- Store per `rio-secrets`: `.p8` as a file secret; Key ID and Issuer ID as variables.
- Requests use a JWT signed **ES256** with the `.p8`, `aud: appstoreconnect-v1`, lifetime at most 20 minutes. fastlane's `app_store_connect_api_key` builds it for you.

## Upload paths

| Path | When |
|---|---|
| fastlane `upload_to_testflight` / `upload_to_app_store` with `api_key` | Default |
| `xcrun altool --upload-app` with `--apiKey` / `--apiIssuer` | Minimal setup without fastlane |
| Transporter (`iTMSTransporter`) | Large-scale or metadata-heavy pipelines |
| Xcode Cloud | Apple-hosted; distribution configured in App Store Connect, not YAML |

## Signing on CI

- Temporary keychain per job (`setup_ci`), certificates/profiles from **match** in readonly mode, or Xcode **automatic signing with the API key** (`-allowProvisioningUpdates -authenticationKeyPath ... -authenticationKeyID ... -authenticationKeyIssuerID ...` on `xcodebuild`).
- Export options plist in the repo (no secrets in it): method `app-store` (newer Xcode names it `app-store-connect`), team id, provisioning profile mapping for manual signing.
- Delete the keychain and decoded key files in cleanup.

## TestFlight

- Internal testers (team members) get builds after processing, no review.
- External groups need **Beta App Review** for the first build of a version; plan the delay.
- `skip_waiting_for_build_processing: true` frees the macOS runner; a separate cheap Linux job can poll status through the API if a later step needs the processed build.

## Release

- `deliver` submits for review with metadata; keep metadata in `fastlane/metadata` under version control.
- **Phased release** for automatic updates over 7 days; can be paused (up to a total pause limit) and released to all.
- Export compliance and content rights answers must be set (via Info.plist `ITSAppUsesNonExemptEncryption` or submission info), or the submission stalls.
- Rollback does not exist: pause phased release, fix forward, request expedited review if critical.
