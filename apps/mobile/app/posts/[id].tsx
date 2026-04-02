import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import type {
  PostWithDetails,
  HousingDetails,
} from "@uchicago-marketplace/shared";
import {
  formatPrice,
  formatDateRange,
  CONDITIONS,
  STORAGE_SIZES,
  BEDROOM_OPTIONS,
  BATHROOM_OPTIONS,
  HOUSING_AMENITIES,
  LEASE_DURATION_OPTIONS,
} from "@uchicago-marketplace/shared";
import { colors, getAccentColor } from "@/constants/colors";
import { usePostDetail } from "@/hooks/usePostDetail";
import { ImageCarousel } from "@/components/ImageCarousel";
import { BadgeRow, type Badge } from "@/components/BadgeRow";
import { ErrorState } from "@/components/ErrorState";

/* ── Price formatting (same logic as PostCard) ── */

function formatPostPrice(post: PostWithDetails): string {
  if (post.type === "marketplace" && post.marketplace) {
    return formatPrice(post.marketplace.priceAmount, post.marketplace.priceType);
  }
  if (post.type === "storage" && post.storage) {
    if (post.storage.isFree) return "Free";
    if (post.storage.priceMonthly != null) return `$${post.storage.priceMonthly}/mo`;
    return "\u2014";
  }
  if (post.type === "housing" && post.housing) {
    return `$${post.housing.monthlyRent}/mo`;
  }
  return "\u2014";
}

/* ── Badge logic (extended for detail view) ── */

function getDetailBadges(post: PostWithDetails): Badge[] {
  const badges: Badge[] = [];

  if (post.type === "marketplace" && post.marketplace) {
    const conditionLabel =
      CONDITIONS.find((c) => c.value === post.marketplace!.condition)?.label ??
      post.marketplace.condition;
    badges.push({
      label: conditionLabel,
      bg: colors.badge.condition.bg,
      text: colors.badge.condition.text,
    });
    badges.push({
      label: post.marketplace.category,
      bg: colors.badge.category.bg,
      text: colors.badge.category.text,
    });
  }

  if (post.type === "storage" && post.storage) {
    const sizeLabel =
      STORAGE_SIZES.find((s) => s.value === post.storage!.size)?.label ??
      post.storage.size;
    badges.push({
      label: sizeLabel,
      bg: colors.badge.size.bg,
      text: colors.badge.size.text,
    });
    const locationLabel =
      post.storage.locationType === "on_campus" ? "On Campus" : "Off Campus";
    badges.push({
      label: locationLabel,
      bg: colors.badge.location.bg,
      text: colors.badge.location.text,
    });
  }

  if (post.type === "housing" && post.housing) {
    // Sublet / Passdown badge
    const subtypeLabel =
      post.housing.subtype === "sublet" ? "Sublet" : "Passdown";
    badges.push({
      label: subtypeLabel,
      bg: colors.badge.category.bg,
      text: colors.badge.category.text,
    });

    const bedroomLabel =
      BEDROOM_OPTIONS.find((b) => b.value === post.housing!.bedrooms)?.label ??
      post.housing.bedrooms;
    badges.push({
      label: bedroomLabel,
      bg: colors.badge.bedroom.bg,
      text: colors.badge.bedroom.text,
    });
    const bathLabel =
      BATHROOM_OPTIONS.find((b) => b.value === post.housing!.bathrooms)?.label ??
      post.housing.bathrooms;
    badges.push({
      label: bathLabel,
      bg: colors.badge.bedroom.bg,
      text: colors.badge.bedroom.text,
    });

    // Show ALL amenities (not limited like PostCard)
    for (const amenityValue of post.housing.amenities) {
      const amenityLabel =
        HOUSING_AMENITIES.find((a) => a.value === amenityValue)?.label ??
        amenityValue;
      badges.push({
        label: amenityLabel,
        bg: colors.badge.amenity.bg,
        text: colors.badge.amenity.text,
      });
    }
  }

  return badges;
}

/* ── Housing info grid helpers ── */

