# Terraform / OpenTofu pipelines

Image and action versions shown are ones the author last verified; pin them (digest / commit SHA) in real repos.

## Shape

```
MR/PR:  fmt -check → init → validate → tflint + trivy config → plan -out=plan.tfplan → (plan shown on the MR, optional infracost + policy)
main:   init → plan -out (or reuse the MR plan for the same commit) → approval → apply plan.tfplan → post-apply plan (expect no changes)
cron:   init → plan -detailed-exitcode → exit 2 ⇒ drift alert
```

## GitLab CI

GitLab's built-in Terraform CI templates were deprecated after Terraform's licence change; for new pipelines use the **OpenTofu CI/CD component** (`gitlab.com/components/opentofu`) or the plain jobs below. GitLab-managed state still works with both Terraform and OpenTofu.

```yaml
variables:
  TF_ROOT: envs/prod
  TF_STATE_NAME: prod
  TF_IN_AUTOMATION: "true"
  TF_PLUGIN_CACHE_DIR: $CI_PROJECT_DIR/.tf-plugin-cache

.tf_image:
  image:
    name: hashicorp/terraform:1.9
    entrypoint: [""]
  tags: [linux-build]
  cache:
    key: tf-plugins
    paths: [.tf-plugin-cache]

.tf:
  extends: .tf_image
  resource_group: tf-$TF_STATE_NAME          # one plan/apply per state at a time
  interruptible: false
  id_tokens:
    AWS_ID_TOKEN:
      aud: sts.amazonaws.com
  before_script:
    - mkdir -p "$TF_PLUGIN_CACHE_DIR"
    - echo "$AWS_ID_TOKEN" > /tmp/web_identity_token
    - export AWS_WEB_IDENTITY_TOKEN_FILE=/tmp/web_identity_token AWS_ROLE_ARN="$TF_ROLE_ARN"
    - cd "$TF_ROOT"
    - terraform init -input=false -backend-config=backend.hcl

tf:validate:
  extends: .tf_image                    # no state, no cloud credentials needed
  stage: test
  script:
    - terraform fmt -check -recursive
    - cd "$TF_ROOT"
    - terraform init -input=false -backend=false
    - terraform validate

tf:plan:
  extends: .tf
  stage: build
  variables:
    TF_ROLE_ARN: $TF_PLAN_ROLE_ARN
  script:
    - terraform plan -input=false -lock-timeout=5m -out=plan.tfplan
    - terraform show -no-color plan.tfplan > plan.txt
    - terraform show -json plan.tfplan > plan.json
    # block deletes/replacements unless explicitly allowed for this pipeline
    - apk add --no-cache jq
    - >
      DELETES=$(jq '[.resource_changes[]? | select(.change.actions | index("delete"))] | length' plan.json);
      if [ "$DELETES" -gt 0 ] && [ "$ALLOW_DESTROY" != "true" ]; then
      echo "Plan deletes or replaces $DELETES resource(s); re-run with ALLOW_DESTROY=true after review." >&2; exit 1; fi
  artifacts:
    paths: [$TF_ROOT/plan.tfplan, $TF_ROOT/plan.txt]
    expire_in: 3 days
    access: developer                   # plan files can contain secrets
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

tf:apply:
  extends: .tf
  stage: deploy
  needs: [tf:plan]                      # applies exactly the plan file from this pipeline
  variables:
    TF_ROLE_ARN: $TF_APPLY_ROLE_ARN
  environment:
    name: infra-prod
  script:
    - terraform apply -input=false -lock-timeout=5m plan.tfplan
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual

tf:drift:
  extends: .tf
  stage: test
  variables:
    TF_ROLE_ARN: $TF_PLAN_ROLE_ARN
  script:
    - set +e; terraform plan -input=false -detailed-exitcode -lock=false > drift.txt; code=$?; set -e
    - if [ "$code" = "2" ]; then echo "Drift detected"; cat drift.txt; exit 1; fi
    - exit $code
  artifacts:
    when: always
    paths: [$TF_ROOT/drift.txt]
    expire_in: 7 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule" && $SCHEDULE_KIND == "drift"
```

