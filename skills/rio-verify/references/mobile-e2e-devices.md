# Mobile E2E: emulators, simulators, physical devices

## Android emulator in CI (Linux + KVM)

```bash
# Image pre-baked or installed once per runner image
sdkmanager "platform-tools" "emulator" "system-images;android-34;google_apis;x86_64"
echo "no" | avdmanager create avd -n ci -k "system-images;android-34;google_apis;x86_64" -d pixel_6 --force

emulator -avd ci -no-window -no-audio -no-boot-anim -no-snapshot \
  -gpu swiftshader_indirect -camera-back none &
adb wait-for-device
adb shell 'while [ "$(getprop sys.boot_completed | tr -d "\r")" != "1" ]; do sleep 2; done'
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0

./gradlew connectedDebugAndroidTest      # reports: app/build/outputs/androidTest-results/connected/
```

- **Gradle Managed Devices** — declare devices in `build.gradle(.kts)` (`testOptions.managedDevices`) and run `./gradlew pixel6Api34DebugAndroidTest`; Gradle downloads the image, boots, runs and tears down. Good for reproducibility; still needs KVM.
- GitHub Actions: enable KVM (see `rio-runner` → `github-runners.md`); the community action `reactivecircus/android-emulator-runner` wraps the boot sequence.
- Collect on failure: `adb logcat -d > logcat.txt`, screenshots/video (`adb shell screenrecord`), test results XML.

## iOS simulator in CI (macOS)

```bash
xcrun simctl list runtimes
UDID=$(xcrun simctl create ci-iphone "iPhone 16" "com.apple.CoreSimulator.SimRuntime.iOS-18-2")
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b

xcodebuild test \
  -workspace App.xcworkspace -scheme App \
  -destination "id=$UDID" \
  -resultBundlePath build/TestResults.xcresult \
  -parallel-testing-enabled NO

xcrun simctl delete "$UDID"
```

- Convert `.xcresult` to JUnit with `xcresulttool`-based converters (e.g. `xcbeautify --report junit`, `trainer`, `xcresultparser`) so the CI test tab can render it. Keep the `.xcresult` as an artifact for screenshots and logs.
- Build once with `xcodebuild build-for-testing`, then `test-without-building` on one or more simulators — the build is the expensive part.
- Pin the simulator runtime; a runner image update can silently change the default iOS version.

## Physical devices

**Android (USB on a device-lab host)**
- `adb devices -l` → device must be `device`, not `unauthorized`. Target with `ANDROID_SERIAL=<serial>`.
- Keep awake: `adb -s $ANDROID_SERIAL shell svc power stayon usb`. Disable animations as above.
- Wireless debugging (`adb pair`, `adb connect`) works but is less stable for CI; prefer USB.

**iOS (USB/network on a Mac)**
- Device paired and trusted, **Developer Mode** on, the device UDID in the development provisioning profile (match `force_for_new_devices`).
- `xcrun devicectl list devices` (Xcode 15+) to discover; `xcodebuild test -destination "platform=iOS,id=<UDID>"`.
- `xcrun devicectl device install app --device <UDID> App.app` for install-only flows (e.g. Maestro/Appium).

**Locking (one job per device)**

| CI | Lock |
|---|---|
| GitLab | `resource_group: device-pixel8` on the job |
| GitHub | `concurrency: { group: device-pixel8, cancel-in-progress: false }` |
| Jenkins | `lock(resource: 'device-pixel8') { ... }` |
| Azure | environment with an **Exclusive lock** check |

## Cloud device farms

- **Firebase Test Lab** — `gcloud firebase test android run --type instrumentation --app app.apk --test app-test.apk --device model=oriole,version=34`; iOS via XCTest zip. Auth via GCP WIF.
- **BrowserStack App Automate / AWS Device Farm / Sauce Labs** — upload build + test package via API, poll, download JUnit.
- Use farms for breadth on nightly; use emulators/simulators for MR speed.

## Reproduce locally

**Android Studio**
- Device Manager → create the **same** AVD (device profile, API level, ABI) as CI. Run the same Gradle task from the terminal: `./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.app.LoginTest`.
- Logcat filtered by the package; Layout Inspector for UI state; wireless debugging for physical devices.
- Download the CI `logcat.txt` and test XML artifacts and compare timestamps with the failure.

**Xcode**
- Window → Devices and Simulators: create the same simulator (model + runtime) as CI, or connect the same physical device.
- Run the exact CI command (`xcodebuild test ... -destination ...`) in Terminal first; then open the CI `.xcresult` in Xcode to see the failing step, screenshots and logs.
- Debug → Attach to Process for a running app on a device; Test navigator → run the single failing test with breakpoints.
