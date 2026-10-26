# Multi-repo streamline plan

## Choose the model

| Model | When | Cost |
|---|---|---|
| Monorepo + path rules | Teams release together; shared code changes often | One big pipeline; needs `rules:changes` / path filters to stay fast |
| Polyrepo + shared templates | Services release independently; same pipeline shape | Template versioning discipline |
| Polyrepo + orchestrator | Release needs several repos in a fixed order (backend → app) | Orchestrator pipeline must own the order and the versions |

Rio's default: **polyrepo + one versioned template repo**, plus an orchestrator only when the release order is real.

## The contract between repos

Repos never reach into each other's workspace. They exchange:

1. **Versioned templates** — a `ci-templates` repo, tagged (`v1.4.0`). Consumers pin a tag, never `main`.
2. **Published artifacts** — packages, container images, AAB/IPA in a registry. The downstream job consumes a version, not a path on a runner.
3. **Explicit triggers** — the upstream pipeline triggers downstream with the version as a variable.

## Platform mechanics

**GitLab**
- Templates: `include: project: 'group/ci-templates', ref: 'v1.4.0', file: '/android.yml'`, or CI/CD components (`include: component: $CI_SERVER_FQDN/group/components/android@1.4.0`) with `spec: inputs`.
- Downstream: `trigger: project: group/app, branch: main, strategy: depend` (multi-project), or `trigger: include:` for parent-child in the same repo. `strategy: depend` makes the upstream wait for and mirror the downstream result.
- Pass versions: `variables:` on the trigger job are forwarded to the downstream pipeline.

**GitHub Actions**
- Templates: reusable workflows (`uses: org/ci-templates/.github/workflows/android.yml@v1.4.0`) and composite actions. An org-level `.github` repo can host workflow templates for new repos.
- Downstream: `workflow_call` within reach, `repository_dispatch` / `workflow_dispatch` via API across repos (needs a GitHub App token or fine-grained PAT, scoped to the target repo).

**Jenkins** — shared libraries (`@Library('ci-lib@v1.4.0') _`), `build job: 'app/main', parameters: [...]`, `wait: true`.

**Azure Pipelines** — templates from another repo via `resources: repositories:` with a `ref: refs/tags/v1.4.0`; pipeline triggers via `resources: pipelines:`.

**Bitbucket / CircleCI** — Bitbucket shares pipeline config across repos within a workspace (check plan availability); CircleCI uses orbs (versioned) and the API to trigger pipelines in other projects.

## Release order template

```
backend (tag v2.3.0) → publish image → trigger contract-tests (in app repo, API_VERSION=2.3.0)
  → app release pipeline (tag 5.1.0, requires API >= 2.3.0) → store
```

Write the minimum compatible version of each dependency into the release notes or a manifest file; the orchestrator checks it before promoting.

## Template upgrade policy

- Semver the template repo; breaking change = major.
- Renovate / Dependabot opens MRs in consumers when a template tag is released.
- Keep the previous major working for a stated period. Noa will check that the deprecation date in the changelog matches the one in the template.
