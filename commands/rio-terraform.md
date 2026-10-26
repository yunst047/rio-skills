---
description: Run Terraform / OpenTofu through CI — plan on MR, apply the saved plan, state, OIDC, drift.
argument-hint: "[stacks + platform, e.g. 'GitLab, AWS network + eks, staging/prod']"
---

Plan the infrastructure pipeline, Rio style: $ARGUMENTS

- `stack:` root module | environment | backend/state key | owner | plan identity (read-only) | apply identity (write, protected only) | approver.
- Layout: one root module per environment / blast radius; shared modules versioned and pinned; `required_version`, provider constraints and `.terraform.lock.hcl` committed.
- State: remote backend with locking and encryption (S3 `use_lockfile`, GCS, azurerm, HCP Terraform, GitLab-managed state); state never uploaded as an artifact.
- Auth: CI OIDC to each cloud, separate plan and apply roles.
- `flow:` fmt -check → init → validate → tflint / Trivy / Checkov → `plan -out` on MR (shown to the reviewer, deletes blocked unless explicitly allowed) → approval → `apply plan.tfplan` on main → post-apply plan empty.
- `concurrency:` one plan/apply per state (`resource_group` / `concurrency` with `cancel-in-progress: false` / `lock()`); never cancel a running apply.
- `drift:` scheduled `plan -detailed-exitcode`; exit 2 alerts the owner, never auto-applies.
- `yml:` the validate, plan, apply and drift jobs.
- `proof:` plan visible on the MR, apply green, follow-up plan shows no changes.

Use the `rio-terraform` skill references (pipelines, state and auth). Plan files and state may contain secrets — short expiry, restricted access. `destroy`, `state rm`, `import` and `force-unlock` are manual and confirmed with Sensei. Address the user as **Sensei**.
