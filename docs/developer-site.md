# Developer website

The website renders documentation owned by the SDK repositories. SDK Markdown stays
in those repositories so changes to code and its documentation can be reviewed together.
Generated content, dependencies, and exported HTML are ignored by Git.

## Local development

Run the commands below from the repository root; paths in this guide are relative to it.

Use Node.js 26.12.0 (see `.node-version`), npm 11.20.0, Python 3, Git, Rust 1.97.1, and Go 1.27.2. Place
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

## Documentation sources

`docs-sources.json` defines each SDK repository, input ref, and sidebar order. The
current default is each SDK's `main` branch in the local checkout. Collection
resolves that ref to one commit before reading its tracked Markdown and assets.
It does not fetch repositories or silently switch to uncommitted content.

Override a source revision when reviewing a particular change:

```sh
QORTOO_RS_REF=HEAD QORTOO_GO_REF=HEAD npm run build
```

`out/generated/sources.json` records the build time, site and SDK revisions, source
file hashes, asset hashes, and local documentation changes. For a preview of tracked
document edits:

```sh
QORTOO_DOCS_WORKTREE=1 QORTOO_RS_REF=HEAD QORTOO_GO_REF=HEAD npm run build
```

Worktree previews display a notice. Source links still point to the selected commit
and therefore do not contain uncommitted edits. New, untracked documents and assets
are not collected. Build from committed inputs for publication.

The collector derives titles from H1 headings and preserves their original anchors.
It maps SDK document links to the site and pins source/example links to SDK commits.
Referenced local images and documentation attachments are copied into ignored build
assets. Missing local targets fail the build. Relative links outside the repository
are rejected; explicit links to other historical versions remain external.

SDK pages remain `.md`; they do not need React syntax or YAML frontmatter. Site-owned
introduction and API guidance live in `site-content/docs/`. Homepage examples are
extracted from SDK getting started guides. Change SDK behavior explanations in the
owning SDK repository; change navigation and presentation in this repository.

Diagrams use SVG text labels. The renderer fits a diagram to the available width
when it needs at most 15% reduction, preserves its aspect ratio, and recalculates
on resize. Smaller diagrams retain their original size; wider diagrams retain
their original size and keyboard-accessible horizontal scrolling for readability.

## Validation

```sh
npm test
npm run check:fixture
npm run build
npm run check:types
npm run check:export
```

The fixture check temporarily adds a test SDK to verify image imports, reference
images, downloadable assets, and heading anchors through the production build.
Run the normal build afterward to restore the public documentation output.
Fixtures are not included in normal navigation or search.

## API references

`npm run build` collects guides, extracts Go API declarations, generates Rust API
pages, and exports the complete website. `npm run dev` refreshes both API references
before starting the development server.

The Rust reference lives at `/qortoo/docs/rust-api/`, with individual pages for
public types, traits, functions, constants, and aliases. It shares the portal's
layout, navigation, themes, and search with the guides and Go reference.

The generator uses `cargo doc --locked --no-deps -p qortoo --all-features`, including
optional observability APIs. It converts the pinned compiler's stable rustdoc HTML
to Markdown; it does not need nightly Rust or a separate Rust syntax parser. Member
anchors and links between API pages are preserved, including rustdoc re-export
redirects. Signatures and examples remain Rust code blocks. Source links point to
the exact SDK commit and line range on GitHub. Related API links include types used
in signatures. Dependency API pages remain external; an explicit map resolves
known incomplete links in copied dependency comments using Cargo.lock versions.
Missing local targets, unsupported pages, and conflicting routes fail the build.

This presents rustdoc content within the portal. The portal's search replaces
rustdoc's separate symbol/signature search; source browsing uses GitHub. Private
SDK items are excluded by rustdoc's public-documentation policy.

The Go reference lives at `/qortoo/docs/go-api/` and participates in the portal's
search. A standard-library `go/parser` and `go/doc` extractor reads exported
root-package declarations and comments for Linux/amd64 with cgo enabled. It respects
build constraints, excludes tests and private declarations, and does not compile or
load SDK dependencies. This works without native headers or libraries. Type and
method sections include source links pinned to the collected SDK revision.

Both extractors use temporary snapshots of the same committed revisions as the
guides. Both API references are generated under ignored `content/` and exported
under `out/docs/`. Intermediate rustdoc HTML and compilation caches live in ignored
`.cache/`. Worktree previews affect guides only; API references still use
the selected commit. `out/generated/sources.json` records each API revision and
build policy. Generated API pages are not committed.

The public pkg.go.dev package URL returned HTTP 404 during integration. The portal
therefore serves its own Go reference and does not rely on external indexing.

## GitHub Pages

The Documentation workflow validates transformations, fixtures, types, and exported
links on pull requests and pushes to `main`. The build job has read-only repository
permissions. Only successful builds of `main` from push or manual dispatch upload a
Pages artifact and enter the separate deployment job. That job alone requests
`pages: write` and `id-token: write`, using the `github-pages` environment.

Enable Pages with **GitHub Actions** as the publishing source in the repository's
Settings → Pages before the first deployment. The intended public URL is
`https://qortoo.github.io/qortoo/`, matching `site.config.json`. Deployment publishes
`out/` as an artifact; it does not commit generated HTML to `main` or a `gh-pages`
branch. A failed build never reaches deployment.

The workflow resolves SDK refs at build time. SDK changes do not automatically
trigger this repository's workflow yet; manually dispatch the workflow after an SDK
update. Candidate SDK PR validation and automatic cross-repository triggers are
separate follow-up work.
