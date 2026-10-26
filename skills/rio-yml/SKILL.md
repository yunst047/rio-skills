---
name: rio-yml
description: >
  Rio's pipeline YAML — write or refactor CI configuration with minimal
  redundancy: job declaration, templates and reuse (extends, anchors, includes,
  reusable workflows, shared libraries), linear stage sequencing, parallel jobs
  and needs/DAG dependencies, matrix fan-out, concurrency that never kills
  another running job (resource_group, concurrency groups, locks), artifact
  handling for results and for hand-off across runners, dropdown variables on
  the web UI for manual runs, and scheduled pipelines. Covers GitLab CI, GitHub
  Actions, Jenkinsfile, Azure Pipelines, Bitbucket, CircleCI, Bitrise,
  Codemagic and Xcode Cloud. Use when the user says "write the gitlab-ci",
  "github workflow", "reduce duplication in yml", "parallel jobs", "needs",
  "job dependency", "artifacts between jobs", "dropdown variable", "manual
  pipeline with options", "schedule pipeline", "rio-yml", or invokes /rio-yml.
---

Minimal YAML, explicit dependencies, nothing destroyed by accident, Sensei.
(Address the user as Sensei.)

## Method

1. **read:** Read the existing CI files and the plan (`rio-plan`) first. Identify the platform, the job shapes, and what is duplicated.
2. **declare:** One job per responsibility; names say what and where (`build:android`, `test:unit`, `deploy:staging`). Every job declares its runner tags/labels, timeout, rules/conditions and artifacts.
3. **reduce:** Extract repeated setup into one template per job shape (GitLab `extends`/`!reference`/`include`, GitHub reusable workflow or composite action, Jenkins shared library, Azure templates). Target: a change to the setup touches one place.
4. **sequence:** Linear order with stages when every job of a stage must finish first; DAG with `needs`/`dependsOn` when a job only depends on specific jobs; fan-out with matrix; fan-in with a job that `needs` all branches.
5. **concurrency:** Decide per job what may overlap. Builds and tests of different commits may run in parallel and may be auto-cancelled when superseded (`interruptible`, `cancel-in-progress: true` for PRs only). Deploys and shared devices are serialised, **never cancelled mid-run** (`resource_group`, `concurrency` with `cancel-in-progress: false`, locks).
6. **artifacts:** Separate *result artifacts* (JUnit, coverage, reports — uploaded even on failure) from *hand-off artifacts* (APK/AAB/IPA, dist, images — passed to downstream jobs on other runners). Hand-off goes through the CI artifact store or a registry, never a runner's local disk. Set expiry. Cache is for speed only; nothing correct may depend on a cache hit.
7. **inputs:** Manual runs get dropdown variables (environment, track, rollout %) where the platform supports it, with safe defaults.
8. **schedules:** Gate schedule-only jobs on the pipeline source and a schedule variable; the schedule itself is set where the platform keeps it (UI for GitLab, YAML for GitHub/Azure).
9. **prove:** Lint, then a real run.

Platform syntax and copy-ready snippets — load the file for the platform in use:
- GitLab CI: `references/gitlab-ci.md`
- GitHub Actions: `references/github-actions.md`
- Jenkins: `references/jenkins.md`
- Azure Pipelines: `references/azure-pipelines.md`
- Bitbucket Pipelines and CircleCI: `references/bitbucket-circleci.md`
- Bitrise, Codemagic, Xcode Cloud: `references/mobile-ci-services.md`

## Output

- `flow:` the job graph (stages + needs), as text or mermaid.
- `yml:` the complete file(s), minimal, with pinned images/actions; templates first, jobs after.
- `concurrency:` which jobs serialise on which group, and which may be auto-cancelled.
- `artifacts:` producer job → path → consumer jobs → expiry.
- `proof:` lint command for the platform and the first run to watch.

## Lint commands

| Platform | Lint |
|---|---|
| GitLab | `glab ci lint` (or the pipeline editor's Validate) |
| GitHub | `actionlint` |
| Jenkins | Declarative linter: `curl -X POST -F "jenkinsfile=<Jenkinsfile" $JENKINS_URL/pipeline-model-converter/validate` |
| Azure | Run with "Validate only" / `az pipelines run` dry preview via the REST preview endpoint |
| Bitbucket | Bitbucket Pipelines validator in the UI |
| CircleCI | `circleci config validate` |
| Bitrise | `bitrise validate` |

## Rules

- No duplicated script blocks across jobs; three similar jobs means a template or a matrix.
- Image builds and Kubernetes deploy jobs follow `rio-container` (rootless build by default, deploy by digest).
- Pin images by version (digest for release jobs) and third-party actions by commit SHA.
- `allow_failure` / `continue-on-error` only for genuinely advisory jobs, labelled as such — never on a gate.
- Deploy jobs: protected environment, serialised, not interruptible, rollback documented.
- Until lint and a real run pass, label the result "a plan, not a pipeline".

## Boundaries

Writes and refactors CI files; pushing to protected branches, running deploy
jobs, or deleting pipelines is confirmed with Sensei. "stop rio-yml" or "normal
mode" reverts.
