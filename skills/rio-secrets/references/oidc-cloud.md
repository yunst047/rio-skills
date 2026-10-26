# OIDC from CI to cloud platforms

Pattern: the job requests a signed ID token (JWT) from the CI platform → the cloud trusts that issuer → a role/identity accepts tokens whose claims match → the job receives short-lived credentials.

Action versions below are the majors the author last verified. Pin third-party actions to a full commit SHA and let Renovate/Dependabot bump them.

## Issuers and key claims

| CI | Issuer | Restrict on |
|---|---|---|
| GitLab | `https://gitlab.com` (or your instance URL) | `sub` = `project_path:group/app:ref_type:branch:ref:main`, or `environment`, `ref_protected` |
| GitHub | `https://token.actions.githubusercontent.com` | `sub` = `repo:org/app:environment:production` or `repo:org/app:ref:refs/heads/main` |
| Bitbucket | per-workspace issuer shown in repo OIDC settings (`oidc: true` on the step) | repository UUID, deployment environment |
| CircleCI | `https://oidc.circleci.com/org/<org-id>` | project id, context |
| Azure Pipelines | service connection with workload identity federation (created in the project) | the service connection itself |

## GitLab → AWS

```yaml
deploy_prod:
  stage: deploy
  image: amazon/aws-cli:latest
  id_tokens:
    AWS_ID_TOKEN:
      aud: sts.amazonaws.com
  environment: production
  script:
    - >
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s"
      $(aws sts assume-role-with-web-identity
      --role-arn "$AWS_ROLE_ARN"
      --role-session-name "gitlab-$CI_PIPELINE_ID"
      --web-identity-token "$AWS_ID_TOKEN"
      --duration-seconds 3600
      --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]'
      --output text))
    - aws sts get-caller-identity
  rules:
    - if: $CI_COMMIT_TAG
```

IAM: add an OIDC identity provider for the GitLab URL with audience `sts.amazonaws.com`. Role trust policy condition:

```json
"Condition": {
  "StringEquals": { "gitlab.example.com:aud": "sts.amazonaws.com" },
  "StringLike":   { "gitlab.example.com:sub": "project_path:group/app:ref_type:tag:ref:v*" }
}
```

## GitHub → AWS / GCP / Azure

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-24.04
    environment: production
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: ap-southeast-1
      # GCP
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOY_SA }}
      # Azure (federated credential on an app registration / managed identity)
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

Role ARNs, provider names and client IDs are **not secrets** — store them as variables (`vars.*`), not secrets.

## GitLab → GCP (Workload Identity Federation)

```yaml
deploy_gcp:
  image: google/cloud-sdk:slim
  id_tokens:
    GCP_ID_TOKEN:
      aud: https://iam.googleapis.com/projects/$GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER
  script:
    - echo "$GCP_ID_TOKEN" > /tmp/oidc_token
    - gcloud iam workload-identity-pools create-cred-config
        "projects/$GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"
        --service-account="$GCP_DEPLOY_SA"
        --credential-source-file=/tmp/oidc_token
        --output-file=/tmp/gcp_creds.json
    - gcloud auth login --cred-file=/tmp/gcp_creds.json
    - gcloud run deploy app --image "$IMAGE" --region asia-southeast2
  after_script:
    - rm -f /tmp/oidc_token /tmp/gcp_creds.json
```

Provider attribute condition example: `assertion.project_path == "group/app" && assertion.ref_protected == "true"`.

## GitLab → Azure

Create a federated credential on an app registration or user-assigned managed identity with issuer = GitLab URL, subject = the exact `sub` (e.g. `project_path:group/app:ref_type:branch:ref:main`), audience as configured. Then:

```yaml
deploy_azure:
  image: mcr.microsoft.com/azure-cli
  id_tokens:
    AZURE_ID_TOKEN:
      aud: api://AzureADTokenExchange
  script:
    - az login --service-principal -u "$AZURE_CLIENT_ID" -t "$AZURE_TENANT_ID" --federated-token "$AZURE_ID_TOKEN"
```

Azure federated credentials match `sub` exactly (no wildcards) — plan one per branch/environment.

## HashiCorp Vault (JWT auth)

```yaml
read_secrets:
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.example.com
  secrets:
    PLAY_JSON:
      vault: mobile/play/service_account@kv   # path/field@mount
      file: true
      token: $VAULT_ID_TOKEN
```

(`secrets:vault` is a GitLab Premium feature; otherwise call `vault write auth/jwt/login role=... jwt=$VAULT_ID_TOKEN` yourself.) Vault role `bound_claims` restrict project and ref the same way as cloud trust policies.

## When OIDC is not possible

- Play Console and App Store Connect do not accept CI OIDC tokens directly. Keep their keys in a secret manager reachable via OIDC (AWS Secrets Manager, GCP Secret Manager, Vault), fetch them at job start, write to a temp file, delete after.
- If they must be stored in CI: protected + masked/hidden + file-type, environment-scoped to the release environment, with a rotation date.