- The job ID token goes to `AWS_WEB_IDENTITY_TOKEN_FILE` + `AWS_ROLE_ARN`, which the AWS provider's default credential chain picks up — no stored keys.
- Multiple environments: `parallel: matrix: - TF_ROOT: [envs/staging, envs/prod]` for validate; separate plan/apply jobs (or a child pipeline per environment) so each has its own approval and `resource_group`.
- Monorepo of stacks: `rules: changes: [envs/prod/**/*, modules/**/*]` so unrelated MRs don't plan everything.
- The MR widget can display a plan summary through `artifacts: reports: terraform: plan-report.json` (generated with `gitlab-terraform plan-json` in GitLab's images, or the OpenTofu component).

## GitHub Actions

```yaml
name: terraform
on:
  pull_request:
    paths: ["infra/**"]
  push:
    branches: [main]
    paths: ["infra/**"]
  schedule:
    - cron: "41 0 * * 1-5"              # weekday drift check (UTC)

permissions:
  contents: read
  id-token: write
  pull-requests: write

defaults:
  run:
    working-directory: infra/envs/prod

jobs:
  plan:
    runs-on: ubuntu-24.04
    concurrency:
      group: tf-prod
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.9.8"
          terraform_wrapper: false
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.TF_PLAN_ROLE_ARN }}
          aws-region: ap-southeast-1
      - run: terraform fmt -check -recursive
      - run: terraform init -input=false -backend-config=backend.hcl
      - run: terraform validate
      - id: plan
        run: |
          set +e
          terraform plan -input=false -lock-timeout=5m -detailed-exitcode -out=plan.tfplan
          echo "exitcode=$?" >> "$GITHUB_OUTPUT"
      - name: Fail on plan error
        if: steps.plan.outputs.exitcode == '1'
        run: exit 1
      - name: Drift alert
        if: github.event_name == 'schedule' && steps.plan.outputs.exitcode == '2'
        run: |
          echo "::error::Drift detected in prod"
          exit 1
      - run: terraform show -no-color plan.tfplan > plan.txt
      - uses: actions/upload-artifact@v4
        if: github.event_name == 'push'
        with:
          name: tfplan-prod
          path: infra/envs/prod/plan.tfplan
          retention-days: 3

  apply:
    needs: plan
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    environment: infra-prod             # required reviewers on this environment
    concurrency:
      group: tf-prod
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.9.8"
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.TF_APPLY_ROLE_ARN }}
          aws-region: ap-southeast-1
      - uses: actions/download-artifact@v4
        with:
          name: tfplan-prod
          path: infra/envs/prod
      - run: terraform init -input=false -backend-config=backend.hcl
      - run: terraform apply -input=false -lock-timeout=5m plan.tfplan
```

- Post the plan to the PR: a step with `actions/github-script` reading `plan.txt`, or `terraform show` output into `$GITHUB_STEP_SUMMARY`. Keep the comment updated rather than adding one per push.
- `plan` and `apply` share `concurrency.group: tf-prod`, so a new push waits for a running apply instead of cancelling it.
- Environment protection on `infra-prod` is the approval; only that job can assume the apply role (trust policy `sub` = `repo:org/infra:environment:infra-prod`).

## Jenkins

```groovy
stage('Plan') {
  steps {
    dir('envs/prod') {
      sh 'terraform init -input=false -backend-config=backend.hcl'
      sh 'terraform plan -input=false -out=plan.tfplan'
      stash name: 'tfplan', includes: 'plan.tfplan'
    }
  }
}
stage('Apply') {
  when { branch 'main' }
  input { message 'Apply this plan to prod?'; submitter 'infra-approvers' }
  steps {
    lock(resource: 'tf-prod') {
      dir('envs/prod') {
        unstash 'tfplan'
        sh 'terraform init -input=false -backend-config=backend.hcl'
        sh 'terraform apply -input=false plan.tfplan'
      }
    }
  }
}
```

## Azure Pipelines

Use the Microsoft DevLabs Terraform extension tasks (`TerraformInstaller`, `TerraformTaskV4`) or plain `script:` steps with an Azure service connection using workload identity federation (`ARM_USE_OIDC`). Publish `plan.tfplan` as a pipeline artifact in the plan stage; the apply stage is a `deployment` job to an environment with approvals + exclusive lock.

## Atlantis and HCP Terraform

- **Atlantis** — self-hosted bot: `atlantis plan` / `atlantis apply` as PR comments, locks per project/workspace, apply requirements (`approved`, `mergeable`). CI then only runs validate/lint; Atlantis owns plan/apply.
- **HCP Terraform / Terraform Enterprise** — VCS-driven or API-driven runs; speculative plans on PRs, apply after confirmation, run tasks and Sentinel/OPA policies, dynamic provider credentials. CI triggers runs with the `cloud {}` block and a team token.

## Validation and policy tools

| Tool | Command |
|---|---|
| fmt / validate | `terraform fmt -check -recursive`, `terraform validate` |
| tflint | `tflint --init && tflint --recursive` |
| Trivy (IaC) | `trivy config --exit-code 1 --severity HIGH,CRITICAL .` (tfsec merged into Trivy) |
| Checkov | `checkov -d . --compact` |
| Conftest (OPA) | `terraform show -json plan.tfplan > plan.json && conftest test plan.json` |
| Infracost | `infracost diff --path plan.json` → comment on MR |
| terraform test | `terraform test` (native tests, 1.6+) |

## OpenTofu

Same workflow with `tofu` instead of `terraform` (`ghcr.io/opentofu/opentofu` image, `opentofu/setup-opentofu` action). OpenTofu also supports client-side **state encryption**. Do not switch a state between tools and back without testing; pin one tool per stack.
