import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'
import BottomTabBar from './BottomTabBar'
import WaitlistFooter from './WaitlistFooter'
import WelcomeTour from './WelcomeTour'

const TOUR_DISMISSED_KEY = 'chirp-web:welcome-tour-dismissed'

export default function Layout() {
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_DISMISSED_KEY)) setShowTour(true)
    } catch {
      // localStorage unavailable — just skip the tour rather than show it every load
    }
  }, [])

  function dismissTour() {
    setShowTour(false)
    try {
      localStorage.setItem(TOUR_DISMISSED_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)] pb-28 sm:pb-0">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-5 sm:px-4 sm:py-8">
        <Outlet />
      </main>
      <WaitlistFooter />
      <BottomTabBar />
      {showTour && <WelcomeTour onClose={dismissTour} />}
    </div>
  )
}
