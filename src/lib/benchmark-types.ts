export type SDK = 'rust' | 'go';
export type Source = { repository: string; sha: string };
export type Statistics = { count: number; median: number; mean: number; min: number; max: number; p95: number; stddev: number };
export type Scenario = { id: string; operation: string; payload?: string; budget: number; rust: Statistics; go: Statistics };
export type BenchmarkRun = {
  id: string; url: string; time: number; sources: Record<SDK, Source>;
  harnessSha: string; summaryPath: string; scenarios: Scenario[];
};
export type BenchmarkGroup = {
  id: string; label: string; currentRunId: string; runs: BenchmarkRun[]; revisionDifferences: string[];
  environment: Record<string, string>;
  conditions: { rustc: string; go: string; profile: string; features: string[]; contractId: string; contractSha: string; protocol: string };
};
export type BenchmarkTopic = { id: string; suiteId: string; groups: BenchmarkGroup[]; operations: string[] };
export type BenchmarkView = { repository: string; revision: string; topics: BenchmarkTopic[] };
export type BenchmarkPoint = {
  name: string; sdk: SDK; rate: number; stats: Statistics; scenario: Scenario;
  run: BenchmarkRun; group: BenchmarkGroup; latest: boolean;
};
export type BenchmarkLine = {
  id: string; name: string; sdk: SDK; payload?: string; payloadIndex: number; environmentIndex: number;
  runCount: number; points: BenchmarkPoint[];
};
