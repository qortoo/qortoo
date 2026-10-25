import generated from '../../public/generated/benchmarks/view.json';
import type { BenchmarkView } from '@/lib/benchmark-types';
import { PerformanceTopicClient } from './performance-topic';

export function PerformanceOverview() {
  const view = generated as BenchmarkView;
  const groups = view.topics.flatMap(topic => topic.groups);
  return <div className="performance-overview">
    <div><small>Benchmark topics</small><strong>{new Set(view.topics.map(topic => topic.suiteId)).size}</strong><span>Counter &amp; Variable SDK paths</span></div>
    <div><small>CPU profiles</small><strong>{new Set(groups.map(group => group.environment.cpu)).size}</strong><span>Most measured environment enabled</span></div>
    <div><small>Retained official runs</small><strong>{new Set(groups.flatMap(group => group.runs.map(run => run.id))).size}</strong><span>Fixed snapshot · full available history</span></div>
  </div>;
}

export function PerformanceTopic({ topicId }: { topicId: string }) {
  const view = generated as BenchmarkView;
  const topic = view.topics.find(topic => topic.id === topicId);
  if (!topic) throw new Error(`Missing benchmark topic: ${topicId}`);
  return <PerformanceTopicClient topic={topic} repository={view.repository} revision={view.revision} />;
}
