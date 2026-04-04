import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Listings",
  description: "Browse marketplace, storage, and housing listings from UChicago students.",
  alternates: { canonical: "/browse" },
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
