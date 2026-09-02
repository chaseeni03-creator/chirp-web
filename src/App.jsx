import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import Grid from './pages/Grid'
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
              <Route path="/grid" element={<Grid />} />
              <Route path="/groups" element={<GroupPage />} />
              <Route path="/g/:code" element={<JoinGroupPage />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </GroupProvider>
    </SportProvider>
  )
}
