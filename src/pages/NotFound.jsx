import { Link } from 'react-router-dom'
import Seo from '../components/Seo'

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <Seo title="Page Not Found" />
      <p className="text-2xl font-extrabold">404</p>
      <p className="mt-2 text-[var(--color-text-secondary)]">That page doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block rounded-lg bg-[var(--color-primary)] px-5 py-2.5 font-bold text-white">
        Back Home
      </Link>
    </div>
  )
}
