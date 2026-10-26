---
description: Build Docker images in CI and deploy them to Kubernetes — build mode, registry, Helm/GitOps, rollback.
argument-hint: "[what to containerize/deploy, e.g. 'GitLab, API image, EKS staging + prod']"
---

Plan the container delivery, Rio style: $ARGUMENTS

- `image:` registry/path, tag rule (commit SHA, semver on tags), digest hand-off to deploy jobs, base image pin. Never deploy `latest`.
- `build:` the mode and why — rootless BuildKit/Buildah (default), Docker-in-Docker with TLS (privileged pool only), socket binding (trusted single-project host only) — plus registry layer cache and platforms.
- Supply chain: scan, SBOM, keyless cosign signing via CI OIDC; critical findings gate with an owned exception list.
- `cluster:` GitLab agent `ci_access` or cloud OIDC → short-lived kubeconfig; namespaced ServiceAccount/Role per environment; never a stored cluster-admin kubeconfig.
- `deploy:` push (`helm upgrade --install --atomic --wait`) or GitOps (bump the digest in a config repo for Argo CD/Flux); namespace per environment; review apps with auto-stop; production serialised and gated.
- `yml:` the build and deploy jobs.
- `risk:` privileged runners, registry and cluster credentials, rollback (`helm rollback`, `kubectl rollout undo`, revert GitOps commit).
- `proof:` `hadolint`, `helm lint`, `helm template | kubeconform`, `kubectl diff`, then a run with the image pushed by digest, `rollout status` complete and a smoke test green.

Runner-side Docker / Kubernetes executors → /rio-runner. Use the `rio-container` skill references (docker-build, kubernetes-deploy). Production rollouts and deletions are confirmed with Sensei. Address the user as **Sensei**.
