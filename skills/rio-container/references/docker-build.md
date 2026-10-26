# Building Docker / OCI images in CI

Action and image versions shown are the majors the author last verified; pin images by digest and actions by commit SHA in real repos.

## Choose the build mode

| Mode | Needs | Speed | Risk | Use when |
|---|---|---|---|---|
| Rootless BuildKit (`moby/buildkit:rootless`) | Unprivileged container | Good (registry cache) | Low | Default for shared and Kubernetes runners |
| Buildah (`quay.io/buildah/stable`) | Unprivileged with `--storage-driver vfs`, or fuse | OK | Low | Red Hat / Podman shops |
| Docker-in-Docker (`docker:dind` service) | **Privileged** runner | Good | Job can escape to the host via privileged | Need full `docker` CLI (compose, `docker run` tests) |
| Socket binding (`/var/run/docker.sock`) | Host Docker socket mounted | Fastest (host layer cache) | Every job is root on the host and sees other jobs' containers | One trusted project per dedicated host |
| Kaniko | Unprivileged | OK | Low | Legacy setups — the upstream project was archived in 2025; prefer BuildKit/Buildah or a maintained fork |

## GitLab — Docker-in-Docker with TLS

Runner (`config.toml`): `privileged = true`, `volumes = ["/certs/client", "/cache"]` (see `rio-runner` → `docker-executor.md`).

```yaml
build:image:
  stage: build
  image: docker:27
  services:
    - name: docker:27-dind
      alias: docker
  tags: [docker-privileged]
  variables:
    DOCKER_HOST: tcp://docker:2376
    DOCKER_TLS_CERTDIR: "/certs"
    DOCKER_TLS_VERIFY: "1"
    DOCKER_CERT_PATH: "/certs/client"
    IMAGE: $CI_REGISTRY_IMAGE/app
  before_script:
    - echo "$CI_REGISTRY_PASSWORD" | docker login -u "$CI_REGISTRY_USER" --password-stdin "$CI_REGISTRY"
  script:
    - docker buildx create --use
    - >
      docker buildx build
      --cache-from type=registry,ref=$IMAGE:buildcache
      --cache-to type=registry,ref=$IMAGE:buildcache,mode=max
      --tag $IMAGE:$CI_COMMIT_SHA
      --push
      --metadata-file metadata.json
      .
    - echo "IMAGE_DIGEST=$(grep -o '"containerimage.digest":[^,]*' metadata.json | cut -d'"' -f4)" > image.env
  artifacts:
    reports:
      dotenv: image.env          # downstream jobs get $IMAGE_DIGEST
```

## GitLab — rootless BuildKit (no privileged)

```yaml
build:image:
  stage: build
  image:
    name: moby/buildkit:rootless
    entrypoint: [""]
  tags: [linux-build]
  variables:
    BUILDKITD_FLAGS: --oci-worker-no-process-sandbox
    IMAGE: $CI_REGISTRY_IMAGE/app
  before_script:
    - mkdir -p ~/.docker
    - >
      printf '{"auths":{"%s":{"auth":"%s"}}}' "$CI_REGISTRY"
      "$(printf '%s:%s' "$CI_REGISTRY_USER" "$CI_REGISTRY_PASSWORD" | base64 | tr -d '\n')"
      > ~/.docker/config.json
  script:
    - >
      buildctl-daemonless.sh build
      --frontend dockerfile.v0
      --local context=.
      --local dockerfile=.
      --export-cache type=registry,ref=$IMAGE:buildcache,mode=max
      --import-cache type=registry,ref=$IMAGE:buildcache
      --output type=image,name=$IMAGE:$CI_COMMIT_SHA,push=true
```

On the Kubernetes executor, rootless BuildKit also needs the pod's seccomp/AppArmor profile relaxed (`Unconfined`) — set it through the runner's pod spec or annotations, still without `privileged`.

## GitHub Actions — buildx

```yaml
name: image
on:
  push:
    branches: [main]
    tags: ["v*"]

permissions:
  contents: read
  packages: write
  id-token: write          # cosign keyless signing

jobs:
  build:
    runs-on: ubuntu-24.04
    outputs:
      digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3        # only for multi-arch via emulation
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,format=long
            type=semver,pattern={{version}}
      - id: build
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true
      - uses: sigstore/cosign-installer@v3
      - run: cosign sign --yes "ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}"
```

## Registry auth (prefer OIDC — see `rio-secrets`)

| Registry | CI auth |
|---|---|
| GitLab Container Registry | `$CI_REGISTRY_USER` / `$CI_REGISTRY_PASSWORD` (job token, scoped to the job) |
| GHCR | `GITHUB_TOKEN` with `packages: write` |
| AWS ECR | OIDC role → `aws ecr get-login-password \| docker login --username AWS --password-stdin <acct>.dkr.ecr.<region>.amazonaws.com` |
| Google Artifact Registry | WIF → `gcloud auth configure-docker <region>-docker.pkg.dev` |
| Azure ACR | federated `az login` → `az acr login -n <registry>` |
| Docker Hub | access token (not password), read-only for pulls; mind pull rate limits — mirror base images |

## Image hygiene

- Multi-stage: build stage with toolchain, runtime stage minimal (distroless / `-slim` / alpine) running as non-root.
- Pin base images by digest; let Renovate bump them.
- Secrets at build time: `RUN --mount=type=secret,id=npmrc ...` with `--secret id=npmrc,src=$NPMRC_FILE` — never `ARG TOKEN`.
- Multi-arch: QEMU emulation is slow for compiled languages; native arm64 runners + `docker buildx imagetools create` to merge manifests is faster.
- Scan: `trivy image --exit-code 1 --severity CRITICAL $IMAGE@$IMAGE_DIGEST`; GitLab `Jobs/Container-Scanning.gitlab-ci.yml` template.
- Integration tests needing containers: GitLab `services:` (postgres, redis) or `docker compose up -d` inside a DinD job; GitHub job `services:`.
- Lint: `hadolint Dockerfile`.
