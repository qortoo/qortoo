import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24">
      <p className="text-sm text-fd-muted-foreground">Qortoo developer documentation</p>
      <h1 className="text-4xl font-semibold tracking-tight">Build with Qortoo.</h1>
      <p>Explore the Rust and Go SDK guides and core concepts. Qortoo is a pre-release project.</p>
      <div className="flex gap-6">
        <Link className="underline" href="/docs/rust/">Rust documentation</Link>
        <Link className="underline" href="/docs/go/">Go documentation</Link>
      </div>
    </main>
  );
}
