# GitHub Actions runners

## Options

| Type | Use for | Notes |
|---|---|---|
| GitHub-hosted standard (`ubuntu-latest`, `windows-latest`, `macos-latest`) | Most jobs | Fresh VM per job. macOS minutes bill at a large multiple of Linux — Yuuka will notice. Prefer explicit images (`ubuntu-24.04`, `macos-15`) over `-latest` for reproducible release builds. |
| GitHub-hosted larger runners | More CPU/RAM, static IPs, GPU | Org/enterprise feature; billed per minute; assign via runner groups and labels. |
| Self-hosted | Private network, devices, custom hardware | You own patching and isolation. Never use for public-repo PRs from forks. |
| Actions Runner Controller (ARC) | Autoscaled self-hosted runners on Kubernetes | Runner scale sets; ephemeral pod per job. |

## Android emulator on hosted Linux

Hosted Ubuntu runners expose KVM; enable access before starting the emulator:

```yaml
- name: Enable KVM
  run: |
    echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
    sudo udevadm control --reload-rules
    sudo udevadm trigger --name-match=kvm
```

## Self-hosted registration

Repo/org → Settings → Actions → Runners → New self-hosted runner. The registration token shown there is short-lived; automate with the REST API (`POST /orgs/{org}/actions/runners/registration-token`) or, better, just-in-time config (`POST /orgs/{org}/actions/runners/generate-jitconfig`) for single-use runners.

```bash
./config.sh --url https://github.com/ORG --token "$REG_TOKEN" \
  --labels macos-xcode-16,device-lab --ephemeral --unattended
```

- `--ephemeral` — the runner takes one job and deregisters. Use it.
- Runner **groups** (org/enterprise) restrict which repos and workflows can use a pool — put `deploy-prod` in its own group limited to the deploy workflow.

## ARC (runner scale sets)

Install the controller and one scale set per pool via Helm:

```bash
helm install arc --namespace arc-systems --create-namespace \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller

helm install linux-build --namespace arc-runners --create-namespace \
  --set githubConfigUrl="https://github.com/ORG" \
  --set githubConfigSecret=arc-github-app \
  --set minRunners=0 --set maxRunners=20 \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set
```

Jobs target it with `runs-on: linux-build` (the installation name). Authenticate ARC with a GitHub App stored in the `arc-github-app` Kubernetes secret, not a PAT.

## Settings checklist

- `runs-on` uses labels or groups that describe capability.
- Fork PR workflows never reach self-hosted runners (require approval for outside collaborators; keep self-hosted for private repos).
- Set `timeout-minutes` on every job; the default is long.
- Use `permissions:` at the workflow level with least privilege; add `id-token: write` only on jobs that do OIDC.
