import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'
import BottomTabBar from './BottomTabBar'
import WaitlistFooter from './WaitlistFooter'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)] pb-28 sm:pb-0">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-5 sm:px-4 sm:py-8">
        <Outlet />
      </main>
      <WaitlistFooter />
      <BottomTabBar />
    </div>
  )
}
