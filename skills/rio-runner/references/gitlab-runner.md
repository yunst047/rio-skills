# GitLab Runner

## Executors

| Executor | Use for | Notes |
|---|---|---|
| `docker` | Default for Linux builds | Clean container per job. Privileged only for Docker-in-Docker; prefer Kaniko/Buildah for image builds. |
| `docker-autoscaler` | Elastic Linux capacity on cloud VMs | Uses fleeting plugins (AWS, GCP, Azure). Successor to the deprecated `docker+machine`. |
| `instance` | Autoscaled VMs where the job needs the full VM (e.g. KVM for Android emulator, nested virt) | Also fleeting-based. |
| `kubernetes` | Teams already on k8s | Pod per job; set resource requests/limits; KVM needs privileged pods and nodes that support it. |
| `shell` | macOS hosts, device-lab hosts with USB devices | No isolation between jobs — one trusted project per host, clean workspace in `after_script`. |
| `custom` | Tart / Anka / other VM drivers on macOS | Driver scripts create a fresh VM per job. |
| `virtualbox` / `parallels` | Legacy VM-per-job | Prefer `custom` with a maintained driver. |

## Registration (authentication tokens)

Create the runner in the UI or API (project, group or instance → CI/CD → Runners → New runner), choose tags, protected and locked there, and copy the **runner authentication token** (`glrt-…`). The legacy registration-token flow is deprecated; do not plan new fleets on it.

```bash
gitlab-runner register --non-interactive \
  --url "https://gitlab.example.com" \
  --token "$RUNNER_AUTH_TOKEN" \
  --executor docker --docker-image "alpine:3"
```

Keep `$RUNNER_AUTH_TOKEN` in the provisioning system's secret store, not in a repo.

## `config.toml` essentials

```toml
concurrent = 8                 # global slots on this host
check_interval = 3

[[runners]]
  name = "linux-build-01"
  url = "https://gitlab.example.com"
  executor = "docker"
  limit = 8                    # per-runner slots
  request_concurrency = 2      # parallel job requests to GitLab
  [runners.docker]
    image = "alpine:3"
    privileged = false
    pull_policy = ["if-not-present"]
    volumes = ["/cache"]
  [runners.cache]
    Type = "s3"                # distributed cache shared by all runners in the pool
    Shared = true
    [runners.cache.s3]
      ServerAddress = "s3.amazonaws.com"
      BucketName = "ci-cache"
      BucketLocation = "ap-southeast-1"
```

Tags, protected, locked, run-untagged and max job timeout are set on the runner in the GitLab UI/API (with authentication tokens they are no longer `register` flags).

## Settings checklist

- **Protected** runners for pools holding deploy credentials or network reach — they only run jobs on protected branches/tags.
- **Locked** to a project when the host has project-specific devices or secrets.
- **Run untagged jobs: off** for every specialised pool.
- **Max job timeout** per runner, shorter than the project default for cheap pools.
- `pull_policy = ["if-not-present"]` speeds builds but can run stale images; pin image digests for release jobs.
- Monitoring: the runner's Prometheus metrics endpoint (`listen_address`) → queue time, job failures, concurrent usage.

## Multi-runner layout example

| Runner | Executor | Tags | Protected | Notes |
|---|---|---|---|---|
| linux-autoscale | docker-autoscaler | `linux-build` | no | 0–20 VMs, idle 1 |
| android-kvm | instance | `android-emulator` | no | VMs with nested virtualization / KVM |
| mac-01, mac-02 | custom (Tart) / shell | `macos-xcode-16` | no | 2 VMs per host max |
| deploy-prod | docker | `deploy-prod` | **yes** | private subnet, OIDC role for prod |
| device-lab-01 | shell | `device-lab` | yes | USB devices; jobs use `resource_group` per device |
