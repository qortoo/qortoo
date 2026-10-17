---
title: API reference
description: Find public types and methods for your language.
---

The guides explain how to use Qortoo. API references describe its public types and methods.

## Rust

[Open the Rust API reference](/docs/rust-api/)

Browse types and methods in individual pages, follow links to SDK source, or use
the site search. The reference includes all optional features, including observability; your application enables
only the features it needs. See [Observability](/docs/rust/observability/) for setup.

To generate the same API surface from a local SDK checkout:

```sh
cargo doc --locked --no-deps -p qortoo --all-features --open
```

Cargo writes the reference to `target/doc/`. For the default feature set, omit
`--all-features`. Start with [Getting Started](/docs/rust/getting-started/) for a first example.

## Go

[Open the Go API reference](/docs/go-api/)

Browse exported types, constants, functions, and methods. The reference is generated
from the SDK's Go declarations and documentation comments, with links to the exact
source revision. API pages and guides use the same SDK revision.

Follow [Getting Started](/docs/go/getting-started/) to install the native SDK and
run an example. From a configured Go SDK checkout, you can also inspect a symbol:

```sh
go doc github.com/qortoo/qortoo-go.Client
```
