# Deploying to Kubernetes from CI

## Cluster access

| From | Method | Notes |
|---|---|---|
| GitLab | **GitLab agent for Kubernetes** (`agentk` in the cluster) with `ci_access` | No inbound cluster access, no stored kubeconfig. Jobs get a context named `<agent-config-project-path>:<agent-name>`. |
| GitLab / GitHub → EKS | OIDC → IAM role → `aws eks update-kubeconfig --name <cluster>` | Map the role to a namespaced RBAC group (EKS access entries). |
| → GKE | WIF → `gcloud container clusters get-credentials <cluster> --region <r>` (needs `gke-gcloud-auth-plugin`) | Grant the SA a namespaced Role via RBAC. |
| → AKS | federated `az login` → `az aks get-credentials` + `kubelogin convert-kubeconfig -l azurecli` | Entra ID RBAC. |
| Anything else | Namespaced ServiceAccount token stored as a protected file variable | Last resort; short-lived token (`kubectl create token --duration`) where possible. |

Agent config in the agent's project (`.gitlab/agents/prod-agent/config.yaml`):

```yaml
ci_access:
  projects:
    - id: group/app
      access_as:
        ci_job: {}            # impersonate the CI job; bind RBAC to the job's identity
```

Scope permissions with RBAC: one ServiceAccount (or impersonated group) per environment, a Role limited to that namespace (deployments, services, configmaps, ingresses — not `secrets` unless needed, never cluster-admin).

## Push deploy — GitLab with the agent + Helm

```yaml
.deploy:
  image:
    name: dtzar/helm-kubectl:3.16.2     # helm + kubectl in one image
    entrypoint: [""]
  tags: [deploy-prod]
  interruptible: false
  script:
    - kubectl config use-context group/k8s-agents:$AGENT_NAME
    - >
      helm upgrade --install app ./chart
      --namespace $KUBE_NAMESPACE --create-namespace
      --set image.repository=$CI_REGISTRY_IMAGE/app
      --set image.digest=$IMAGE_DIGEST
      --atomic --wait --timeout 10m
    - kubectl -n $KUBE_NAMESPACE rollout status deploy/app --timeout=5m

deploy:staging:
  extends: .deploy
  stage: deploy
  needs: [build:image]          # provides $IMAGE_DIGEST via dotenv
  variables: { AGENT_NAME: staging-agent, KUBE_NAMESPACE: app-staging }
  environment: { name: staging, url: https://staging.app.example.com }
  resource_group: staging
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy:production:
  extends: .deploy
  stage: deploy
  needs: [build:image, deploy:staging]
  variables: { AGENT_NAME: prod-agent, KUBE_NAMESPACE: app-prod }
  environment: { name: production, url: https://app.example.com }
  resource_group: production
  rules:
    - if: $CI_COMMIT_TAG
      when: manual
```

`--atomic` rolls back automatically if the release fails or times out.

## Review apps (one namespace per MR, auto-stopped)

```yaml
review:deploy:
  extends: .deploy
  variables: { AGENT_NAME: staging-agent, KUBE_NAMESPACE: review-$CI_MERGE_REQUEST_IID }
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.review.example.com
    on_stop: review:stop
    auto_stop_in: 3 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

review:stop:
  image:
    name: dtzar/helm-kubectl:3.16.2     # helm + kubectl in one image
    entrypoint: [""]
  variables: { KUBE_NAMESPACE: review-$CI_MERGE_REQUEST_IID, GIT_STRATEGY: none }
  script:
    - kubectl config use-context group/k8s-agents:staging-agent
    - helm uninstall app --namespace $KUBE_NAMESPACE
    - kubectl delete namespace $KUBE_NAMESPACE --wait=false
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    action: stop
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: manual
```

## Push deploy — GitHub Actions → EKS via OIDC

```yaml
name: deploy
on:
  workflow_dispatch:
    inputs:
      digest:
        description: Image digest (sha256:...)
        required: true
        type: string

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-24.04
    environment: production
    concurrency:
      group: deploy-production
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ap-southeast-1
      - run: aws eks update-kubeconfig --name prod-cluster
      - uses: azure/setup-helm@v4
      - run: >
          helm upgrade --install app ./chart -n app-prod
          --set image.digest=${{ inputs.digest }}
          --atomic --wait --timeout 10m
```

## GitOps (Argo CD / Flux)

- App repo CI: build → push → **commit the new digest** to the config repo (kustomize `images:` or Helm values) via an MR or a bot commit.
- Argo CD / Flux in the cluster pulls and syncs; CI never holds cluster credentials.
- Promotion = MR in the config repo from `envs/staging` to `envs/prod` values, approved by the named approver.
- Rollback = revert the config-repo commit. Drift is reported by the controller.
- Argo CD Image Updater / Flux image automation can do the digest bump without CI writing to the config repo.

## Rollout strategies

- Rolling update with readiness probes + `maxUnavailable: 0` — default.
- Canary / blue-green: Argo Rollouts or Flagger, with analysis on error rate / latency; CI only promotes or aborts.
- Always: `kubectl rollout status --timeout`, then a smoke test against the service URL (see `rio-verify`).

## Validation before apply

```bash
hadolint Dockerfile
helm lint ./chart
helm template app ./chart -f values-prod.yaml | kubeconform -strict -summary -
kubectl diff -f rendered.yaml          # or: helm diff upgrade (plugin), argocd app diff
```

## Rollback

| Model | Rollback |
|---|---|
| Helm push | `helm rollback app <revision> -n <ns>` (`--atomic` already rolls back failed upgrades) |
| kubectl apply | `kubectl rollout undo deploy/app -n <ns>` |
| GitOps | revert the config-repo commit |
| Canary | abort the rollout (Argo Rollouts / Flagger) |

## Secrets in the cluster

External Secrets Operator (from AWS/GCP/Azure secret managers or Vault), Sealed Secrets (encrypted in git), or the Secrets Store CSI driver. CI does not template secret values into manifests.
