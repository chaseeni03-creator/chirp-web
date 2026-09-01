import Seo from '../components/Seo'

export default function Terms() {
  return (
    <div className="mx-auto max-w-2xl">
      <Seo title="Terms of Service" description="The terms for using Chirp Sports." />
      <h1 className="mb-2 text-2xl font-extrabold">Terms of Service</h1>
      <p className="mb-8 text-sm text-[var(--color-text-secondary)]">Last updated: September 2026</p>

      <div className="space-y-8 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">Using Chirp Sports</h2>
          <p>
            Chirp Sports (playchirpsports.com) is a free set of daily sports trivia games. No account or
            registration is required to play. By using the site you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">The games</h2>
          <p>
            Daily puzzles are provided "as is" and may change, be delayed, or be unavailable for a given sport or
            day. Game progress and streaks are stored locally in your browser (see our{' '}
            <a href="/privacy" className="text-[var(--color-primary)]">Privacy Policy</a>) — we don't guarantee
            that data will persist if you clear your browser or switch devices.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">Acceptable use</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Don't attempt to disrupt the site, scrape it at scale, or interfere with other players.</li>
            <li>Don't use automated tools to solve puzzles or manipulate shared results.</li>
            <li>Share your results and invite others to play — that's what the share feature is for.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">No affiliation</h2>
          <p>
            Chirp Sports is an independent fan project and is not affiliated with, endorsed by, or sponsored by
            the NFL, MLB, NBA, or any team, league, or player association. All team names and player statistics
            are used for informational and entertainment purposes only.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">No warranty</h2>
          <p>
            The site is provided without warranties of any kind. We do our best to keep stats and puzzles
            accurate, but we don't guarantee the games will be error-free, uninterrupted, or available at all
            times.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">Changes</h2>
          <p>
            We may update these terms or the games themselves at any time. Continuing to use the site after a
            change means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">Contact</h2>
          <p>
            Questions about these terms? Email{' '}
            <a href="mailto:support@playchirpsports.com" className="text-[var(--color-primary)]">
              support@playchirpsports.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
