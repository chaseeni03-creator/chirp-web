import { Outlet } from 'react-router-dom'
import Header from './Header'
import WaitlistFooter from './WaitlistFooter'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <WaitlistFooter />
    </div>
  )
}
