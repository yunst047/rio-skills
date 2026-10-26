# Jenkins, Azure Pipelines, Bitbucket and CircleCI runners

## Jenkins

- **Controller runs no builds** — set the built-in node's executors to 0.
- **Agents:** permanent (SSH or inbound/JNLP) for macOS hosts and device labs; cloud agents (Kubernetes plugin, EC2 plugin) for elastic Linux.
- **Labels** select agents: `agent { label 'macos-xcode-16' }`. Kubernetes pod templates: `agent { kubernetes { yaml '''...''' } }`.
- **Executors per agent** = concurrency on that host; 1 for device hosts.
- Lock shared hardware with the Lockable Resources plugin: `lock(resource: 'pixel-8-usb') { ... }`.
- Credentials live in the Jenkins credentials store, scoped to folders; bind them per step with `withCredentials`.

## Azure Pipelines

| Type | Notes |
|---|---|
| Microsoft-hosted (`vmImage: ubuntu-latest`, `macOS-latest`, `windows-latest`) | Fresh VM per job; parallel jobs are a purchased quantity. |
| Self-hosted agent | Install the agent, register to an **agent pool** with a PAT or, preferably, a service principal / device code during setup. |
| Scale set agents (VMSS) | Azure manages autoscaling of self-hosted agents in your subscription; can tear down after each job. |
| Managed DevOps Pools | Managed self-hosted pools; check availability in your org. |

- Jobs pick pools with `pool: { name: 'mac-pool', demands: ['xcode -equals 16'] }`; capabilities are matched against demands.
- Pool permissions control which pipelines may use a pool — restrict the prod pool.

## Bitbucket Pipelines

- Cloud runners by default; **self-hosted runners** (Linux Docker, Linux shell, Windows, macOS) selected with `runs-on:` labels in a step: `runs-on: [self.hosted, macos]`.
- Step `size: 2x`/larger gives more memory on cloud runners.

## CircleCI

- Executors: `docker`, `machine` (full VM, needed for KVM / Docker builds), `macos` (choose Xcode version via `xcode:`), `windows`.
- `resource_class` sets the size; self-hosted runners use a `namespace/resource-class` resource class.
- Contexts restrict secrets to security groups — pair the prod context with a restricted runner class.
