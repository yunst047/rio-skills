# Pipeline schedule plan

## Cadence split

| Cadence | Typical jobs | Budget |
|---|---|---|
| Every push | lint, unit, compile | under ~10 min |
| Every MR/PR | full tests, build, preview / internal build | under ~25 min |
| Merge to main | build once, publish, deploy staging | — |
| Tag / release | promote artifact, store upload, prod deploy | gated |
| Nightly | full regression, E2E on all devices, long integration suites | off-hours |
| Weekly | dependency updates, SAST/DAST, license scan, cert/profile expiry check, cache warm | off-hours |
| Monthly | rotate short-lived test credentials, clean old artifacts/registries | — |
| On demand | release with dropdown variables (env, track, rollout %) | manual |

## Cron rules

- Pick off-peak minutes (`17 2 * * *`, not `0 0 * * *`). Shared runners and hosted services queue at the top of the hour.
- Write the timezone next to every cron in the plan.
- One schedule per purpose; pass a variable (`SCHEDULE_KIND=nightly`) and gate jobs on it, instead of many near-duplicate pipelines.

## Platform behaviour

**GitLab** — pipeline schedules are created in the UI or API (not in YAML), each with cron, **timezone**, target branch and variables. A schedule runs as its owner; if the owner loses access the schedule stops — give schedules to a service account or a long-lived maintainer. Gate jobs with:

```yaml
nightly_e2e:
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule" && $SCHEDULE_KIND == "nightly"
```

**GitHub Actions** — `on: schedule: - cron:` in YAML, **UTC only**, runs on the default branch, minimum interval 5 minutes, best-effort (can be delayed under load). Scheduled workflows in public repos are disabled after 60 days without repository activity. Gate with `if: github.event_name == 'schedule'`; use multiple cron entries and `github.event.schedule` to tell them apart.

**Jenkins** — `triggers { cron('H 2 * * *') }`; `H` hashes the minute per job to spread load. Timezone via `TZ=Asia/Jakarta` as the first line of the cron spec.

**Azure Pipelines** — `schedules:` in YAML with `cron`, `branches.include`, `always: true` to run even with no changes (otherwise it skips if nothing changed). Cron is UTC.

**Bitbucket** — schedules are set in the UI per branch / custom pipeline. **CircleCI** — scheduled pipelines (triggers) set in project settings, with pipeline parameters. **Bitrise / Codemagic** — scheduled builds in the web UI per workflow.

## Schedule matrix template

| Job | Trigger | Cron | TZ | Runner pool | Owner | Reader |
|---|---|---|---|---|---|---|
| nightly_regression | schedule | `17 2 * * *` | Asia/Jakarta | linux-build + android-emulator | QA lead | QA channel, morning standup |
| ios_e2e_nightly | schedule | `37 2 * * *` | Asia/Jakarta | macos-xcode | iOS lead | iOS channel |
| dependency_scan | schedule | `23 3 * * 1` | UTC | linux-build | Security | Security, MR auto-created |
| cert_expiry_check | schedule | `5 4 * * 1` | UTC | linux-build | Release manager | release channel (alert at < 30 days) |
