import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logos/emart-logo.svg" alt="UChicago E-mart" className="h-10 sm:h-11" />
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-maroon-600 hover:text-maroon-700 transition-colors"
        >
          &larr; Back to Home
        </Link>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-8 py-10 sm:py-16">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: April 2026</p>

        <div className="space-y-10 text-gray-700 leading-relaxed">
          <section>
            <p>
              Welcome to UChicago E-mart, a student-run marketplace for the University of
              Chicago community. By using this site, you agree to these terms. Please read
              them — they&apos;re short.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Eligibility</h2>
            <p>
              UChicago E-mart is open only to current University of Chicago students, faculty,
              and staff. You must sign in with a valid{" "}
              <strong>@uchicago.edu email address</strong> via Google OAuth and complete phone
              number verification. One account per person.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Account Rules</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You are responsible for all activity under your account.</li>
              <li>Do not share your login credentials with others.</li>
              <li>
                You must verify your phone number before posting listings or messaging
                other users.
              </li>
              <li>
                Creating multiple accounts or impersonating another person is not allowed.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Acceptable Use</h2>
            <p className="mb-3">You agree not to use UChicago E-mart to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                List or sell prohibited items, including illegal goods, weapons, controlled
                substances, or anything that violates University policy.
              </li>
              <li>
                Engage in fraud, scams, or misrepresentation of items being sold.
              </li>
              <li>
                Harass, threaten, or abuse other users in any way.
              </li>
              <li>
                Spam other users with unsolicited messages or listings.
              </li>
              <li>
                Attempt to access or interfere with systems or other users&apos; accounts.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Your Content</h2>
            <p>
              You own the content you post (listings, photos, messages). By posting it, you
              grant UChicago E-mart a limited license to display and store your content as
              needed to operate the platform. We will not use your content for advertising
              or sell it to third parties. You are responsible for ensuring that anything
              you post does not violate anyone else&apos;s rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Transactions</h2>
            <p>
              All transactions on UChicago E-mart are conducted in person between buyers and
              sellers. We do not process payments and are not a party to any transaction.
              We are not responsible for the condition of items sold, failed meetups, or
              disputes between users. Use good judgment and meet in safe, public locations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Limitation of Liability
            </h2>
            <p>
              UChicago E-mart is provided as-is by a student volunteer team. We make no
              warranties about the reliability, availability, or accuracy of the platform.
              To the maximum extent permitted by law, we are not liable for any damages
              arising from your use of the site, transactions between users, or content
              posted by users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Account Suspension
            </h2>
            <p>
              We reserve the right to suspend or terminate accounts that violate these
              terms, engage in fraudulent activity, or otherwise harm the community. We
              will make reasonable efforts to notify you if your account is suspended, but
              are not obligated to do so in cases of serious violations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the platform
              after changes are posted constitutes acceptance of the updated terms. We will
              update the &ldquo;Last updated&rdquo; date at the top of this page when changes are
              made.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
            <p>
              Questions or concerns? Reach us at{" "}
              <a
                href="mailto:privacy@uchicagoemart.com"
                className="text-maroon-600 hover:text-maroon-700 underline"
              >
                privacy@uchicagoemart.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 px-4 text-center text-sm text-gray-500">
        <p>
          &copy; {new Date().getFullYear()} UChicago E-mart &mdash;{" "}
          <Link href="/privacy" className="hover:text-maroon-600 transition-colors">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
}
