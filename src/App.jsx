import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SportProvider } from './context/SportContext'
import { GroupProvider } from './context/GroupContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import ChirpGuess from './pages/ChirpGuess'
import StatLine from './pages/StatLine'
import CareerBuilder from './pages/CareerBuilder'
import Progression from './pages/Progression'
import MoreOrLess from './pages/MoreOrLess'
import Lineup from './pages/Lineup'
// import Grid from './pages/Grid' — hidden site-wide, see the /grid route below
import BeforeOrAfter from './pages/BeforeOrAfter'
import HowToPlay from './pages/HowToPlay'
import Leaderboard from './pages/Leaderboard'
import Champions from './pages/Champions'
import GroupPage from './pages/GroupPage'
import JoinGroupPage from './pages/JoinGroupPage'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <SportProvider>
      <GroupProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/guess" element={<ChirpGuess />} />
              <Route path="/statline" element={<StatLine />} />
              <Route path="/career" element={<CareerBuilder />} />
              <Route path="/progression" element={<Progression />} />
              <Route path="/moreorless" element={<MoreOrLess />} />
              <Route path="/lineup" element={<Lineup />} />
              {/* Chirp Grid is temporarily hidden (all sports) — known
                  scoring/gameplay issues under investigation. Redirects
                  rather than just dropping from nav, so an old link,
                  bookmark, or search result doesn't land anyone on the
                  broken game. Restore by swapping this back to
                  <Route path="/grid" element={<Grid />} /> once fixed. */}
              <Route path="/grid" element={<Navigate to="/" replace />} />
              <Route path="/before-or-after" element={<BeforeOrAfter />} />
              <Route path="/how-to-play" element={<HowToPlay />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/groups" element={<GroupPage />} />
              <Route path="/g/:code" element={<JoinGroupPage />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            {/* Unlisted — no Header/nav chrome, direct URL only, for daily
                Instagram-content screenshots. */}
            <Route path="/champions" element={<Champions />} />
          </Routes>
        </BrowserRouter>
      </GroupProvider>
    </SportProvider>
  )
}
