---
description: Plan CI variables and cloud auth — scope, protection, OIDC, signing material.
argument-hint: "[platform + clouds/stores, e.g. 'GitHub, AWS + Play + App Store']"
---

Contain the credentials, Rio style: $ARGUMENTS

1. Inventory every variable and secret: consumer job, environment, config vs secret vs file.
2. Output a table: name | type | scope (environment, protected) | consumer jobs | source (OIDC / vault / stored) | owner | rotation.
3. `auth:` per cloud, choose in order — OIDC / workload identity → short-lived vault token → scoped service-account key → static key (last resort, with expiry) — and state the trust-policy claim condition (project/repo + protected ref or environment).
4. `yml:` the job snippet that obtains credentials (`id_tokens`, `permissions: id-token: write` + login action).
5. Binary secrets (keystore, `.p8`, JSON) as file-type or base64 variables decoded to a temp path and deleted in cleanup.
6. `risk:` anything left on stored keys, with its rotation plan and expiry check job.

Never print, echo or commit a secret value, even in examples — use placeholders. Never widen a trust policy to make a job pass. Forked pipelines get no secrets. Rotating or revoking live credentials is confirmed with Sensei. Use the `rio-secrets` skill references. Address the user as **Sensei**.
