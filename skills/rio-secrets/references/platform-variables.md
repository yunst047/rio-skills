# Variable storage per CI platform

## GitLab

- Levels: instance → group → project; `.gitlab-ci.yml` `variables:` for non-secret config only.
- Flags: **Protected** (only protected branches/tags), **Masked** (redacted in logs; value must meet masking rules), **Masked and hidden** (value cannot be revealed in the UI after saving — recent GitLab versions), **Expand variable reference** (turn off for values containing `$`).
- **Environment scope:** `production`, `staging`, `review/*` — the same key can hold different values per environment.
- **Type: File** — GitLab writes the value to a temp file and the variable holds the *path*. Use for keystores (base64-decoded), JSON keys, `.p8`.
- Precedence (high → low, simplified): trigger/manual/scheduled pipeline variables → project → group → instance → `.gitlab-ci.yml` job → global YAML variables → predefined.

```yaml
android_release:
  script:
    - echo "$ANDROID_KEYSTORE_B64" | base64 -d > "$CI_PROJECT_DIR/release.jks"
    - bundle exec fastlane android release keystore_path:"$CI_PROJECT_DIR/release.jks"
  after_script:
    - rm -f "$CI_PROJECT_DIR/release.jks"
```

## GitHub Actions

- **Secrets** (encrypted, masked) and **Variables** (plain config) at org, repo and **environment** level.
- **Environments** add protection rules: required reviewers, wait timer, deployment branch/tag rules. Environment secrets are only released to jobs that declare `environment:` and pass the rules — put prod and store credentials there.
- Secrets are not passed to workflows triggered from forks (except `pull_request_target`, which you should avoid for untrusted code).
- Multi-line / binary: store base64, decode to `$RUNNER_TEMP`.

```yaml
- name: Decode keystore
  run: echo "${{ secrets.ANDROID_KEYSTORE_B64 }}" | base64 -d > "$RUNNER_TEMP/release.jks"
```

## Jenkins

- Credentials store (System / folder scope): Secret text, Username+password, Secret file, SSH key, Certificate.
- Bind per step; never in `environment {}` at pipeline level for secrets used by one stage.

```groovy
withCredentials([file(credentialsId: 'android-keystore', variable: 'KEYSTORE'),
                 string(credentialsId: 'keystore-pass', variable: 'KEYSTORE_PASS')]) {
  sh 'bundle exec fastlane android release keystore_path:"$KEYSTORE"'
}
```

## Azure Pipelines

- Pipeline variables (mark **secret**), **variable groups** in Library (can be **linked to Azure Key Vault**), **secure files** for keystores, `.p12`, provisioning profiles (`DownloadSecureFile@1`).
- Approvals and checks on variable groups, secure files and environments gate who can use them.
- Secret variables are not exposed as env vars automatically — map them explicitly with `env:`.

## Bitbucket / CircleCI

- Bitbucket: workspace, repository and **deployment** variables (secured flag); deployment variables only apply to steps with that `deployment:` environment.
- CircleCI: project environment variables and **contexts**; restrict contexts to security groups and to specific projects; use expression-based restrictions for branches.

## Mobile signing inventory

| Item | What it is | Store as | Notes |
|---|---|---|---|
| Android upload keystore | `.jks` signing the AAB you upload | file / base64 secret | With Play App Signing, Google holds the app signing key; you hold the *upload* key (resettable via Play support). |
| Keystore password, key alias, key password | | secret | |
| Play service account JSON | Google Cloud service account with Play Console permissions | file secret, or fetched via OIDC from a secret manager | Grant only the release permissions it needs in Play Console. |
| App Store Connect API key | `.p8` + key ID + issuer ID | file secret + variables | Team key with the minimum role (App Manager for uploads). Never use an Apple ID password + 2FA session in CI. |
| Certificates + profiles | Distribution cert (`.p12`) and provisioning profiles | fastlane **match** repo/bucket encrypted with `MATCH_PASSWORD` | CI uses `readonly: true`; only one admin job regenerates. |
| Firebase token / service account | For App Distribution | file secret or OIDC (GCP WIF) | Prefer a service account over a `firebase login:ci` token. |
