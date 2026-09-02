import { Component } from 'react'

// React error boundaries require a class component — there's no hook
// equivalent for componentDidCatch/getDerivedStateFromError. Without this,
// any render-time crash (e.g. an edge case right after the Google OAuth
// redirect) unmounts the whole tree with zero fallback, and since the page
// background is near-black, that reads as a blank/black screen with no way
// to recover short of manually retyping the URL.
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Uncaught render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-6 text-center text-[var(--color-text)]">
          <span className="text-4xl">🦜</span>
          <p className="text-lg font-bold">Something went wrong.</p>
          <p className="text-sm text-[var(--color-text-secondary)]">Give it another try.</p>
          <button
            onClick={() => {
              window.location.href = '/'
            }}
            className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white"
          >
            Back to Home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
