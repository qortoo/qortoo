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

The website renders documentation owned by the SDK repositories. SDK Markdown stays
in those repositories so changes to code and its documentation can be reviewed together.
Generated content, dependencies, and exported HTML are ignored by Git.

### Local development

Use Node.js 26.12.0 (see `.node-version`), npm 11.20.0, Python 3, and Git. Place
`qortoo-rs` and `qortoo-go` beside this checkout, or set `QORTOO_RS_DIR` and
`QORTOO_GO_DIR` to their checkout paths.

```sh
npm ci
npm run build
npm run check:types
npm run check:export
npm run preview
```

Open `http://127.0.0.1:4173/qortoo/`. The preview serves only the static `out/`
directory under the GitHub Pages project path; it has no application server or
fallback to client-side routing. Use `npm run dev` for development with live reload.
Rerun the command after SDK documentation changes to refresh generated inputs.

By default, collection reads each SDK's committed `HEAD`, not its uncommitted files.
`out/generated/sources.json` records the source commits, input file hashes, and
whether the SDK docs have local changes. For a preview of tracked document edits:

```sh
QORTOO_DOCS_WORKTREE=1 npm run build
```

Worktree previews are labeled in the manifest; source links still point to `HEAD`
and therefore do not include uncommitted edits. New, untracked documents are not
collected. Build from committed inputs for reproducible publication.

The collector derives page titles from H1 headings, maps SDK document links to the
site, and pins source/example links to SDK commits. The site uses Fumadocs with
Next.js static export, browser-side search, and Mermaid rendering. SDK pages remain
`.md`; they do not need React syntax or YAML frontmatter. A site-owned rendering
fixture exercises images because the SDK docs currently contain no image nodes.

API reference integration and remote deployment are not configured yet.
