# Runners with the Docker executor

The most common Linux setup: each job runs in a fresh container on a host running Docker. This file covers GitLab Runner in depth, then the Docker equivalents on other platforms.

## GitLab Runner — install and register

Run the runner itself as a container (or install the binary/package on the host):

```bash
docker volume create gitlab-runner-config
docker run -d --name gitlab-runner --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v gitlab-runner-config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest          # pin a version tag in production

docker exec -it gitlab-runner gitlab-runner register --non-interactive \
  --url "https://gitlab.example.com" \
  --token "$RUNNER_AUTH_TOKEN" \
  --executor docker \
  --docker-image "alpine:3"
```

The runner container needs the host socket to *start job containers* — that is the runner's own access, separate from whether *jobs* get the socket.

## `config.toml` — Docker executor

```toml
concurrent = 6

[[runners]]
  name = "docker-linux-01"
  url = "https://gitlab.example.com"
  executor = "docker"
  limit = 6
  environment = ["FF_NETWORK_PER_BUILD=true"]   # per-job network: services reachable by alias, isolated from other jobs
  [runners.docker]
    image = "alpine:3"                  # default when a job sets no image
    privileged = false                  # true only on the dind pool
    tls_verify = false
    pull_policy = ["if-not-present", "always"]
    allowed_pull_policies = ["always", "if-not-present"]
    allowed_images = ["registry.example.com/*", "docker.io/library/*", "ghcr.io/cirruslabs/*"]
    volumes = ["/cache"]
    shm_size = 268435456                # 256 MB; browsers/emulators need more than the 64 MB default
    cpus = "4"
    memory = "8g"
    oom_kill_disable = false
    disable_cache = false
  [runners.cache]
    Type = "s3"
    Shared = true
    [runners.cache.s3]
      ServerAddress = "s3.amazonaws.com"
      BucketName = "ci-cache"
      BucketLocation = "ap-southeast-1"
```

## Three image-build pools

Keep them as separate runners with distinct tags so jobs choose deliberately:

| Pool tag | `[runners.docker]` | Jobs use |
|---|---|---|
| `linux-build` | `privileged = false`, `volumes = ["/cache"]` | Rootless BuildKit / Buildah (see `rio-container` → `docker-build.md`) |
| `docker-privileged` | `privileged = true`, `volumes = ["/certs/client", "/cache"]` | `docker:dind` service with TLS (`DOCKER_TLS_CERTDIR=/certs`) |
| `docker-socket` | `volumes = ["/var/run/docker.sock:/var/run/docker.sock", "/cache"]` | Host Docker directly — trusted single project only, `locked` + `protected` |

`/certs/client` must be a volume so the dind service's generated client certs are shared with the job container.

## Services

- `services:` in a job start sidecar containers (postgres, redis, dind) reachable by their alias (`postgres`, or `alias:`).
- With `FF_NETWORK_PER_BUILD`, services and the job share a per-job bridge network and service-to-service traffic works.
- Service resource limits: `[runners.docker]` `services_limit` and per-service cpu/memory settings (check your runner version).

## Devices and special hosts

- Android emulator: `devices = ["/dev/kvm"]` (host must have KVM) on an `android-emulator` pool.
- GPU: `gpus = "all"` with the NVIDIA container toolkit on the host.

## Housekeeping

- Disk fills with images and volumes: schedule `docker system prune -af --filter "until=72h"` on the host, or use the `clear-docker-cache` script shipped with the runner package.
- Pin the helper image to the runner version (default behaviour) and upgrade runner + helper together.
- Mirror Docker Hub base images to your registry to avoid pull rate limits; set `allowed_images` to that registry.

## Autoscaling Docker executor

`docker-autoscaler` runs the same Docker executor on VMs created on demand by a fleeting plugin:

```toml
[[runners]]
  name = "docker-autoscale"
  executor = "docker-autoscaler"
  [runners.docker]
    image = "alpine:3"
  [runners.autoscaler]
    plugin = "aws:latest"               # fleeting plugin; pin a version
    capacity_per_instance = 1
    max_instances = 20
    [runners.autoscaler.plugin_config]
      name = "ci-runners-asg"           # existing AWS Auto Scaling group
      region = "ap-southeast-1"
    [[runners.autoscaler.policy]]
      idle_count = 1
      idle_time = "20m0s"
```

## Docker executors on other platforms

- **GitHub Actions:** `container:` on a job runs all steps in that image on a Linux runner; `services:` adds sidecars. Self-hosted runners can themselves run in containers (ARC `dind` mode, or the runner image on a Docker host).
- **Jenkins:** `agent { docker { image 'node:20'; label 'docker'; args '-v $HOME/.npm:/root/.npm' } }` (Docker Pipeline plugin) on agents with Docker installed.
- **Bitbucket:** every step is a container (`image:`); self-hosted "Linux Docker" runners do the same on your host.
- **Azure Pipelines:** `container:` jobs on Linux agents; `services:` for sidecars.
- **CircleCI:** the `docker` executor; `setup_remote_docker` for building images.
