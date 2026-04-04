import type { Metadata } from "next";
import ProfilePage from "./client-page";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await fetch(`${API_URL}/api/users/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return { title: "User Not Found" };
    const user = await res.json();

    return {
      title: user.name,
      description: `${user.name}'s profile on UChicago E-mart — view their listings and reviews.`,
      openGraph: {
        title: user.name,
        images: user.avatarUrl ? [{ url: user.avatarUrl }] : undefined,
      },
      alternates: {
        canonical: `/profile/${id}`,
      },
    };
  } catch {
    return { title: "Profile" };
  }
}

export default function Page() {
  return <ProfilePage />;
}
