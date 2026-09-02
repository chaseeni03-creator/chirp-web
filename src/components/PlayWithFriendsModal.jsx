import { useNavigate } from 'react-router-dom'
import GroupOnboarding from './GroupOnboarding'

export default function PlayWithFriendsModal({ onClose }) {
  const navigate = useNavigate()

  function handleDone() {
    onClose()
    navigate('/groups')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]"
        >
          ✕
        </button>
        <GroupOnboarding onDone={handleDone} />
      </div>
    </div>
  )
}
