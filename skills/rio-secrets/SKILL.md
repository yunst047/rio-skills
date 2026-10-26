---
name: rio-secrets
description: >
  Rio's variables and credentials plan — where each CI variable lives and who
  can read it (project/group/org, environment-scoped, protected, masked,
  file-type), and how the pipeline authenticates to cloud platforms: OIDC /
  workload identity federation first, then short-lived vault tokens, then
  scoped service-account keys, static access keys last. Covers AWS, GCP, Azure,
  HashiCorp Vault, and mobile signing material (Android keystore, Play service
  account, App Store Connect API key, certificates and profiles). Use when the
  user says "where do I put this secret", "access key", "service account",
  "OIDC", "workload identity", "CI variables", "signing keys in CI",
  "rio-secrets", or invokes /rio-secrets.
---

Contain the credentials before anything else ships, Sensei. (Address the user
as Sensei.)

## Method

1. **inventory:** List every secret and config value the pipeline needs, with its consumer job and environment. Separate *config* (non-secret variables) from *secrets*.
2. **scope:** Put each value at the narrowest level that works: environment-scoped > project/repo > group/org. Production secrets are **protected** (only protected branches/tags) and environment-scoped.
3. **auth method:** For each cloud, choose by this order, and write down why a lower rung was needed:
   1. **OIDC / workload identity federation** — the CI job's ID token is exchanged for short-lived cloud credentials. No stored secret.
   2. **Short-lived token from a vault** (HashiCorp Vault JWT auth, cloud secret manager reached via OIDC).
   3. **Scoped service-account key / JSON** — least privilege, rotated on a schedule, stored as a protected masked file variable.
   4. **Static access key** — last resort, same handling as 3, with an expiry date in the plan.
4. **trust policy:** Restrict who can assume the role with claim conditions — project/repo path + protected ref or environment. A trust policy that accepts any branch of any project is a finding.
5. **files:** Binary or multi-line secrets (keystore, `.p8`, JSON key) go in **file-type** variables or base64-encoded variables decoded at runtime to a temp path, deleted in cleanup.
6. **rotation:** Owner, rotation period, and the scheduled job that warns before expiry (certificates, profiles, keys).
7. **leak check:** No `set -x` around secrets, no secrets in artifact paths, masked in logs, secret scanning enabled on the repo.

Platform detail — load what applies:
- OIDC to AWS, GCP, Azure, Vault from GitLab and GitHub (and others): `references/oidc-cloud.md`
- Variable storage and scoping per CI platform, plus mobile signing inventory: `references/platform-variables.md`

## Output

A secrets table, then snippets:

| Name | Type (config/secret/file) | Scope (env, protected) | Consumer jobs | Source (OIDC / vault / stored) | Owner | Rotation |
|---|---|---|---|---|---|---|

- `auth:` per cloud — the chosen rung and the trust-policy condition.
- `yml:` the job snippet that obtains credentials (ID token request, login action).
- `risk:` anything left on rung 3–4, with its expiry plan.

## Rules

- Never print, `echo`, or commit a secret value — not even in an example. Use placeholders like `$PLAY_SERVICE_ACCOUNT_JSON`.
- Never widen a trust policy to make a pipeline pass; fix the claim instead.
- Masking is a safety net, not a control. The control is scope + protection.
- Forked MR/PR pipelines get no secrets.
- Rotating or revoking a live credential is confirmed with Sensei first.

## Boundaries

Plans storage and auth and writes the config; creating, rotating or deleting
real credentials is confirmed with Sensei. "stop rio-secrets" or "normal mode"
reverts.
