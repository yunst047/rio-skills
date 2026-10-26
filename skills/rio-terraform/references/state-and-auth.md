# Terraform state, locking and provider auth

## Backends

| Backend | Locking | Notes |
|---|---|---|
| `s3` | `use_lockfile = true` (S3-native lock file, Terraform 1.10+ / recent OpenTofu); older setups use a DynamoDB table (`dynamodb_table`, now deprecated) | Bucket versioning + encryption (SSE-KMS), block public access |
| `gcs` | Built in | Object versioning on the bucket |
| `azurerm` | Built in (blob lease) | Storage account with soft delete / versioning |
| HCP Terraform / Terraform Enterprise (`cloud {}` block) | Built in | Runs can execute remotely; workspaces per environment; Sentinel/OPA policies |
| GitLab-managed state (`http` backend) | Built in (lock/unlock endpoints) | State stored per project, auth with the job token in CI |
| Others (`pg`, `consul`, `kubernetes`) | Built in | Niche; make sure locking is supported |

```hcl
terraform {
  required_version = "~> 1.9"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    bucket       = "acme-tfstate-prod"
    key          = "network/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

Keep backend config partial in code and pass environment-specific values at init: `terraform init -backend-config=envs/prod/backend.hcl`.

### GitLab-managed state

```bash
terraform init \
  -backend-config="address=${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/terraform/state/${TF_STATE_NAME}" \
  -backend-config="lock_address=${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/terraform/state/${TF_STATE_NAME}/lock" \
  -backend-config="unlock_address=${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/terraform/state/${TF_STATE_NAME}/lock" \
  -backend-config="username=gitlab-ci-token" \
  -backend-config="password=${CI_JOB_TOKEN}" \
  -backend-config="lock_method=POST" -backend-config="unlock_method=DELETE" -backend-config="retry_wait_min=5"
```

with `backend "http" {}` in code. The GitLab OpenTofu CI component sets this up for you.

## State hygiene

- One state per root module and environment; small states plan faster and limit blast radius.
- Only CI identities (and a break-glass admin role) can write state. Developers get read access at most.
- State contains secrets (generated passwords, keys): encrypt at rest, restrict reads, never commit it, never upload it as a CI artifact.
- Cross-stack values: `terraform_remote_state` (read-only role) or, better, publish outputs to SSM / Secret Manager / a registry and read them there.

## Provider auth from CI (OIDC first — see `rio-secrets` for trust policies)

Two identities per environment:

| Identity | Permissions | Who can assume |
|---|---|---|
| `tf-plan-<env>` | Read-only on resources + read/lock on state | Any MR pipeline of the infra repo (non-protected refs OK for non-prod; prod plan may still need read on prod) |
| `tf-apply-<env>` | Write on resources + state | Protected branch / protected environment jobs only |

**AWS** — the provider reads standard env credentials, so obtain them first (GitLab `id_tokens` + `assume-role-with-web-identity`, or GitHub `configure-aws-credentials`). Alternatively let the provider do it:

```hcl
provider "aws" {
  region = "ap-southeast-1"
  assume_role_with_web_identity {
    role_arn                = var.role_arn
    web_identity_token_file = var.web_identity_token_file   # job writes the CI ID token to this file
  }
}
```

**GCP** — Workload Identity Federation credential config file (`gcloud iam workload-identity-pools create-cred-config ...`) exported as `GOOGLE_APPLICATION_CREDENTIALS`, or `google-github-actions/auth` on GitHub.

**Azure** — `ARM_USE_OIDC=true`, `ARM_CLIENT_ID`, `ARM_TENANT_ID`, `ARM_SUBSCRIPTION_ID`; on GitLab also `ARM_OIDC_TOKEN=$AZURE_ID_TOKEN` (from `id_tokens`). The azurerm backend accepts the same OIDC settings (`use_oidc = true`).

**HCP Terraform** — dynamic provider credentials (workload identity from HCP to the cloud) remove cloud keys from CI entirely; CI only needs an HCP team token with run permissions, or use VCS-driven runs.

## Pinning

- `required_version` and provider version constraints in code; commit `.terraform.lock.hcl` and add hashes for every platform CI and developers use: `terraform providers lock -platform=linux_amd64 -platform=darwin_arm64 -platform=windows_amd64`.
- Modules from git pinned to a tag (`?ref=v2.3.0`) or from a registry with a version constraint.
- Provider plugin cache (`TF_PLUGIN_CACHE_DIR`) cached between jobs for speed.
