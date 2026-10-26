# Google Play Developer API (Android Publisher)

## Access

1. Create a service account in a Google Cloud project and enable the **Google Play Android Developer API** there.
2. In Play Console → Users and permissions, invite the service account's email and grant only the permissions the pipeline needs (release to testing tracks; production release only if CI promotes to production).
3. Store the JSON key per `rio-secrets` (file secret, or fetched at runtime from a secret manager via OIDC). Permissions can take a while to propagate after granting.

## Constraints

- The app must exist in Play Console and the **first build must be uploaded manually** (through the Console) before the API can publish.
- New apps must use **AAB** and Play App Signing. CI signs with the **upload key**.
- `versionCode` must increase on every upload, across all tracks.
- Some new personal developer accounts must run a closed test with a minimum number of testers before production access — plan the closed track into the schedule.

## Edits flow (what fastlane `supply` does under the hood)

```
POST   /androidpublisher/v3/applications/{pkg}/edits                     → editId
POST   /upload/androidpublisher/v3/applications/{pkg}/edits/{editId}/bundles   (AAB upload) → versionCode
PUT    /androidpublisher/v3/applications/{pkg}/edits/{editId}/tracks/{track}
       { "track": "production",
         "releases": [{ "versionCodes": ["512"], "status": "inProgress", "userFraction": 0.05,
                        "releaseNotes": [{ "language": "en-US", "text": "..." }] }] }
POST   /androidpublisher/v3/applications/{pkg}/edits/{editId}:commit
```

- Tracks: `internal`, `alpha` (closed), `beta` (open), `production`, plus custom closed tracks by name.
- Release `status`: `draft`, `inProgress` (staged, needs `userFraction`), `halted`, `completed`.
- **Halt** a bad rollout: update the track with `status: "halted"`. Resume or complete with `inProgress` / `completed`.
- Edits expire if not committed; one open edit per pipeline job.

## Staged rollout plan (example)

| Step | userFraction | Wait | Halt if |
|---|---|---|---|
| 1 | 0.01 | 24 h | crash-free users drops below target, ANR spike |
| 2 | 0.05 | 24 h | same |
| 3 | 0.20 | 48 h | same |
| 4 | completed | — | — |

Each step is a manual pipeline job with a dropdown for the fraction (see `rio-yml` dropdown variables), approved by the release manager.

## Other Android stores

Huawei AppGallery, Samsung Galaxy Store and Amazon Appstore have their own publishing APIs and community fastlane plugins; check maintenance status before adopting one.
