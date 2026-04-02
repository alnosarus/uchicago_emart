import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type {
  PostWithDetails,
  MarketplaceDetails,
  StorageDetails,
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
} from "@uchicago-marketplace/shared";
import { colors, getAccentColor } from "@/constants/colors";
import { BadgeRow, type Badge } from "./BadgeRow";
import { AuthorRow } from "./AuthorRow";

function formatPostPrice(post: PostWithDetails): string {
  if (post.type === "marketplace" && post.marketplace) {
    return formatPrice(post.marketplace.priceAmount, post.marketplace.priceType);
  }
  if (post.type === "storage" && post.storage) {
    if (post.storage.isFree) return "Free";
    if (post.storage.priceMonthly != null) return `$${post.storage.priceMonthly}/mo`;
    return "—";
  }
  if (post.type === "housing" && post.housing) {
    return `$${post.housing.monthlyRent}/mo`;
  }
  return "—";
}

function getBadges(post: PostWithDetails): Badge[] {
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
    // Show first amenity as badge if present
    if (post.housing.amenities.length > 0) {
      const amenityLabel =
        HOUSING_AMENITIES.find((a) => a.value === post.housing!.amenities[0])
          ?.label ?? post.housing.amenities[0];
      badges.push({
        label: amenityLabel,
        bg: colors.badge.amenity.bg,
        text: colors.badge.amenity.text,
      });
    }
  }

  return badges;
}

function getHousingDateLine(housing: HousingDetails): string | null {
  if (housing.subtype === "sublet" && housing.moveInDate && housing.moveOutDate) {
    return formatDateRange(new Date(housing.moveInDate), new Date(housing.moveOutDate));
  }
  if (housing.subtype === "passdown" && housing.leaseStartDate && housing.leaseDurationMonths) {
    return `Lease starts ${new Date(housing.leaseStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${housing.leaseDurationMonths}mo`;
  }
  return null;
}

export function PostCard({ post }: { post: PostWithDetails }) {
  const router = useRouter();
  const accent = getAccentColor(post.type);
  const priceStr = formatPostPrice(post);
  const badges = getBadges(post);
  const thumbnail = post.images?.[0]?.url;
  const dateLine =
    post.type === "housing" && post.housing
      ? getHousingDateLine(post.housing)
      : null;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/posts/${post.id}` as never)}
    >
      <View style={styles.imageContainer}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderText}>📷</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {post.title}
        </Text>
        <Text style={[styles.price, { color: accent }]}>{priceStr}</Text>
        <BadgeRow badges={badges} />
        {dateLine && (
          <Text style={styles.dateLine} numberOfLines={1}>
            {dateLine}
          </Text>
        )}
        <AuthorRow
          name={post.author.name}
          createdAt={post.createdAt}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  imageContainer: {
    width: 88,
    height: 88,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 8,
  },
  placeholder: {
    backgroundColor: colors.gray[100],
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray[900],
  },
  price: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  dateLine: {
    fontSize: 10,
    color: colors.gray[500],
    marginTop: 2,
  },
});
