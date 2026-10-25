import site from '../../site.config.json';
import type { ComponentProps } from 'react';
import { Mermaid } from './mermaid';
import { PerformanceOverview, PerformanceTopic } from './performance';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

function DocumentLink(props: ComponentProps<'a'>) {
  const Anchor = defaultMdxComponents.a;
  if (props.href?.startsWith('/generated/')) return <a {...props} href={site.basePath + props.href} />;
  return <Anchor {...props} />;
}

function DocumentImage(props: ComponentProps<typeof defaultMdxComponents.img>) {
  const Image = defaultMdxComponents.img;
  const src = typeof props.src === 'string' && props.src.startsWith('/generated/') ? site.basePath + props.src : props.src;
  return <Image {...props} src={src} />;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Mermaid,
    PerformanceTopic,
    PerformanceOverview,
    a: DocumentLink,
    img: DocumentImage,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
