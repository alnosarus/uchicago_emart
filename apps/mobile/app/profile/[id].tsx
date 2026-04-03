import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { SegmentedControl } from "@/components/SegmentedControl";
import { PostCard } from "@/components/PostCard";
import { ErrorState } from "@/components/ErrorState";
import type { ReviewWithAuthor } from "@uchicago-marketplace/shared";

/* ─── Helpers ─── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StarRow({ rating, count }: { rating: number | null; count: number }) {
  const filled = rating ? Math.round(rating) : 0;
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <FontAwesome
          key={i}
          name={i <= filled ? "star" : "star-o"}
          size={14}
          color={colors.star}
        />
      ))}
      <Text style={styles.ratingText}>
        {rating != null ? rating.toFixed(1) : "—"}
      </Text>
      <Text style={styles.reviewCountText}>({count})</Text>
    </View>
  );
}

function ReviewCard({ review }: { review: ReviewWithAuthor }) {
  const filled = Math.round(review.rating);
  const date = new Date(review.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerAvatar}>
          {review.reviewer.avatarUrl ? (
            <Image
              source={{ uri: review.reviewer.avatarUrl }}
              style={styles.reviewerAvatarImage}
            />
          ) : (
            <Text style={styles.reviewerInitials}>
              {getInitials(review.reviewer.name)}
            </Text>
          )}
        </View>
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{review.reviewer.name}</Text>
          <View style={styles.reviewStarRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <FontAwesome
                key={i}
                name={i <= filled ? "star" : "star-o"}
                size={12}
                color={colors.star}
              />
            ))}
            <Text style={styles.reviewDate}>{date}</Text>
          </View>
        </View>
      </View>
      {review.text ? (
        <Text style={styles.reviewText}>{review.text}</Text>
      ) : null}
    </View>
  );
}

/* ─── Main screen ─── */

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { profile, isLoading, error, refresh } = useProfile(id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"listings" | "reviews">("listings");

  const isOwnProfile = authUser?.id === id;

  async function handleRefresh() {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }

  /* NavBar */
  const navBar = (
    <View style={[styles.navBar, { paddingTop: insets.top }]}>
      <Pressable style={styles.navButton} onPress={() => router.back()}>
        <FontAwesome name="arrow-left" size={18} color={colors.gray[900]} />
      </Pressable>
      <Text style={styles.navTitle}>Profile</Text>
      <View style={styles.navButton} />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {navBar}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.maroon[600]} />
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        {navBar}
        <ErrorState onRetry={refresh} />
      </View>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.container}>
      {navBar}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.maroon[600]}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>
                {getInitials(profile.name)}
              </Text>
            </View>
          )}
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileCnet}>@{profile.cnetId}</Text>
          {profile.isVerified && (
            <View style={styles.verifiedBadge}>
              <FontAwesome name="check-circle" size={13} color={colors.success} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
          <Text style={styles.memberSince}>Member since {memberSince}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <StarRow
              rating={profile.stats.averageRating}
              count={profile.stats.reviewCount}
            />
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>{profile.stats.transactionCount}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>{profile.stats.activeListingCount}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
        </View>

        {/* My Saved Posts row (own profile only) */}
        {isOwnProfile && (
          <Pressable
            style={styles.savedRow}
            onPress={() => router.push("/saved" as never)}
          >
            <FontAwesome name="heart" size={16} color={colors.maroon[600]} />
            <Text style={styles.savedRowText}>My Saved Posts</Text>
            <FontAwesome name="chevron-right" size={12} color={colors.gray[400]} />
          </Pressable>
        )}

        {/* Segmented Control */}
        <View style={styles.segmentContainer}>
          <SegmentedControl
            segments={[
              { label: `Listings (${profile.stats.activeListingCount})`, value: "listings" },
              { label: `Reviews (${profile.stats.reviewCount})`, value: "reviews" },
            ]}
            selected={activeTab}
            onSelect={(v) => setActiveTab(v as "listings" | "reviews")}
          />
        </View>

        {/* Listings tab */}
        {activeTab === "listings" && (
          <View>
            {profile.activePosts.length === 0 ? (
              <View style={styles.emptyTab}>
                <FontAwesome name="list" size={28} color={colors.gray[300]} />
                <Text style={styles.emptyTabText}>No active listings</Text>
              </View>
            ) : (
              profile.activePosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))
            )}
          </View>
        )}

        {/* Reviews tab */}
        {activeTab === "reviews" && (
          <View style={styles.reviewsList}>
            {profile.reviews.data.length === 0 ? (
              <View style={styles.emptyTab}>
                <FontAwesome name="star-o" size={28} color={colors.gray[300]} />
                <Text style={styles.emptyTabText}>No reviews yet</Text>
              </View>
            ) : (
              profile.reviews.data.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─── */

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

  /* Profile header */
  profileHeader: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.maroon[600],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.white,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.gray[900],
  },
  profileCnet: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    backgroundColor: "#f0f7f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
  },
  memberSince: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 8,
  },

  /* Stats row */
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gray[100],
    marginHorizontal: 0,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.gray[100],
    marginVertical: 12,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray[900],
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray[400],
    fontWeight: "500",
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.gray[900],
    marginLeft: 4,
  },
  reviewCountText: {
    fontSize: 12,
    color: colors.gray[400],
    marginLeft: 2,
  },

  /* Saved row */
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  savedRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray[900],
  },

  /* Segmented control */
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  /* Empty state */
  emptyTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTabText: {
    fontSize: 14,
    color: colors.gray[400],
  },

  /* Reviews */
  reviewsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  reviewCard: {
    backgroundColor: colors.gray[50],
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gray[200],
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.maroon[100],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reviewerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reviewerInitials: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.maroon[600],
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.gray[900],
  },
  reviewStarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  reviewDate: {
    fontSize: 11,
    color: colors.gray[400],
    marginLeft: 6,
  },
  reviewText: {
    fontSize: 13,
    color: colors.gray[700],
    lineHeight: 19,
  },
});
