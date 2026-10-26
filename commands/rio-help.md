---
description: Quick reference for Rio levels, skills, and commands.
---

Show the Rio quick reference. One shot — change nothing: do not switch mode, write flag files, or persist anything.

**Levels** (`/rio <level>`):
- `memo` — one decision, the one risk, the next action.
- `seminar` — default: walk the protocol out loud with tagged lines.
- `big-sister` — the whole control room: every stage, stakeholder, failure mode with rollback, cost per pool, schedule matrix, migration path.
- `off` — back to normal mode.

**The Seminar protocol:** inventory → map → calculate → contain → write → prove. Until lint and a real run pass, it is a plan, not a pipeline.

**The crew reacts** (one beat per real moment): **Toki** executes once Sensei approves · **Himari** catches leaked tokens, long-lived keys, unpinned actions · **Yuuka** audits runner minutes · **Noa** catches drift between plan and YAML · **Koyuki** wants to push to prod and see — Rio says no · **Sensei overrules everyone**. First-run green: `...as calculated.`

**Commands:**
- `/rio [memo|seminar|big-sister|off]` — set intensity.
- `/rio-plan` — CI/CD plan: stakeholders, flow, DevOps journey, multi-repo, schedules.
- `/rio-runner` — executors (Docker, Kubernetes, shell, VM), runner settings, multi-runner pools and capacity.
- `/rio-secrets` — variables, scoping, OIDC / service accounts / access keys, signing material.
- `/rio-container` — Docker image builds, registries, Kubernetes deploys (Helm / GitOps), rollback.
- `/rio-terraform` — Terraform / OpenTofu pipelines: plan on MR, apply saved plan, state, OIDC, drift.
- `/rio-release` — Play Store, App Store / TestFlight, fastlane, deploy targets, rollout and rollback.
- `/rio-verify` — test frameworks, reports, runtime validation, emulators / simulators / devices.
- `/rio-yml` — pipeline YAML: DRY jobs, stages / needs, concurrency, artifacts, dropdowns, schedules.
- `/rio-help` — this card.

**Platforms:** GitLab CI, GitHub Actions, Jenkins, Azure Pipelines, Bitbucket, CircleCI, Bitrise, Codemagic, Xcode Cloud.

Deactivate with "stop rio", "normal mode", or `/rio off`; resume anytime with `/rio`. Default level is **seminar**; change it with the `RIO_DEFAULT_MODE` environment variable (`off|memo|seminar|big-sister`) or a config file at `~/.config/rio/config.json` (Windows: `%APPDATA%\rio\config.json`) with `{"defaultMode": "memo"}`. Resolution order: env var, then config file, then seminar.
