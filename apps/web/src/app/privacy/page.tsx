import Link from "next/link";

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: April 2026</p>

        <div className="space-y-10 text-gray-700 leading-relaxed">
          <section>
            <p>
              UChicago E-mart is a student-run marketplace for University of Chicago students.
              This privacy policy explains what data we collect, how we use it, and your rights
              regarding that data. We keep things simple — this is a student project, not a
              corporation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">What We Collect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Account information:</strong> Your name and UChicago email address
                (obtained via Google OAuth when you sign in).
              </li>
              <li>
                <strong>Phone number:</strong> Collected for identity verification via Firebase
                Phone Auth. You can choose whether to display it on your public profile.
              </li>
              <li>
                <strong>Profile photo:</strong> Pulled from your Google account or uploaded by
                you.
              </li>
              <li>
                <strong>Post content and images:</strong> Listings you create, including
                descriptions, prices, and any photos you upload.
              </li>
              <li>
                <strong>Messages:</strong> Direct messages sent between users through the
                platform.
              </li>
              <li>
                <strong>Usage data:</strong> Basic information about how you interact with the
                site (e.g., pages visited, posts saved), used to improve the experience.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">How We Use It</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To create and manage your account.</li>
              <li>
                To verify that you are a UChicago student and to reduce fraud and spam.
              </li>
              <li>To display your listings and profile to other verified users.</li>
              <li>To facilitate messaging between buyers and sellers.</li>
              <li>To send notifications about activity on your listings or account.</li>
              <li>To improve the platform based on how it is used.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Third-Party Services</h2>
            <p className="mb-3">
              We rely on a small number of third-party services to operate the platform:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Google OAuth:</strong> Used for sign-in. Google provides your name and
                email address to us. Google&apos;s privacy policy applies to the authentication
                flow.
              </li>
              <li>
                <strong>Firebase (Google):</strong> Used for phone number verification and for
                storing uploaded images. Data is stored in Google Cloud infrastructure.
              </li>
              <li>
                <strong>Railway / PostgreSQL:</strong> Our database is hosted on Railway. User
                data (account info, posts, messages) is stored there.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Data Sharing</h2>
            <p>
              We do not sell your data. We do not share your personal information with third
              parties for advertising or marketing purposes. Your data is shared only with the
              services listed above as necessary to operate the platform, and with other
              UChicago E-mart users as part of normal marketplace functionality (e.g., your
              name and listings are visible to other users; your phone number is only visible
              if you choose to show it).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you
              request account deletion, we will remove your personal information from our
              systems within a reasonable time. Some information may be retained in backups
              for a short period after deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Your Rights</h2>
            <p>
              You can request access to, correction of, or deletion of your personal data at
              any time by contacting us. To request account deletion or data export, email us
              at{" "}
              <a
                href="mailto:noh@uchicago.edu"
                className="text-maroon-600 hover:text-maroon-700 underline"
              >
                noh@uchicago.edu / junseo@uchicago.edu
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
            <p>
              Questions about this policy? Reach out at{" "}
              <a
                href="mailto:noh@uchicago.edu"
                className="text-maroon-600 hover:text-maroon-700 underline"
              >
                noh@uchicago.edu / junseo@uchicago.edu
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 px-4 text-center text-sm text-gray-500">
        <p>
          &copy; {new Date().getFullYear()} UChicago E-mart &mdash;{" "}
          <Link href="/terms" className="hover:text-maroon-600 transition-colors">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}
