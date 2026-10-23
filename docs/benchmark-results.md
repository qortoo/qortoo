# Benchmark results in the developer website

The Performance page consumes official benchmark data from the dedicated
`bench-data` branch in `qortoo/qortoo-bench`. Workloads, measurement contracts,
and raw results belong to Qortoo Bench; this repository owns presentation.

## Fixed build inputs

The documentation resolver pins the data branch to one commit and hashes its
index. The build checks out that commit without credentials. The collector reads
Git objects, verifies index shard hashes and each indexed official bundle's
manifest and summary hashes, and checks channel, eligibility, source identities,
full measurement statistics, and series membership. It never executes Action
history JavaScript. Invalid data fails the build rather than silently dropping
measurements or substituting results from another revision.

`generated/sources.json` and `generated/benchmarks.json` retain the data commit,
index hash, selected run IDs, manifest/summary hashes, contract hashes, and SDK
revisions. The build and post-deployment checks verify the resolved snapshot.
The public Performance page must reference the same data commit.

## Reading results

Tables show medians and standard deviations of ten round means in the declared
metric unit. Charts and history tables use only the same series: CPU, OS,
toolchain, contract, build settings, and metric identity remain separate.
SDK commits vary within a series. The publisher's ancestry-aware latest pointer
selects the current result; run completion order does not override that choice.
Raw samples, execution logs, source commits, and measurement conditions remain
linked. Hosted-runner variation means small differences alone are not proof of
a regression. These SDK benchmarks do not measure server/network performance.

The page explicitly identifies SDK revisions that differ from the documentation
build. It shows the latest registered main request per SDK by attempt order.
Failures retain previously published values and their dates. An empty official
index produces a no-measurement state. PR candidates, smoke, exploratory, and
dirty runs never supply public current values.

## Refresh and retry

Qortoo Bench's `documentation-refresh.yml` requests `docs.yml` after the central
benchmark completes, including failed attempts so request status can update.
The refresh job executes no SDK code or downloaded artifacts. Its `WORKFLOW_PAT`
requires Actions write access to `qortoo/qortoo`. Merge the website integration
before enabling the central refresh caller.

The website resolves the current data tip when each build starts; a delayed
notification cannot force an old snapshot. Refresh acceptance, build success,
Pages deployment, and public verification are separate outcomes. Retry the
central refresh workflow or the website's `docs.yml` with `candidate_sdk: none`
to publish retained results without rerunning benchmarks. SDK candidate builds
remain read-only and do not deploy.

For local builds set `QORTOO_BENCH_DIR` to a Qortoo Bench clone and
`QORTOO_BENCH_REF` to a data commit (default: `../qortoo-bench` and
`origin/bench-data`). SDK directory/ref overrides follow the existing developer
site configuration. The collector reads committed Git objects even when the
clone has unrelated working-tree changes.
