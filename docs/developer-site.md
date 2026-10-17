# Developer website

The website renders documentation owned by the SDK repositories. SDK Markdown stays
in those repositories so changes to code and its documentation can be reviewed together.
Generated content, dependencies, and exported HTML are ignored by Git.

## Local development

Run the commands below from the repository root; paths in this guide are relative to it.

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

The Documentation workflow checks source transformations, fixture builds, static
export, types, and internal links for pull requests and pushes to `main`. It uses
read-only repository permissions and does not deploy the site.

API reference integration and remote deployment are not configured yet.
