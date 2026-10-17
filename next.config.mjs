import site from './site.config.json' with { type: 'json' };
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();
export default withMDX({
  output: 'export',
  basePath: site.basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
});
