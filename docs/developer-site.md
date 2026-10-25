# Developer website

This guide covers local website development. For CI, permissions, deployment,
and recovery, see [Repository workflows](repository-workflows.md#sdk-documentation-and-publication).

## Get started

Use the Node version in [`.node-version`](../.node-version) and npm version in
[`package.json`](../package.json). Python, Git, Rust, and Go are also required;
see the [build workflow](../.github/workflows/build-docs.yml) for their setup.
Place `qortoo-rs` and `qortoo-go` beside this checkout, or set `QORTOO_RS_DIR` and
`QORTOO_GO_DIR` to their paths. The build also needs a sibling `qortoo-bench`
checkout with `origin/bench-data`, or explicit `QORTOO_BENCH_DIR` and
`QORTOO_BENCH_REF` overrides. Run commands from the website repository root.

```sh
npm ci
npm run dev
```

For a static preview matching the GitHub Pages layout:

```sh
npm run build
npm run preview
```

Open [the local preview](http://127.0.0.1:4173/qortoo/). It serves the generated
`out/` directory; rebuild after edits. The dev server supports live reload for
website code, but SDK documentation changes require restarting `npm run dev`.

## Where to edit

| Content | Source |
| --- | --- |
| SDK guides and API comments | The owning SDK repository. |
| Shared Developer guides | This repository's `docs/`; published under `/docs/developer/`. |
| Portal introduction and API guidance | `site-content/docs/`. |
| SDK source refs and guide order | [`docs-sources.json`](../docs-sources.json). |
| Website presentation and navigation | `src/` and the relevant navigation metadata. |

Edit Markdown originals, not generated `content/`, `public/generated/`, or `out/`.
SDK and Developer guides use an H1 title; React syntax and YAML frontmatter are
not required. Keep referenced files in the source repository. Missing targets
fail collection; source links point to the selected commit on GitHub.

Documentation uses a single sidebar tree ordered by `site-content/docs/meta.json`:
Overview, SDK guides, Developer guides, API reference, and Benchmarks. The documentation
layout omits shared shortcut links to avoid duplicating tree destinations; the homepage
keeps them in its header. Grouping and page titles do not change document URLs.
Group labels use uppercase, bold accent text and a divider to distinguish them from links.

## Preview SDK changes

By default, collection reads committed SDK guides and APIs from the configured
refs. It does not fetch repositories or switch SDK branches. To use each local
checkout's current commit:

```sh
QORTOO_RS_REF=HEAD QORTOO_GO_REF=HEAD npm run build
```

For tracked, uncommitted SDK guide edits:

```sh
QORTOO_DOCS_WORKTREE=1 QORTOO_RS_REF=HEAD QORTOO_GO_REF=HEAD npm run build
```

This mode shows a preview notice. New, untracked SDK documents/assets are not
collected, and API references still use the selected commit. Shared Developer
guides read the current website checkout, including new local Markdown files.
Source links identify committed content, so they do not show uncommitted edits.
Use committed inputs for publication.

For a fork, set `QORTOO_RS_REPOSITORY=owner/qortoo-rs` or
`QORTOO_GO_REPOSITORY=owner/qortoo-go` along with its directory and ref.
`out/generated/sources.json` records the site, guide, API, and benchmark revisions.

## Validate changes

```sh
npm test
npm run check:fixture
npm run build
npm run check:types
npm run check:export
```

The fixture check builds a temporary test SDK. Run the normal build afterward
to restore the intended public output. Export checks verify local links, assets,
and selected source revisions.

## Implementation reference

| Area | Source |
| --- | --- |
| Guide collection and link/asset conversion | [Collector](../scripts/prepare-docs.mjs), [document transforms](../scripts/lib/documents.mjs). |
| Rust API: public rustdoc pages, all features | [API builder](../scripts/build-api.mjs). |
| Go API: exported declarations without compiling cgo | [Go extractor](../scripts/go-api/main.go). |
| Mermaid rendering and layout | [Diagram component](../src/components/mermaid.tsx). |
| SDK validation, publication, and retry | [Repository workflows](repository-workflows.md#sdk-documentation-and-publication). |
| Official benchmark data display | [Benchmark results](benchmark-results.md). |
