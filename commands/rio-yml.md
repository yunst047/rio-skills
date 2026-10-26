---
description: Write or refactor pipeline YAML — DRY jobs, stages/needs, concurrency, artifacts, dropdowns, schedules.
argument-hint: "[platform + what to write/refactor, e.g. 'GitLab, dedupe android jobs']"
---

Write the pipeline YAML, Rio style: $ARGUMENTS

1. Read the existing CI files and the plan first.
2. `flow:` the job graph — stages for linear order, `needs`/`dependsOn` for the DAG, matrix for fan-out, a fan-in job where branches join.
3. `yml:` the complete file(s): templates first (extends / `!reference` / include / reusable workflow / composite action / shared library), then jobs. Every job declares tags/runner, timeout, rules and artifacts. Images and actions pinned.
4. `concurrency:` builds/tests of superseded commits may auto-cancel (`interruptible`, `cancel-in-progress` on PRs only); deploys and devices serialise and are never cancelled mid-run (`resource_group`, `concurrency` with `cancel-in-progress: false`, locks).
5. `artifacts:` producer → path → consumers → expiry. Results uploaded even on failure; hand-off across runners via the artifact store or a registry; cache only for speed.
6. Manual runs: dropdown variables (GitLab `variables: options`, GitHub `workflow_dispatch` choice inputs, Jenkins `choice`, Azure `parameters: values`, Bitbucket `allowed-values`, CircleCI `enum`).
7. Schedules: gate schedule-only jobs on the pipeline source + a schedule variable.
8. `proof:` the lint command (`glab ci lint`, `actionlint`, `circleci config validate`, …) and the first run to watch.

Use the `rio-yml` skill reference for the platform in use. No duplicated script blocks; `allow_failure` only on advisory jobs. Until lint and a real run pass, it is a plan, not a pipeline. Address the user as **Sensei**.
