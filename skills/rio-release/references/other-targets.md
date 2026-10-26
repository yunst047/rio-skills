# Other deployment targets

## Firebase App Distribution (pre-release mobile builds)

- fastlane plugin `firebase_app_distribution` or the Firebase CLI: `firebase appdistribution:distribute app.aab --app "$FIREBASE_APP_ID" --groups "qa" --release-notes-file notes.txt`.
- Auth with a Google service account (OIDC via GCP Workload Identity Federation where the CI supports it); avoid `firebase login:ci` tokens.
- AAB distribution requires the Firebase project linked to the Play app; APK works without it.
- Microsoft App Center was retired in 2025 — migrate its distribution to Firebase App Distribution, TestFlight or Play internal testing.

## Kubernetes

Full build-and-deploy detail (image builds, cluster access, Helm, GitOps, review apps) lives in `rio-container`. Summary:

- Build image once, tag with the git SHA, push to the registry; deploy by digest.
- Push-based: `helm upgrade --install app ./chart --set image.tag=$SHA --atomic --wait --timeout 10m` (`--atomic` rolls back on failure).
- Pull-based (GitOps): CI updates the image tag in a config repo; Argo CD / Flux syncs. The CI never holds cluster-admin credentials.
- Rollback: `helm rollback app <rev>` or revert the config-repo commit.

## Google Cloud Run

`gcloud run deploy app --image "$IMAGE@$DIGEST" --region <region> --no-traffic --tag "c$CI_PIPELINE_IID"` then shift traffic with `gcloud run services update-traffic app --to-tags c$CI_PIPELINE_IID=10` → 100. Rollback: move traffic back to the previous revision.

## AWS ECS

Register a new task definition with the image digest, `aws ecs update-service --force-new-deployment`, deployment circuit breaker with rollback enabled; or CodeDeploy blue/green for traffic shifting.

## Vercel / Netlify (web front-ends)

- Prefer their Git integration for previews; from CI use the CLI with a scoped token: `vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN"`, `netlify deploy --prod --dir dist --auth "$NETLIFY_AUTH_TOKEN"`.
- Rollback: promote the previous deployment (instant on both platforms).

## Gate pattern for any target

```
build (once, by digest) → deploy staging (auto) → smoke tests → approval (named role) → deploy prod (canary/staged) → health check window → complete or rollback
```
