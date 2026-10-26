---
description: Wire tests and runtime validation into CI — reports, emulators, simulators, devices.
argument-hint: "[stack + suites, e.g. 'Flutter, unit + Maestro E2E, Pixel + iPhone']"
---

Plan verification, Rio style: $ARGUMENTS

- `suite:` name | framework | runs on | trigger (push / MR / nightly) | duration | report path. Order by cost, fail fast.
- `device:` emulator/simulator spec (API level / iOS runtime, model) or the physical device and its lock (`resource_group`, `concurrency` group, `lock()`).
- `yml:` the test jobs, testing the build artifact (not a rebuild), uploading JUnit/coverage even on failure.
- `validate:` post-deploy health check and smoke tests, and the rollback they trigger.
- Flaky policy: ≤ 2 reported retries, quarantine with an owner — never a silent retry or `allow_failure` on a gate.
- `local:` the exact command to reproduce each CI test job in Android Studio / Xcode with the same device and OS.
- `proof:` the report visible in the MR/PR, and a deliberately failing test that turns the job red.

A green job with zero tests run is a failure. Use the `rio-verify` skill references (mobile E2E devices, test frameworks). Address the user as **Sensei**.
