import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.uchicagoemart.com"),
  title: {
    default: "UChicago E-mart",
    template: "%s | UChicago E-mart",
  },
  description:
    "UChicago E-mart is the student-only marketplace for the University of Chicago. Buy and sell textbooks, furniture, and electronics. Find sublets, housing, and student storage near Hyde Park — verified UChicago email required.",
  keywords: [
    "UChicago E-mart",
    "UChicago marketplace",
    "UChicago buy and sell",
    "UChicago classifieds",
    "university of chicago marketplace",
    "university of chicago buy and sell",
    "UChicago student marketplace",
    "hyde park marketplace",
    "UChicago sublet",
    "UChicago student housing",
    "UChicago sublets",
    "hyde park sublet",
    "UChicago storage",
    "hyde park student storage",
    "buy textbooks UChicago",
    "sell textbooks UChicago",
    "UChicago textbook exchange",
    "UChicago electronics",
    "UChicago furniture",
    "UChicago used furniture",
    "60637 sublet",
  ],
  openGraph: {
    type: "website",
    siteName: "UChicago E-mart",
    locale: "en_US",
    images: [{ url: "/opengraph.png", width: 1200, height: 630, alt: "UChicago E-mart" }],
  },
  icons: {
    icon: "/logos/logover3-favicon.svg",
    shortcut: "/logos/logover3-favicon.svg",
    apple: "/logos/logover3-favicon.svg",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "UChicago E-mart",
    url: "https://www.uchicagoemart.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.uchicagoemart.com/browse?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "UChicago E-mart",
    url: "https://www.uchicagoemart.com",
    logo: "https://www.uchicagoemart.com/logos/logover3-favicon.svg",
    description: "Student-only marketplace for the University of Chicago community in Hyde Park, Chicago.",
    areaServed: {
      "@type": "City",
      name: "Chicago",
      containsPlace: { "@type": "Neighborhood", name: "Hyde Park" },
    },
  };

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
