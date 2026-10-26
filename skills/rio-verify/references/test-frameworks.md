# Test frameworks in CI

| Stack | Framework | CI command | Report |
|---|---|---|---|
| Android native | JUnit / Robolectric (unit) | `./gradlew testDebugUnitTest` | `app/build/test-results/testDebugUnitTest/*.xml` |
| Android native | Espresso (instrumented) | `./gradlew connectedDebugAndroidTest` | `app/build/outputs/androidTest-results/connected/**/*.xml` |
| iOS native | XCTest / XCUITest | `xcodebuild test -resultBundlePath ...` | `.xcresult` → JUnit via converter |
| Flutter | `flutter test` (unit/widget) | `flutter test --machine \| tojunit > report.xml` (`junitreport` package) | JUnit |
| Flutter | `integration_test` | `flutter test integration_test -d <device>` / `flutter drive` | JUnit via the same converter |
| React Native | Jest | `jest --ci --reporters=default --reporters=jest-junit` | `junit.xml` |
| React Native | Detox | `detox build -c android.emu.release && detox test -c android.emu.release` | `jest-junit` |
| Any mobile | Maestro (YAML flows) | `maestro test flows/ --format junit --output report.xml` | JUnit |
| Any mobile | Appium (WebDriver) | test runner of the client language (pytest, JUnit, WebdriverIO) | that runner's JUnit |
| Web | Playwright | `npx playwright test --reporter=junit,html` | JUnit + HTML report artifact |
| Web | Cypress | `cypress run --reporter junit` | JUnit |
| Backend | pytest / JUnit / go test | `pytest --junitxml=report.xml`, `gotestsum --junitfile report.xml` | JUnit |
| Contract | Pact | consumer publishes pacts; provider verifies in its pipeline | broker results |

## Surfacing reports

| CI | Test report | Coverage |
|---|---|---|
| GitLab | `artifacts: reports: junit: report.xml` (MR widget + pipeline Tests tab) | `coverage: '/regex/'` on the job + `artifacts: reports: coverage_report: { coverage_format: cobertura, path: coverage.xml }` |
| GitHub | a JUnit reporter action (e.g. `dorny/test-reporter`, `mikepenz/action-junit-report`) or upload as artifact | Codecov / coverage comment action; `$GITHUB_STEP_SUMMARY` |
| Jenkins | `junit 'build/**/*.xml'` | Coverage plugin (`recordCoverage`) |
| Azure | `PublishTestResults@2` | `PublishCodeCoverageResults@2` |
| Bitbucket | auto-detects JUnit XML in `test-results`/`test-reports` dirs | third-party |
| CircleCI | `store_test_results: path: test-results` | `store_artifacts` + third-party |

Always upload reports **when the job fails** too (`artifacts: when: always`, `if: always()` / `!cancelled()`, `post { always { junit ... } }`, `condition: succeededOrFailed()`).

## Runtime validation after deploy

```bash
# Health check with bounded wait
for i in $(seq 1 30); do
  curl -fsS "$APP_URL/healthz" && exit 0
  sleep 10
done
echo "health check failed after 5 minutes" >&2
exit 1
```

- Smoke suite: a tagged subset (`@smoke`) of E2E against the deployed URL / installed build.
- Synthetics: scheduled pipeline (or monitoring tool) hitting critical user paths every N minutes in production.
- Mobile post-release: crash-free users and ANR rates from Firebase Crashlytics / Play Console vitals / App Store Connect metrics feed the rollout halt decision.
