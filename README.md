<p align="center">
  <img src="assets/rio-hero.png" width="200" alt="Tsukatsuki Rio — President of the Millennium Seminar">
</p>

<h1 align="center">Rio</h1>

<p align="center">
  <em>She plans the pipeline before she writes it. She calculates the cost before she spends it. She proves it before she calls it done. ...As calculated.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/mode-seminar%20president-4b5563?style=flat-square" alt="Seminar President mode">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/badge/fan%20project-Blue%20Archive-3aa0ff?style=flat-square" alt="Blue Archive fan project">
</p>

---

You know the pipeline. Forty jobs, six copies of the same `before_script`, a deploy that sometimes cancels the other deploy, an iOS build on a Mac nobody remembers setting up, and a Play Store key in a variable nobody dares to touch.

**Rio** puts [Tsukatsuki Rio](CREDITS.md) — President of the Millennium Seminar — inside your AI agent as a **CI/CD planner and implementer**. Where her clubmate [Koyuki](https://github.com/yunst047/niha-skills) *cracks what's stuck*, Rio *plans what ships*: stakeholders and flow, runners (Docker and Kubernetes executors included), secrets and OIDC, Docker images and Kubernetes deploys, Terraform, Play Store / App Store / fastlane, device testing, and DRY pipeline YAML.

**Calculated, not controlling.** She calculates every path before acting. Sensei and the stakeholders decide; she makes the decision safe and repeatable.

## How it works

For any CI/CD task, the agent stops at the rung the task needs:

```
1. Inventory.  → inputs, outputs, stakeholders. Who needs what, who approves where.
2. Map.        → trigger → build → verify → package → release → observe, with gates.
3. Calculate.  → critical path, parallelism, runner minutes, cost, failure points.
4. Contain.    → secret scope, OIDC first, concurrency that never kills a deploy, rollback.
5. Write.      → minimal YAML: templates, explicit needs, pinned versions, artifacts with expiry.
6. Prove.      → lint, a real run, reports and artifacts where the next job expects them.
```

Until step 6 passes, the result is labelled **a plan, not a pipeline**. She never commits or echoes secrets, never `allow_failure`s a real gate to go green, never deploys to production without a rollback, and never lets concurrency cancel someone else's running deploy.

## What she covers

| Skill | Scope |
|---|---|
| `rio-plan` | Input / output / stakeholder matrix, DevOps user journey, multi-repo streamline (versioned templates, downstream triggers, artifact contracts), schedule plan (per-commit, nightly, weekly, cron with timezones) |
| `rio-runner` | Executor choice (Docker executor, Kubernetes executor / Helm chart / ARC, shell, VM), runner settings, multi-runner pools and tag taxonomy, capacity math, macOS/Xcode hosts, Android emulator KVM, device labs |
| `rio-secrets` | Variable scoping and protection, OIDC / workload identity to AWS, GCP, Azure, Vault; service accounts and access keys as fallbacks; mobile signing material |
| `rio-container` | Docker image builds (rootless BuildKit, DinD with TLS, socket binding), registries, caching, multi-arch, scan/SBOM/sign; Kubernetes deploys via GitLab agent or cloud OIDC, Helm, GitOps, review apps, rollback |
| `rio-terraform` | Terraform / OpenTofu in CI: plan on MR, apply the saved plan behind approval, remote state and locking, OIDC plan/apply roles, policy and security scans, scheduled drift detection, Atlantis / HCP Terraform |
| `rio-release` | fastlane (match, gym, supply, pilot, deliver), Google Play Developer API, App Store Connect API, Firebase App Distribution, Kubernetes / Cloud Run / ECS / Vercel / Netlify, staged rollout and rollback |
| `rio-verify` | Test placement and reports, runtime validation, emulators / simulators / physical devices / device farms, reproducing CI failures in Android Studio and Xcode |
| `rio-yml` | Job declaration, redundancy reduction, linear / parallel / DAG sequencing, safe concurrency, artifact hand-off across runners, dropdown variables, schedules |

**Platforms:** GitLab CI, GitHub Actions, Jenkins, Azure Pipelines, Bitbucket Pipelines, CircleCI, Bitrise, Codemagic, Xcode Cloud. Each skill keeps platform detail in `references/` files that load only when needed.

## Install

The Claude Code plugin runs two tiny Node.js lifecycle hooks, so `node` needs to be on your PATH. If it isn't, the skills and commands still work — the always-on activation just stays quiet.

### Claude Code

```
/plugin marketplace add yunst047/rio-skills
/plugin install rio@rio
```

Then start a new session. On `SessionStart` the persona activates at the default level (**seminar**); the `UserPromptSubmit` hook tracks `/rio` switches. An optional statusline badge shows the active mode (`[RIO:SEMINAR]`) — the plugin offers to set it up on first run.

### Any repo, without the marketplace

```bash
git clone https://github.com/yunst047/rio-skills
node rio-skills/bin/rio-install.js /path/to/your/repo      # install into .claude/
node rio-skills/bin/rio-install.js /path/to/your/repo -u   # uninstall
```

### Other agents (always-on rules)

This repo ships a portable [`AGENTS.md`](AGENTS.md) — the compact persona. Codex (`~/.codex/AGENTS.md`), OpenCode, and any agent that reads `AGENTS.md` pick it up with no setup. For Cursor / Windsurf / Cline / Copilot, copy `AGENTS.md` into that tool's rules file.

## Commands

| Command | What it does |
|---------|--------------|
| `/rio [memo \| seminar \| big-sister \| off]` | Set the intensity, or turn it off. No argument uses the default. |
| `/rio-plan` | Plan the CI/CD system: stakeholders, flow, journey, multi-repo, schedules. |
| `/rio-runner` | Plan runners: executors, settings, pools, capacity. |
| `/rio-secrets` | Plan variables and cloud auth: scope, OIDC, service accounts, signing. |
| `/rio-container` | Build Docker images in CI and deploy to Kubernetes. |
| `/rio-terraform` | Run Terraform / OpenTofu through CI: plan, apply, state, drift. |
| `/rio-release` | Automate releases: Play, App Store / TestFlight, fastlane, deploy targets. |
| `/rio-verify` | Wire tests and runtime validation: reports, emulators, simulators, devices. |
| `/rio-yml` | Write or refactor pipeline YAML. |
| `/rio-help` | Quick reference for the above. |

### Intensity levels

| Level | Energy |
|-------|--------|
| `memo` | One decision, the one risk that matters, the next action. |
| `seminar` | **Default.** Walk the protocol out loud with tagged lines; YAML only after the plan is stated. |
| `big-sister` | The whole control room: every stage, stakeholder, failure mode with rollback, cost per runner pool, schedule matrix, migration path. Still minimal YAML, still proven. |
| `off` | Normal mode. |

Set the default for every session with the `RIO_DEFAULT_MODE` env var (`off`/`memo`/`seminar`/`big-sister`) or a `defaultMode` field in `~/.config/rio/config.json` (`%APPDATA%\rio\config.json` on Windows). Default is `seminar`.

## The crew

One short beat after a real action, at most. **Toki** (Rio's C&C agent) executes once Sensei approves. **Himari** (Veritas, Rio's rival) catches leaked tokens, long-lived keys and unpinned actions. **Yuuka** audits runner minutes. **Noa** catches drift between the plan and the YAML. **Koyuki** wants to "just push to prod and see" — Rio says no. **Sensei overrules everyone.**

## Running with Koyuki

Rio and [Koyuki](https://github.com/yunst047/niha-skills) are separate plugins and can be installed together, but each injects its persona at session start — run one at a time (`/koyuki off` or `/rio off`). Saying "normal mode" turns off both.

## License & attribution

Code is [MIT](LICENSE). **Tsukatsuki Rio** and **Blue Archive** are © NEXON Games / Yostar — this is an unofficial, non-commercial fan project. The hero image is official character art © NEXON / Yostar, included as a low-res reference only (not under MIT). Persona sources and credits are in [CREDITS.md](CREDITS.md).
