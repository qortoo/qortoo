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

Counter and Variable each offer operation tabs. Variable compares its serialized
JSON payload sizes in one chart. The environment with the most retained official
runs is enabled initially; reference environments can be enabled in the legend.
Ties use the latest eligible measurement date, then the series ID. CPU, OS,
toolchain, build settings, SDK path, and payload retain separate lines. Different
workload contracts or measurement protocols render separate charts.

Charts and current-value tables display `op/sec`, where higher is better:
`1,000,000,000 / median_ns_per_op`, calculated before rounding. This is the inverse
of a latency median, not a median of per-round throughput or a concurrent-load
capacity test. Details retain the latency median and standard deviation in
`ns/op` across ten measured round means; warmup is excluded. Standard deviation
is not inverted into a throughput error bar or treated as tail latency.

The X-axis follows run/attempt identity with equal spacing. Labels show short UTC
measurement dates and the measured Rust/Go commits; dates are not an elapsed-time
axis. Equal date labels do not merge runs. The range slider expands dense labels.
Hover previews a point, and clicking retains its details. Keyboard controls and
measurement selectors provide the same information without hovering. Tabs support
arrow keys, Home, and End. Charts follow the document theme and container size.

Diamonds mark publisher-selected current results. SDK ancestry selects the
current result; run completion order does not override that choice. Descriptions
link to the default environment's current Rust/Go workload code and contract,
pinned to its measured harness commit. Individual measurement details retain
their own pinned code links, raw samples, execution logs, source commits, and
conditions. Hosted-runner variation means small differences alone are not proof
of a regression. These SDK benchmarks do not measure server/network performance.

The page explicitly identifies SDK revisions that differ from the documentation
build. It shows the latest registered main request per SDK by attempt order.
Failures retain previously published values and their dates. An empty official
index produces a no-measurement state. PR candidates, smoke, exploratory, and
dirty runs never supply public current values.

Interactive chart inputs are derived from the verified build snapshot under
`generated/benchmarks/view.json`. The MDX page passes the selected topic to a
client component; it does not fetch live GitHub data. ECharts is loaded when the
chart renders, using only the required chart, interaction, and SVG modules.
Current-value tables and source links are included in the static export.

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
