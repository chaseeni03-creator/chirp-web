import { useState } from 'react'
import { copyToClipboard } from '../lib/share'
import { useGroup } from '../context/GroupContext'
import { buildGroupShareText } from '../lib/groups'

export default function ShareResult({ text }) {
  const { group } = useGroup()
  const [copied, setCopied] = useState(false)
  const shareText = group ? buildGroupShareText(text, group) : text

  async function handleCopy() {
    const ok = await copyToClipboard(shareText)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-4">
      {group && (
        <p className="mb-2 text-xs font-bold text-[var(--color-text-secondary)]">
          Share with your group 📤 — copy your result to send in the group chat!
        </p>
      )}
      <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--color-text)]">{shareText}</pre>
      <button
        onClick={handleCopy}
        className="mt-3 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white"
      >
        {copied ? 'Copied!' : 'Copy Result'}
      </button>
    </div>
  )
}
