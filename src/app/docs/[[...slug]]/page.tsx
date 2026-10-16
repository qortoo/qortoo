import { source } from '@/lib/source';
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const Body = page.data.body;
  return <DocsPage toc={page.data.toc}>
    <DocsTitle>{page.data.title}</DocsTitle>
    <DocsBody><Body components={getMDXComponents()} /></DocsBody>
  </DocsPage>;
}

export function generateStaticParams() { return source.generateParams(); }
export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const page = source.getPage((await props.params).slug);
  if (!page) notFound();
  return { title: page.data.title };
}
