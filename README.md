# Qortoo

Qortoo is a pre-release project for conflict-free replicated datatypes (CRDTs),
atomic transactions, and synchronization. Its currently available components are SDKs;
server components are planned but are not yet available. Start with the SDK for your language:

- [Rust SDK](https://github.com/qortoo/qortoo-rs) — core implementation and Rust API;
  see its [documentation index](https://github.com/qortoo/qortoo-rs/blob/main/docs/README.md).
- [Go SDK](https://github.com/qortoo/qortoo-go) — Go bindings for the Rust core;
  see its [documentation index](https://github.com/qortoo/qortoo-go/blob/main/docs/README.md).

Each SDK repository owns its current feature scope, setup instructions, API reference,
and contribution guide.

## Developer website

See [Repository workflows](docs/repository-workflows.md) for repository roles and
the SDK validation, benchmark, and publication flow, or browse the published
[Developer guides](https://qortoo.github.io/qortoo/docs/developer/).

Visit [qortoo.github.io/qortoo](https://qortoo.github.io/qortoo/) for SDK guides and API references.

See the [developer site guide](docs/developer-site.md) for local development,
documentation sources, and validation.

The [Performance page](https://qortoo.github.io/qortoo/docs/performance/) displays
official SDK benchmark results. See [benchmark result collection](docs/benchmark-results.md)
for snapshot validation, measurement interpretation, and refresh/retry behavior.
