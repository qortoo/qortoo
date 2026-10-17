'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Copy } from 'lucide-react';

export function CodeExample({ examples }: { examples: Record<string, string> }) {
  const [language, setLanguage] = useState('rust');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const example = examples[language] ?? '';
  async function copy() {
    try { await navigator.clipboard.writeText(example); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <section className="example-panel" aria-label="SDK code example">
    <div className="example-toolbar">
      <div className="example-languages" role="group" aria-label="Example language">
        {['rust', 'go'].map((id) => <button key={id} type="button" aria-pressed={language === id}
          onClick={() => { setLanguage(id); setCopied(false); setCopyError(false); }}>{id === 'rust' ? 'Rust' : 'Go'}</button>)}
      </div>
      <button className="copy-example" type="button" onClick={copy} aria-label={copied ? 'Code copied' : 'Copy example'}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
    <div className="example-filename"><span />{language === 'rust' ? 'A first Counter · Rust' : 'A first Counter · Go'}</div>
    <pre tabIndex={0} aria-label={`${language === 'rust' ? 'Rust' : 'Go'} example`}><code>{example}</code></pre>
    <div className="example-footer">
      <span role="status">{copyError ? 'Select the code to copy it manually.' : 'From the SDK getting started guide'}</span>
      <Link href={`/docs/${language}/getting-started/`}>Full guide <ArrowUpRight size={14} /></Link>
    </div>
  </section>;
}
