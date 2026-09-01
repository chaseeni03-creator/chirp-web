import Seo from '../components/Seo'

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl">
      <Seo title="Privacy Policy" description="How Chirp Sports collects and uses data." />
      <h1 className="mb-2 text-2xl font-extrabold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-[var(--color-text-secondary)]">Last updated: September 2026</p>

      <div className="space-y-8 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">What data we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="text-[var(--color-text)]">Email addresses</span> — only if you sign up for the
              mobile app waitlist. We don't require an account or any personal information to play the games.
            </li>
            <li>
              <span className="text-[var(--color-text)]">Game data in your browser's localStorage</span> — your
              scores, streaks, and in-progress puzzles are saved locally on your device. This data never leaves
              your browser and is not sent to our servers.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">How we use it</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Email addresses are used solely to notify you when the Chirp Sports mobile app launches.</li>
            <li>
              LocalStorage data is used only to run the games in your browser — tracking your streak, remembering
              which puzzle you've already played today, and building your shareable result.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">Cookies</h2>
          <p>
            We don't use tracking or advertising cookies. The only browser storage we use is localStorage, purely
            to make the games work (see above) — it isn't used for analytics or advertising.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">Third parties</h2>
          <p>We do not sell, rent, or share your data with third parties for marketing or any other purpose.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">Your choices</h2>
          <p>
            You can clear your browser's localStorage at any time to remove your saved game data — this will
            reset your streaks and completion history. To be removed from the waitlist, email us and we'll delete
            your address.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">Contact</h2>
          <p>
            Questions about this policy or your data? Email{' '}
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
