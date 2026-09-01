import { useEffect } from 'react'

function setMeta(name, content, attr = 'name') {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** Sets document title + meta description/OG tags for the current page. */
export default function Seo({ title, description }) {
  useEffect(() => {
    const fullTitle = title ? `${title} — Chirp Sports` : 'Chirp Sports — Daily Sports Games. Free.'
    document.title = fullTitle
    if (description) {
      setMeta('description', description)
      setMeta('og:description', description, 'property')
    }
    setMeta('og:title', fullTitle, 'property')
  }, [title, description])

  return null
}
