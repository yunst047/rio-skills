# macOS (iOS) and Android emulator hosts

## macOS / Xcode hosts

**Hardware options**
- Owned Mac minis / Mac Studios (Apple silicon) in a rack — cheapest per minute at steady load.
- Hosted macOS on the CI service (GitHub, GitLab SaaS, Azure, CircleCI, Bitrise, Codemagic, Xcode Cloud) — zero ops, highest per-minute cost.
- Rented bare metal (MacStadium, AWS EC2 Mac — dedicated host with a minimum allocation period, check current terms).

**Isolation**
- Apple's macOS licence allows **at most 2 macOS VMs per Mac host**. Plan slots accordingly.
- VM per job: **Tart** (Cirrus Labs; check its licence terms for larger fleets) or **Anka** (Veertu, commercial). Golden image per Xcode version; clone → run → delete.
- Bare `shell` runner: acceptable for a single trusted project; wipe DerivedData and temp keychains after each job.

**Toolchain**
- One image (or host) per Xcode major; tag it `macos-xcode-16`. Select a minor with `xcodes select` / `sudo xcode-select -s /Applications/Xcode_16.2.app` in the job.
- Pre-install: Xcode + simulators for the OS versions under test, CocoaPods/SwiftPM caches, Ruby + bundler (fastlane), Homebrew packages pinned.
- Disable sleep, automatic updates and screen lock; enable auto-login only for VM images used for UI tests that need a session.
- Keychains: create a temporary keychain per job (fastlane `setup_ci` or `create_keychain`) and delete it in cleanup.

**Capacity** — iOS jobs are the critical path in most mobile pipelines. Put only Xcode work on macOS: lint, Dart/Kotlin/JS unit tests and Android builds go to Linux.

## Android emulator hosts

- Emulators need **hardware acceleration**: KVM on Linux (bare metal or VMs with nested virtualization), Hypervisor.framework on macOS.
- Check on the host: `ls -l /dev/kvm` and `emulator -accel-check`.
- Container executors: pass `/dev/kvm` into the container (`devices = ["/dev/kvm"]` in GitLab Runner docker config, or `--device /dev/kvm`).
- Size: ~2 vCPU + 2–4 GB RAM per running emulator, plus the Gradle build itself.
- Pre-bake system images (`sdkmanager "system-images;android-34;google_apis;x86_64"`) into the image to avoid downloads per job.
- On Apple silicon hosts use `arm64-v8a` system images; on x86 Linux use `x86_64`.

## Physical device lab

- One host (Linux for Android, Mac for iOS) with a powered USB hub; runner executor `shell`, tags `device-lab`.
- Each device is a lockable resource: GitLab `resource_group: device-pixel8`, Jenkins `lock('device-pixel8')`, GitHub `concurrency: device-pixel8` with `cancel-in-progress: false`.
- Android: `adb devices` must list the device as `device` (authorised). Keep screens awake (`adb shell svc power stayon usb`).
- iOS: device paired and trusted with the Mac, Developer Mode on, provisioning profile includes the device UDID. List with `xcrun devicectl list devices`.
- Health-check job on a schedule: each device online, battery above a threshold, OS version as recorded.
