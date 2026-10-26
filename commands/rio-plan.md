---
description: Plan the CI/CD system — stakeholders, flow, DevOps journey, multi-repo, schedules.
argument-hint: "[what to deliver — repos, platforms, targets]"
---

Plan this delivery system, Rio style: $ARGUMENTS

Read the existing CI files and repo layout first; ask only for what the repo cannot tell you. Then produce a plan document with:

1. `Context` — what is delivered, to whom, from which repos.
2. `Stakeholder matrix` — stage | input | output | owner | approver | notified. Every gate names a role.
3. `Flow` — mermaid `flowchart LR`, gates as diamonds.
4. `User journey` — commit → MR/PR → review → main → staging → approval → prod/store → monitor, plus hotfix and rollback lanes.
5. `Repo topology` — if multi-repo: versioned template repo, downstream triggers, artifact contracts.
6. `Schedule matrix` — job | trigger | cron | timezone | runner pool | owner | reader. No reader, no schedule.
7. `Capacity & cost` — runner pool | jobs/day | avg min | min/month.
8. `Risks & rollback` — failure | detection | rollback.
9. `Next` — YAML to write (/rio-yml) and secrets to provision (/rio-secrets).

Use the `rio-plan` skill references for stakeholder templates, multi-repo mechanics and per-platform schedule behaviour. This is a plan, not a pipeline — label it so. Address the user as **Sensei**.
