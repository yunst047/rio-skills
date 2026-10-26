---
name: rio-container
description: >
  Rio's container plan — build Docker/OCI images in CI and deploy them to
  Kubernetes. Covers image build modes (Docker-in-Docker with TLS, socket
  binding, rootless BuildKit/Buildah), buildx caching and multi-arch, tagging
  and deploy-by-digest, registry auth (GitLab registry, GHCR, ECR, GAR, ACR),
  image scanning, SBOM and signing; and Kubernetes delivery: cluster access via
  the GitLab agent or cloud OIDC, Helm/kustomize, GitOps with Argo CD/Flux,
  namespaces per environment, review apps, rollout, rollback and validation.
  Use when the user says "build docker image in CI", "docker in docker",
  "kaniko", "buildx", "push to registry", "deploy to kubernetes", "helm
  deploy", "k8s pipeline", "review app", "rio-container", or invokes
  /rio-container. Runner-side Docker and Kubernetes executors live in
  rio-runner.
---

Build the image once, deploy it by digest, Sensei. (Address the user as Sensei.)

## Method

1. **inventory:** Dockerfiles, compose files, charts/manifests, registries, clusters, environments (namespaces), and which runner executor the jobs land on (`rio-runner`).
2. **build mode:** Pick by runner and trust level — most isolated mode that works:
   - rootless BuildKit / Buildah — no privileged container; default on shared or Kubernetes runners,
   - Docker-in-Docker with TLS — needs a privileged runner; isolate it on its own pool,
   - Docker socket binding — fastest, but every job is root on the host; one trusted project per host only.
   Detail and snippets: `references/docker-build.md`.
3. **image contract:** Tag with the commit SHA (and semver on release tags); deploy by **digest**; never deploy `latest`. Multi-stage Dockerfile, `.dockerignore`, pinned base images, registry layer cache.
4. **supply chain:** Scan (Trivy/Grype or the platform's container scanning), generate an SBOM, sign keylessly with cosign through CI OIDC. Gate on critical findings with an explicit, owned exception list.
5. **cluster access:** GitLab agent for Kubernetes (`ci_access`) or cloud OIDC → short-lived kubeconfig. A namespaced ServiceAccount + Role per environment; never a stored cluster-admin kubeconfig. Detail: `references/kubernetes-deploy.md`.
6. **delivery model:** Push (CI runs `helm upgrade --atomic`) for simple setups; GitOps (CI bumps the image digest in a config repo, Argo CD/Flux syncs) when several clusters or strict audit are involved.
7. **environments:** Namespace per environment; review apps per MR with auto-stop; production serialised (`resource_group` / `concurrency`) and gated.
8. **prove:** `hadolint` on Dockerfiles, `helm lint` + `helm template | kubeconform`, `kubectl diff` / Argo CD diff before apply, `kubectl rollout status` after, smoke test against the service. Rollback path stated: `helm rollback`, `kubectl rollout undo`, or revert the GitOps commit.

## Output

- `image:` registry/path, tag rule, digest hand-off (dotenv / job output), base image pin.
- `build:` chosen mode and why; cache strategy; platforms.
- `cluster:` access method, ServiceAccount/Role scope, namespace per environment.
- `deploy:` push or GitOps, chart/overlay, rollout strategy, timeout.
- `yml:` the build and deploy jobs.
- `risk:` privileged runners, registry credentials, cluster permissions, rollback.
- `proof:` lint commands and the first run: image pushed with digest, rollout status complete, smoke test green.

## Rules

- Build once per commit; every environment deploys the same digest.
- Privileged containers only on a dedicated, labelled runner pool — never on shared runners that also run untrusted MR jobs.
- No secrets in image layers or build args; use BuildKit secret mounts (`--secret`).
- Kubernetes secrets come from External Secrets / Sealed Secrets / CSI driver, not from CI variables echoed into manifests.
- Production rollouts are confirmed with Sensei; `kubectl delete` on shared namespaces is never assumed.

## Boundaries

Plans and writes image builds and deploy jobs; applying to production clusters,
deleting namespaces or registry images is confirmed with Sensei. "stop
rio-container" or "normal mode" reverts.
