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

For a fork candidate, set `QORTOO_RS_REPOSITORY=owner/qortoo-rs` or
`QORTOO_GO_REPOSITORY=owner/qortoo-go` as well as the directory and commit ref.
Source links then identify the fork's exact commit. Links to the upstream SDK's
current guides still resolve inside the portal.

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

## SDK pull request validation

The SDKs' **Developer website** workflows call this repository's read-only
`build-docs.yml` workflow. Each call supplies its PR head repository and full SHA,
including fork heads. The resolver checks them against the originating PR event.
The selected SDK uses that commit; the other SDK uses its configured default ref.
All refs, including the website, resolve to immutable SHAs before the build job
checks out any candidate code. Guides and API references use the same SDK SHA.

Candidate runs build fixtures, guides, APIs, types, and internal links. They have
`contents: read`, do not inherit secrets, and do not upload a Pages artifact or enter
the deployment job. Rust documentation generation can execute candidate build
scripts, so validation stays on hosted runners with no deployment credentials.
The workflow uses `pull_request`; it does not run candidate code under
`pull_request_target` or a privileged `workflow_run` follow-up.

The SDK callers follow the centrally maintained workflow on `qortoo/main`. Each
run records the resolved website and SDK commits in its job summary and in
`out/generated/sources.json`, including its Actions run URL. Changing prose or API
comments in an SDK does not require editing a website component.

To validate a candidate manually, run **Documentation** from this repository's
Actions tab, choose `rust` or `go`, and enter its repository and full SHA. This
validation does not publish. For local validation, use the matching repository
checkout and the directory/ref/repository environment variables above, then run
the commands in **Validation**. Do not use worktree mode to validate a commit.

## Automatic updates and recovery

The SDKs' **Developer website** workflows request a website refresh when a `main`
push changes documentation, API sources, or related build inputs. Their separate
`refresh` job calls `workflow_dispatch` for `qortoo/qortoo`'s **Documentation**
workflow on `main`. It does not check out SDK code. PR jobs only validate the
candidate and cannot enter this job. There is no scheduled polling.

Configure an Actions secret named `DOCS_SITE_DISPATCH_TOKEN` for both SDK
repositories, either as repository secrets or an organization secret restricted
to those repositories. Use a fine-grained token restricted to `qortoo/qortoo`,
with **Actions: read and write**; Contents write and Pages permissions are not
needed. A GitHub App installation token with the same repository permission can
also call this endpoint. The ordinary SDK `GITHUB_TOKEN` does not grant write
access to the website repository. Do not pass this secret to PR validation.
The refresh job fails explicitly if the secret is missing or the dispatch fails.

The website resolves both SDK default refs when it receives the request. This
publishes their latest committed guides and API references together, even when
two SDK merges produce requests in a different order. A successful dispatch means
the website run was requested; confirm its build/deploy result and public manifest
separately. The SDK job logs the website run URL when returned by GitHub.

To retry, manually run **Developer website** on `main` in an SDK, or run
**Documentation** on `main` in the website with candidate SDK set to `none`.
Only successful, non-candidate `main` push or manual runs can upload and deploy a
Pages artifact. A failed build leaves the existing public site in place. Failed
builds and deployments can be retried from Actions.

After deployment, the workflow checks the public manifest against the validated
website, guide and API commits, retrying while publication becomes visible.
Candidate manual runs use a separate concurrency group so they do not cancel a
publication in progress.

When integrating this automation, merge the `qortoo` reusable workflow before
merging the SDK caller workflows, and configure the dispatch secret. Verify a successful SDK candidate run and a
failing candidate run, then verify the post-merge refresh and public manifest.
Making the SDK validation check required in branch protection is a separate
repository setting. Local checks establish build behavior; they do not establish
that the workflows have been activated or that publication succeeded.
