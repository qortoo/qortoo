import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Braces, GitBranch, Layers3 } from 'lucide-react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { CodeExample } from '@/components/code-example';
import site from '../../site.config.json';
import manifest from '../../public/generated/sources.json';

const concepts = [
  { number: '01', title: 'Understand the architecture', description: 'Follow the path from a public API call to shared state and synchronization.', url: '/docs/rust/architecture/', icon: Layers3 },
  { number: '02', title: 'Choose your datatype', description: 'Accumulate changes with Counter, or keep a JSON value with Variable.', url: '/docs/rust/counter/', icon: Braces },
  { number: '03', title: 'Know what a transaction guarantees', description: 'See how local work commits together and how failed transactions roll back.', url: '/docs/rust/transaction-and-rollback/', icon: GitBranch },
];

export default function Home() {
  return <HomeLayout {...baseOptions()}>
    <div className="landing">
      <figure className="brand-landscape">
        <img src={`${site.basePath}/brand/main-logo.png`} width={2172} height={724}
          alt="Qortoo in ink brush lettering, with an archer and two horses forming infinity loops across a mountain landscape."
          fetchPriority="high" />
      </figure>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" />CRDT SDKs for Rust & Go</div>
          <h1>Shared state.<br /><span>Clear guarantees.</span></h1>
          <p className="hero-description">Build with conflict-free replicated datatypes, local atomic transactions, and explicit synchronization contracts.</p>
          <div className="hero-actions">
            <Link className="action-primary" href="/docs/">Explore the docs <ArrowRight size={17} /></Link>
            <Link className="action-secondary" href="https://github.com/qortoo/qortoo">View on GitHub <ArrowUpRight size={16} /></Link>
          </div>
          <p className="release-note"><span>Pre-release</span>Start with the in-process backends. Server components are planned.</p>
        </div>
        <CodeExample examples={manifest.examples} />
      </section>
      <section className="sdk-section" aria-labelledby="sdk-heading">
        <div className="section-heading"><div><p className="eyebrow">YOUR STARTING POINT</p><h2 id="sdk-heading">Choose your SDK.</h2></div><p>One Rust core. A guide for your language.</p></div>
        <div className="sdk-grid">
          <Link className="sdk-entry" href="/docs/rust/getting-started/">
            <div className="sdk-monogram" aria-hidden="true">Rs</div>
            <div><h3>Rust SDK <ArrowUpRight size={18} /></h3><p>Use the core implementation directly. Explore datatypes, transactions, and connectivity.</p><span>Get started with Rust <ArrowRight size={14} /></span></div>
          </Link>
          <Link className="sdk-entry" href="/docs/go/getting-started/">
            <div className="sdk-monogram sdk-monogram-go" aria-hidden="true">Go</div>
            <div><h3>Go SDK <ArrowUpRight size={18} /></h3><p>Work with the Go API backed by the Rust core. Set up the native SDK and create your first datatype.</p><span>Get started with Go <ArrowRight size={14} /></span></div>
          </Link>
        </div>
      </section>
      <section className="concept-section" aria-labelledby="concept-heading">
        <div className="section-heading"><div><p className="eyebrow">BEYOND THE FIRST EXAMPLE</p><h2 id="concept-heading">Understand what happens next.</h2></div><Link href="/docs/rust/">All core concepts <ArrowRight size={15} /></Link></div>
        <div className="concept-layout"><div className="concept-list">{concepts.map(({ number, title, description, url, icon: Icon }) => <Link key={number} href={url} className="concept-row">
          <span className="concept-number">{number}</span><Icon size={21} className="concept-icon" /><div><h3>{title}</h3><p>{description}</p></div><ArrowUpRight size={19} />
        </Link>)}</div>
          <figure className="concept-art" aria-hidden="true"><img src={`${site.basePath}/brand/emblem.png`} width={1254} height={1254} alt="" loading="lazy" /></figure>
        </div>
      </section>
      <section className="reference-strip"><div><p className="eyebrow">LOOKING FOR A TYPE OR METHOD?</p><h2>Go straight to the API.</h2></div><Link className="action-secondary" href="/docs/api/">API reference <ArrowRight size={16} /></Link></section>
    </div>
    <footer className="site-footer"><span>Qortoo · CRDTs, transactions, synchronization.</span><div><Link href="/docs/">Documentation</Link><a href="https://github.com/qortoo/qortoo">GitHub <ArrowUpRight size={12} /></a></div></footer>
  </HomeLayout>;
}
