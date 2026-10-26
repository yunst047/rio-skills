# Runners on Kubernetes

Each job becomes a pod. Good for elastic Linux capacity on an existing cluster; not for macOS, and Android emulators need nodes with KVM.

## GitLab Runner — Helm chart

```bash
helm repo add gitlab https://charts.gitlab.io
kubectl create namespace gitlab-runner
kubectl -n gitlab-runner create secret generic runner-auth \
  --from-literal=runner-registration-token="" \
  --from-literal=runner-token="$RUNNER_AUTH_TOKEN"
helm upgrade --install gitlab-runner gitlab/gitlab-runner \
  -n gitlab-runner -f values.yaml --version <pinned chart version>
```

`values.yaml`:

```yaml
gitlabUrl: https://gitlab.example.com
concurrent: 20
rbac:
  create: true
runners:
  secret: runner-auth
  config: |
    [[runners]]
      [runners.kubernetes]
        namespace = "gitlab-runner"
        image = "alpine:3"
        privileged = false
        service_account = "ci-jobs"
        cpu_request = "1"
        cpu_limit = "4"
        memory_request = "2Gi"
        memory_limit = "8Gi"
        helper_cpu_request = "100m"
        helper_memory_request = "128Mi"
        service_cpu_request = "250m"
        service_memory_request = "512Mi"
        poll_timeout = 600
        [runners.kubernetes.node_selector]
          "workload" = "ci"
        [[runners.kubernetes.node_tolerations]]
          key = "ci"
          operator = "Equal"
          value = "true"
          effect = "NoSchedule"
      [runners.cache]
        Type = "s3"
        Shared = true
        [runners.cache.s3]
          ServerAddress = "s3.amazonaws.com"
          BucketName = "ci-cache"
          BucketLocation = "ap-southeast-1"
```

Tags, protected and locked are set on the runner in GitLab (authentication-token flow), as with any runner.

## Pod anatomy

- `build` container (the job's `image:`), `helper` container (git clone, artifacts, cache), one container per `services:` entry.
- Requests/limits set per container type; jobs may override within bounds via `KUBERNETES_CPU_REQUEST` etc. if `cpu_request_overwrite_max_allowed` (and friends) are configured.
- `poll_timeout` must exceed node scale-up time when the node pool scales from zero.

## Image builds on Kubernetes

- Default: rootless BuildKit or Buildah in an unprivileged pod (seccomp/AppArmor `Unconfined` for rootless BuildKit). See `rio-container` → `docker-build.md`.
- If Docker-in-Docker is unavoidable: a **separate runner** (own tag, e.g. `k8s-dind`) with `privileged = true`, scheduled onto a dedicated, tainted node pool, used only by protected/trusted projects.
- Never mount the node's container runtime socket into job pods.

## Scaling and nodes

- CI node pool with taints + node selector so jobs don't land on app nodes; Cluster Autoscaler or Karpenter scales it, spot/preemptible instances for cost (set retries on `runner_system_failure` for evictions).
- Separate node pools for: general CI, KVM-capable nodes (Android emulator; nested virtualization or bare metal), GPU.
- Namespace quotas (`ResourceQuota`, `LimitRange`) on the runner namespace cap runaway jobs.
- Job pods' ServiceAccount (`ci-jobs`) gets **no** cluster permissions by default; deploy jobs use the GitLab agent or cloud OIDC instead of the runner's identity.

## GitHub Actions — ARC on Kubernetes

Runner scale sets (see `github-runners.md` for install). Container modes:

| `containerMode.type` | Behaviour |
|---|---|
| unset | Runner pod only; jobs using `container:` / Docker actions fail |
| `dind` | Docker-in-Docker sidecar (privileged) — supports `container:`, services, Docker actions |
| `kubernetes` | Job containers run as separate pods via runner container hooks; needs a PVC for the work volume; no privileged |

```yaml
# values for gha-runner-scale-set
githubConfigUrl: https://github.com/ORG
githubConfigSecret: arc-github-app
minRunners: 0
maxRunners: 30
containerMode:
  type: kubernetes
  kubernetesModeWorkVolumeClaim:
    accessModes: ["ReadWriteOnce"]
    storageClassName: gp3
    resources:
      requests:
        storage: 10Gi
template:
  spec:
    nodeSelector:
      workload: ci
```

## Jenkins — Kubernetes plugin

```groovy
pipeline {
  agent {
    kubernetes {
      yaml '''
        apiVersion: v1
        kind: Pod
        spec:
          containers:
            - name: gradle
              image: gradle:8-jdk17
              command: ["sleep"]
              args: ["infinity"]
              resources:
                requests: { cpu: "1", memory: 2Gi }
      '''
      defaultContainer 'gradle'
    }
  }
  stages {
    stage('Test') { steps { sh './gradlew test' } }
  }
}
```

## Azure Pipelines

Self-hosted agents as Kubernetes Jobs, scaled by KEDA's Azure Pipelines scaler (one job per pipeline job, torn down after). Register agents to a pool with a PAT or service principal held in a Kubernetes secret.
