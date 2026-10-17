import { source } from '@/lib/source';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import { FileCode2, Pencil, ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import manifest from '../../../../public/generated/sources.json';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const origin = manifest.pages.find((entry) => entry.url.replace(/\/$/, '') === page.url.replace(/\/$/, ''));
  const sdk = origin && manifest.sources.find((entry) => entry.id === origin.sdk);
  const Body = page.data.body;
  return <DocsPage toc={page.data.toc}>
    <div className="doc-kicker"><span className="status-dot" />Development documentation{sdk && <><span className="kicker-divider">/</span>{sdk.title}</>}</div>
    <DocsTitle id={origin?.h1Anchor}>{page.data.title}</DocsTitle>
    {page.data.description && <DocsDescription>{page.data.description}</DocsDescription>}
    {origin && <div className="doc-source-bar">
      <span>Source <a href={`https://github.com/${sdk!.repository}/commit/${sdk!.sha}`} className="revision-link">{sdk!.sha.slice(0, 7)}</a></span>
      <div><a href={origin.sourceUrl}><FileCode2 size={14} />View source</a><a href={origin.editUrl}><Pencil size={14} />Edit on GitHub<ArrowUpRight size={12} /></a></div>
    </div>}
    {manifest.mode === 'worktree' && <p className="worktree-notice">This preview includes local documentation edits. Source links show the committed version.</p>}
    <DocsBody><Body components={getMDXComponents()} /></DocsBody>
  </DocsPage>;
}

export function generateStaticParams() { return source.generateParams(); }
export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const page = source.getPage((await props.params).slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