function getHousingInfoItems(housing: HousingDetails) {
  const items: { label: string; value: string }[] = [];

  if (housing.moveInDate) {
    items.push({
      label: "Move-in",
      value: new Date(housing.moveInDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    });
  }

  if (housing.subtype === "sublet" && housing.moveOutDate) {
    items.push({
      label: "Move-out",
      value: new Date(housing.moveOutDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    });
  } else if (housing.subtype === "passdown" && housing.leaseDurationMonths) {
    const durationLabel =
      LEASE_DURATION_OPTIONS.find(
        (o) => o.value === housing.leaseDurationMonths
      )?.label ?? `${housing.leaseDurationMonths} months`;
    items.push({ label: "Lease", value: durationLabel });
  }

  items.push({
    label: "Roommates",
    value:
      housing.roommates === "solo"
        ? "Solo"
        : housing.roommateCount != null
          ? `${housing.roommateCount} roommate${housing.roommateCount !== 1 ? "s" : ""}`
          : "Shared",
  });

  if (housing.neighborhood) {
    items.push({ label: "Location", value: housing.neighborhood });
  }

  return items;
}

/* ── Author initials ── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ── Component ── */

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { post, isLoading, error, refetch } = usePostDetail(id);

  const accent = post ? getAccentColor(post.type) : colors.maroon[600];

  /* NavBar */
  const navBar = (
    <View style={[styles.navBar, { paddingTop: insets.top }]}>
      <Pressable style={styles.navButton} onPress={() => router.back()}>
        <FontAwesome name="arrow-left" size={18} color={colors.gray[900]} />
      </Pressable>
      <Text style={styles.navTitle}>Post Detail</Text>
      <View style={styles.navButton} />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {navBar}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.container}>
        {navBar}
        <ErrorState onRetry={refetch} />
      </View>
    );
  }

  const priceStr = formatPostPrice(post);
  const badges = getDetailBadges(post);
  const housingInfo =
    post.type === "housing" && post.housing
      ? getHousingInfoItems(post.housing)
      : null;

  return (
    <View style={styles.container}>
      {navBar}
      <ScrollView>
        {/* Image Carousel */}
        <ImageCarousel images={post.images ?? []} />

        {/* Content */}
        <View style={styles.content}>
          {/* Title + Save */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{post.title}</Text>
            <Pressable disabled>
              <FontAwesome name="heart-o" size={20} color={colors.gray[300]} />
            </Pressable>
          </View>

          {/* Price */}
          <Text style={[styles.price, { color: accent }]}>{priceStr}</Text>

          {/* Badges */}
          <View style={styles.badgeSection}>
            <BadgeRow badges={badges} />
          </View>

          {/* Housing Info Grid */}
          {housingInfo && housingInfo.length > 0 && (
            <View style={styles.infoGrid}>
              {housingInfo.map((item, i) => (
                <View key={i} style={styles.infoCell}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          {post.description ? (
            <Text style={styles.description}>{post.description}</Text>
          ) : null}

          {/* Author Card */}
          <View style={styles.authorCard}>
            <View style={[styles.avatar, { backgroundColor: accent }]}>
              <Text style={styles.avatarText}>
                {getInitials(post.author.name)}
              </Text>
            </View>
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>{post.author.name}</Text>
                {post.author.isVerified && (
                  <FontAwesome
                    name="check-circle"
                    size={14}
                    color={colors.success}
                    style={styles.verifiedBadge}
                  />
                )}
              </View>
              <Text style={styles.authorHint}>Member</Text>
            </View>
          </View>

          {/* CTA Buttons */}
          <View style={styles.ctaRow}>
            <Pressable
              style={[styles.ctaPrimary, { backgroundColor: accent, opacity: 0.5 }]}
              disabled
            >
              <FontAwesome
                name="comment-o"
                size={16}
                color={colors.white}
                style={styles.ctaIcon}
              />
              <Text style={styles.ctaPrimaryText}>Message</Text>
            </Pressable>
            <Pressable
              style={[styles.ctaOutline, { borderColor: accent, opacity: 0.5 }]}
              disabled
            >
              <FontAwesome
                name="heart-o"
                size={16}
                color={accent}
                style={styles.ctaIcon}
              />
              <Text style={[styles.ctaOutlineText, { color: accent }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const SCREEN_WIDTH = Dimensions.get("window").width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  /* NavBar */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray[900],
  },
  /* Content */
  content: {
    padding: 16,
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray[900],
  },
  price: {
    fontSize: 22,
    fontWeight: "800",
  },
  badgeSection: {
    marginTop: 2,
  },
  /* Housing info grid */
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1,
    backgroundColor: colors.gray[200],
    borderRadius: 8,
    overflow: "hidden",
  },
  infoCell: {
    width: (SCREEN_WIDTH - 32 - 1) / 2,
    backgroundColor: colors.gray[50],
    padding: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.gray[400],
    fontWeight: "500",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: colors.gray[900],
    fontWeight: "600",
  },
  /* Description */
  description: {
    fontSize: 14,
    color: colors.gray[700],
    lineHeight: 21,
  },
  /* Author */
  authorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    marginTop: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
  authorInfo: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[900],
  },
  verifiedBadge: {
    marginLeft: 2,
  },
  authorHint: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 1,
  },
  /* CTA */
  ctaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    paddingBottom: 24,
  },
  ctaPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
  },
  ctaPrimaryText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  ctaOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
  },
  ctaOutlineText: {
    fontSize: 15,
    fontWeight: "600",
  },
  ctaIcon: {
    marginRight: 8,
  },
});
