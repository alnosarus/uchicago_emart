/**
 * Seed script for local development.
 * Run with: npx tsx prisma/seed.ts
 *
 * Creates 3 test users, marketplace/storage/housing posts with multiple
 * placeholder images, a transaction, and a review — enough to test
 * every UI feature locally.
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const prisma = new PrismaClient();

// Picsum gives stable placeholder images by seed ID
const img = (seed: number, w = 800, h = 800) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

async function main() {
  console.log("🌱 Seeding database…");

  // ── Users ───────────────────────────────────────────────────────
  const alice = await prisma.user.upsert({
    where: { email: "alice@uchicago.edu" },
    update: {},
    create: {
      email: "alice@uchicago.edu",
      name: "Alice Chen",
      googleId: "dev-google-alice",
      cnetId: "alice",
      avatarUrl: img(101, 200, 200),
      isVerified: true,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@uchicago.edu" },
    update: {},
    create: {
      email: "bob@uchicago.edu",
      name: "Bob Smith",
      googleId: "dev-google-bob",
      cnetId: "bob",
      avatarUrl: img(202, 200, 200),
      isVerified: true,
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: "carol@uchicago.edu" },
    update: {},
    create: {
      email: "carol@uchicago.edu",
      name: "Carol Park",
      googleId: "dev-google-carol",
      cnetId: "carol",
      avatarUrl: img(303, 200, 200),
      isVerified: true,
    },
  });

  console.log("  ✓ Users:", alice.cnetId, bob.cnetId, carol.cnetId);

  // ── Marketplace post — multiple images ─────────────────────────
  const mp1 = await prisma.post.upsert({
    where: { id: "seed-post-marketplace-1" },
    update: {},
    create: {
      id: "seed-post-marketplace-1",
      authorId: alice.id,
      type: "marketplace",
      side: "sell",
      status: "active",
      title: "MacBook Pro 14\" (M3, 2024) — barely used",
      description:
        "Selling my MacBook Pro 14\" M3. Bought in January, used for one quarter. Comes with original box, charger, and Apple Care until Jan 2027. Selling because I switched to a desktop setup.",
      marketplace: {
        create: {
          priceType: "fixed",
          priceAmount: 1650,
          condition: "like_new",
          category: "Electronics",
          tags: ["laptop", "apple", "macbook"],
        },
      },
      images: {
        create: [
          { url: img(10), fullUrl: img(10), thumbUrl: img(10, 300, 300), order: 0, status: "ready" },
          { url: img(11), fullUrl: img(11), thumbUrl: img(11, 300, 300), order: 1, status: "ready" },
          { url: img(12), fullUrl: img(12), thumbUrl: img(12, 300, 300), order: 2, status: "ready" },
        ],
      },
    },
  });

  // ── Marketplace post — free, single image ──────────────────────
  const mp2 = await prisma.post.upsert({
    where: { id: "seed-post-marketplace-2" },
    update: {},
    create: {
      id: "seed-post-marketplace-2",
      authorId: bob.id,
      type: "marketplace",
      side: "sell",
      status: "active",
      title: "Econ 101 Textbook (Mankiw, 10th ed.)",
      description: "Good condition, some highlighting in the first three chapters. No writing elsewhere.",
      marketplace: {
        create: {
          priceType: "fixed",
          priceAmount: 35,
          condition: "good",
          category: "Textbooks",
          tags: ["econ", "textbook"],
        },
      },
      images: {
        create: [
          { url: img(20), fullUrl: img(20), thumbUrl: img(20, 300, 300), order: 0, status: "ready" },
          { url: img(21), fullUrl: img(21), thumbUrl: img(21, 300, 300), order: 1, status: "ready" },
        ],
      },
    },
  });

  // ── Marketplace post — free ────────────────────────────────────
  const mp3 = await prisma.post.upsert({
    where: { id: "seed-post-marketplace-3" },
    update: {},
    create: {
      id: "seed-post-marketplace-3",
      authorId: carol.id,
      type: "marketplace",
      side: "sell",
      status: "active",
      title: "IKEA desk lamp — free to a good home",
      description: "Moving out, no room in car. Works perfectly.",
      marketplace: {
        create: {
          priceType: "free",
          priceAmount: null,
          condition: "good",
          category: "Furniture",
          tags: ["lamp", "free"],
        },
      },
      images: {
        create: [
          { url: img(30), fullUrl: img(30), thumbUrl: img(30, 300, 300), order: 0, status: "ready" },
        ],
      },
    },
  });

  // ── Storage post ───────────────────────────────────────────────
  const sp1 = await prisma.post.upsert({
    where: { id: "seed-post-storage-1" },
    update: {},
    create: {
      id: "seed-post-storage-1",
      authorId: alice.id,
      type: "storage",
      side: "has_space",
      status: "active",
      title: "Summer storage space in Hyde Park apt",
      description: "Have a spare closet available June–Sept. Can fit boxes, suitcases, or small furniture.",
      storage: {
        create: {
          startDate: new Date("2026-06-01"),
          endDate: new Date("2026-09-01"),
          size: "half_room",
          locationType: "off_campus",
          neighborhood: "Hyde Park",
          priceMonthly: 40,
          isFree: false,
        },
      },
      images: {
        create: [
          { url: img(40), fullUrl: img(40), thumbUrl: img(40, 300, 300), order: 0, status: "ready" },
          { url: img(41), fullUrl: img(41), thumbUrl: img(41, 300, 300), order: 1, status: "ready" },
        ],
      },
    },
  });

  // ── Housing post ───────────────────────────────────────────────
  const hp1 = await prisma.post.upsert({
    where: { id: "seed-post-housing-1" },
    update: {},
    create: {
      id: "seed-post-housing-1",
      authorId: bob.id,
      type: "housing",
      side: "offering",
      status: "active",
      title: "Summer sublet — 1BR near campus",
      description:
        "Subletting my studio for summer quarter. Fully furnished, walk to campus, laundry in building.",
      housing: {
        create: {
          subtype: "sublet",
          side: "offering",
          monthlyRent: 1100,
          bedrooms: "studio",
          bathrooms: "1",
          neighborhood: "Hyde Park",
          amenities: ["furnished", "laundry", "ac"],
          roommates: "solo",
          moveInDate: new Date("2026-06-15"),
          moveOutDate: new Date("2026-09-01"),
          leaseDurationMonths: 3,
        },
      },
      images: {
        create: [
          { url: img(50), fullUrl: img(50), thumbUrl: img(50, 300, 300), order: 0, status: "ready" },
          { url: img(51), fullUrl: img(51), thumbUrl: img(51, 300, 300), order: 1, status: "ready" },
          { url: img(52), fullUrl: img(52), thumbUrl: img(52, 300, 300), order: 2, status: "ready" },
        ],
      },
    },
  });

  console.log("  ✓ Posts:", mp1.id, mp2.id, mp3.id, sp1.id, hp1.id);

  // ── Transaction (mp2: bob sold to carol) ───────────────────────
  await prisma.post.update({ where: { id: mp2.id }, data: { status: "sold" } });

  const txn = await prisma.transaction.upsert({
    where: { postId: mp2.id },
    update: {},
    create: {
      postId: mp2.id,
      sellerId: bob.id,
      buyerId: carol.id,
      completedAt: new Date("2026-03-20"),
    },
  });

  console.log("  ✓ Transaction:", txn.id);

  // ── Review (carol reviewed bob for mp2) ───────────────────────
  await prisma.review.upsert({
    where: { postId_reviewerId: { postId: mp2.id, reviewerId: carol.id } },
    update: {},
    create: {
      postId: mp2.id,
      reviewerId: carol.id,
      revieweeId: bob.id,
      rating: 5,
      text: "Super fast response and the book was exactly as described. Great seller!",
    },
  });

  console.log("  ✓ Review created");
  console.log("");
  console.log("Done! Test accounts:");
  console.log("  alice@uchicago.edu  (has 2 active posts)");
  console.log("  bob@uchicago.edu    (1 sold post, 1 active housing post, received 5★ review)");
  console.log("  carol@uchicago.edu  (1 active post, completed 1 transaction with bob)");
  console.log("");
  console.log("Note: Log in via Google OAuth with a real account — the domain");
  console.log("check is disabled in development (NODE_ENV=development).");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
