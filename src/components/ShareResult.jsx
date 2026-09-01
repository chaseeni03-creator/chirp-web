import { useState } from 'react'
import { copyToClipboard } from '../lib/share'

export default function ShareResult({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyToClipboard(text)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-4">
      <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--color-text)]">{text}</pre>
      <button
        onClick={handleCopy}
        className="mt-3 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white"
      >
        {copied ? 'Copied!' : 'Copy Result'}
      </button>
    </div>
  )
}
