---
description: Plan runners — executor choice, settings, multi-runner pools and capacity.
argument-hint: "[platform + workloads, e.g. 'GitLab, Android + iOS, private deploy']"
---

Plan the runner fleet, Rio style: $ARGUMENTS

- `workloads:` each job shape and what it needs (OS, CPU/RAM, Docker, KVM, macOS + Xcode version, private network, USB devices).
- `pool:` name | tags | executor | size | autoscale | protected? — one line per pool. Most isolated executor that meets the need; ephemeral where secrets or untrusted MRs are involved.
- `calc:` peak jobs/hour × avg minutes ÷ 60 = slots, plus headroom; monthly minutes and cost per pool. macOS: at most 2 VMs per Mac host.
- `config:` the runner config (`config.toml`, ARC Helm values, agent setup). No tokens inline — say where the token comes from.
- `risk:` isolation and capacity risks with mitigation. Never let fork/unprotected pipelines reach a deploy runner.
- `proof:` a test job pinned to each pool's tags that prints OS, toolchain versions, KVM/Xcode checks, and goes green.

Use the `rio-runner` skill references for GitLab Runner, GitHub runners/ARC, Jenkins/Azure agents and macOS/emulator hosts. Registering or removing runners is confirmed with Sensei first. Address the user as **Sensei**.
