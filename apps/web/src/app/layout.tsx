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
    "A student marketplace for buying/selling items, finding storage, and discovering housing.",
  keywords: [
    "UChicago E-mart",
    "UChicago buy and sell",
    "UChicago classifieds",
    "UChicago electronics",
    "UChicago furniture",
    "UChicago housing",
    "UChicago storage",
    "UChicago marketplace",
    "UChicago sublets",
    "buy textbooks UChicago",
    "sell textbooks UChicago"
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
  const jsonLd = {
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

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
