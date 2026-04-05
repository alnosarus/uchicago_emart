import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal,
  TextInput,
  FlatList,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import { useState, useEffect, useRef, useCallback } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import { useSavedPosts } from "@/hooks/useSavedPosts";
import { useTransaction } from "@/hooks/useTransaction";
import { useReview } from "@/hooks/useReview";
import { api } from "@/lib/api";
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

/* ── Mark-as-sold label by post type ── */

function getMarkSoldLabel(type: string): string {
  if (type === "marketplace") return "Mark as Sold";
  return "Mark as Completed";
}

/* ── User search result type ── */

interface UserSearchResult {
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
}

/* ── Component ── */

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { post, isLoading, error, refetch } = usePostDetail(id);
  const { user } = useAuth();
  const { isSaved, toggleSave, initSavedState } = useSavedPosts();
  const { createTransaction, isSubmitting: txSubmitting } = useTransaction();
  const { eligibility, submitReview, isSubmitting: reviewSubmitting } = useReview(
    post?.id,
    post?.status
  );

  const accent = post ? getAccentColor(post.type) : colors.maroon[600];

  /* ── Saved state init ── */
  useEffect(() => {
    if (post) {
      initSavedState(post.id, (post as any).isSaved ?? false);
    }
  }, [post?.id]);

  /* ── Mark-as-sold modal state ── */
  const [soldModalVisible, setSoldModalVisible] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<UserSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!soldModalVisible) {
      setUserQuery("");
      setSearchResults([]);
      setSelectedBuyer(null);
    }
  }, [soldModalVisible]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (userQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.users.search(userQuery.trim());
        setSearchResults(results as UserSearchResult[]);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [userQuery]);

  async function handleConfirmSold() {
    if (!post || !selectedBuyer) return;
    const result = await createTransaction(post.id, selectedBuyer.id);
    if (result) {
      setSoldModalVisible(false);
      refetch();
    } else {
      Alert.alert("Error", "Failed to mark as sold. Please try again.");
    }
  }

  /* ── Review modal state ── */
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    if (!reviewModalVisible) {
      setReviewRating(0);
      setReviewText("");
    }
  }, [reviewModalVisible]);

  async function handleSubmitReview() {
    if (!post || !eligibility?.revieweeId || reviewRating === 0) return;
    const success = await submitReview({
      postId: post.id,
      revieweeId: eligibility.revieweeId,
      rating: reviewRating,
      text: reviewText.trim() || null,
    });
    if (success) {
      setReviewModalVisible(false);
      Alert.alert("Success", "Your review has been submitted!");
    } else {
      Alert.alert("Error", "Failed to submit review. Please try again.");
    }
  }

  /* ── Derived flags ── */
  const isAuthor = !!(user && post && user.id === post.author.id);
  const isActive = post?.status === "active";
  const isSoldOrCompleted =
    post?.status === "sold" || post?.status === "completed";

  /* ── Message button state ── */
  const [isMessaging, setIsMessaging] = useState(false);

  const handleMessage = useCallback(async () => {
    if (!post || isMessaging) return;
    setIsMessaging(true);
    try {
      const conversation = await api.conversations.create(post.id);
      router.push(`/messages/${conversation.id}` as never);
    } catch {
      Alert.alert("Error", "Failed to start conversation. Please try again.");
    } finally {
      setIsMessaging(false);
    }
  }, [post, isMessaging, router]);

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

  const postIsSaved = isSaved(post.id);

  return (
    <View style={styles.container}>
      {navBar}

      {/* ── Mark-as-Sold Modal ── */}
      <Modal
        visible={soldModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSoldModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{getMarkSoldLabel(post.type)}</Text>
            <Text style={styles.modalSubtitle}>
              Search for the buyer/recipient by name or CNetID
            </Text>

            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor={colors.gray[400]}
              value={userQuery}
              onChangeText={setUserQuery}
              autoFocus
            />

            {isSearching && (
              <ActivityIndicator
                size="small"
                color={colors.success}
                style={{ marginVertical: 8 }}
              />
            )}

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              style={styles.searchList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selectedBuyer?.id === item.id;
                return (
                  <Pressable
                    style={[
                      styles.userRow,
                      isSelected && styles.userRowSelected,
                    ]}
                    onPress={() => setSelectedBuyer(item)}
                  >
                    <View style={styles.userRowAvatar}>
                      <Text style={styles.userRowAvatarText}>
                        {getInitials(item.name)}
                      </Text>
                    </View>
                    <View style={styles.userRowInfo}>
                      <Text style={styles.userRowName}>{item.name}</Text>
                      <Text style={styles.userRowCnet}>@{item.cnetId}</Text>
                    </View>
                    {isSelected && (
                      <FontAwesome
                        name="check-circle"
                        size={18}
                        color={colors.success}
                      />
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                userQuery.trim().length > 0 && !isSearching ? (
                  <Text style={styles.emptyText}>No users found</Text>
                ) : null
              }
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setSoldModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalConfirmBtn,
                  (!selectedBuyer || txSubmitting) && styles.modalBtnDisabled,
                ]}
                onPress={handleConfirmSold}
                disabled={!selectedBuyer || txSubmitting}
              >
                {txSubmitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Review Modal ── */}
      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave a Review</Text>
            {eligibility?.revieweeName && (
              <Text style={styles.modalSubtitle}>
                for {eligibility.revieweeName}
              </Text>
            )}

            {/* Star rating */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setReviewRating(star)}>
                  <FontAwesome
                    name={star <= reviewRating ? "star" : "star-o"}
                    size={32}
                    color={star <= reviewRating ? colors.star : colors.gray[300]}
                    style={styles.starIcon}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Share your experience (optional)"
              placeholderTextColor={colors.gray[400]}
              value={reviewText}
              onChangeText={(t) =>
                setReviewText(t.length <= 500 ? t : t.slice(0, 500))
              }
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{reviewText.length}/500</Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setReviewModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalConfirmBtn,
                  (reviewRating === 0 || reviewSubmitting) &&
                    styles.modalBtnDisabled,
                ]}
                onPress={handleSubmitReview}
                disabled={reviewRating === 0 || reviewSubmitting}
              >
                {reviewSubmitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView>
        {/* Image Carousel */}
        <ImageCarousel images={post.images ?? []} />

        {/* Status Banner */}
        {isSoldOrCompleted && (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor:
                  post.status === "sold" ? colors.error : colors.success,
              },
            ]}
          >
            <FontAwesome
              name={post.status === "sold" ? "tag" : "check-circle"}
              size={14}
              color={colors.white}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.statusBannerText}>
              {post.status === "sold" ? "Sold" : "Completed"}
            </Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Title + Save */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{post.title}</Text>
            <Pressable onPress={() => toggleSave(post.id)}>
              <FontAwesome
                name={postIsSaved ? "heart" : "heart-o"}
                size={20}
                color={postIsSaved ? colors.error : colors.gray[300]}
              />
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

          {/* Mark as Sold / Completed — author only, active posts only */}
          {isAuthor && isActive && (
            <Pressable
              style={styles.markSoldBtn}
              onPress={() => setSoldModalVisible(true)}
            >
              <FontAwesome
                name="check-circle"
                size={16}
                color={colors.white}
                style={styles.ctaIcon}
              />
              <Text style={styles.markSoldText}>
                {getMarkSoldLabel(post.type)}
              </Text>
            </Pressable>
          )}

          {/* Review section — visible when post is sold/completed */}
          {isSoldOrCompleted && eligibility && (
            <View style={styles.reviewSection}>
              {eligibility.eligible ? (
                <Pressable
                  style={[
                    styles.reviewBtn,
                    { backgroundColor: colors.maroon[600] },
                  ]}
                  onPress={() => setReviewModalVisible(true)}
                >
                  <FontAwesome
                    name="star"
                    size={15}
                    color={colors.star}
                    style={styles.ctaIcon}
                  />
                  <Text style={styles.reviewBtnText}>
                    Leave a Review
                    {eligibility.revieweeName
                      ? ` for ${eligibility.revieweeName}`
                      : ""}
                  </Text>
                </Pressable>
              ) : eligibility.alreadyReviewed ? (
                <Text style={styles.alreadyReviewedText}>
                  Already reviewed
                </Text>
              ) : null}
            </View>
          )}

          {/* CTA Buttons */}
          <View style={styles.ctaRow}>
            {!isAuthor && isActive ? (
              <Pressable
                style={[styles.ctaPrimary, { backgroundColor: accent }, isMessaging && styles.ctaDisabled]}
                onPress={handleMessage}
                disabled={isMessaging}
              >
                {isMessaging ? (
                  <ActivityIndicator size="small" color={colors.white} style={styles.ctaIcon} />
                ) : (
                  <FontAwesome
                    name="comment-o"
                    size={16}
                    color={colors.white}
                    style={styles.ctaIcon}
                  />
                )}
                <Text style={styles.ctaPrimaryText}>Message</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.ctaPrimary, { backgroundColor: accent, opacity: 0.35 }]}
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
            )}
            <Pressable
              style={[styles.ctaOutline, { borderColor: accent }]}
              onPress={() => toggleSave(post.id)}
            >
              <FontAwesome
                name={postIsSaved ? "heart" : "heart-o"}
                size={16}
                color={postIsSaved ? colors.error : accent}
                style={styles.ctaIcon}
              />
              <Text
                style={[
                  styles.ctaOutlineText,
                  { color: postIsSaved ? colors.error : accent },
                ]}
              >
                {postIsSaved ? "Saved" : "Save"}
              </Text>
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
  /* Status Banner */
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  statusBannerText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
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
  /* Mark as sold */
  markSoldBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  markSoldText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  /* Review */
  reviewSection: {
    marginTop: 4,
  },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
  },
  reviewBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  alreadyReviewedText: {
    textAlign: "center",
    color: colors.gray[400],
    fontSize: 14,
    paddingVertical: 8,
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
  ctaDisabled: {
    opacity: 0.6,
  },
  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray[900],
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.gray[500],
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.gray[900],
    marginBottom: 8,
    backgroundColor: colors.gray[50],
  },
  searchList: {
    maxHeight: 220,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
  },
  userRowSelected: {
    backgroundColor: colors.maroon[50],
  },
  userRowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.maroon[100],
    alignItems: "center",
    justifyContent: "center",
  },
  userRowAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.maroon[700],
  },
  userRowInfo: {
    flex: 1,
  },
  userRowName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray[900],
  },
  userRowCnet: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 1,
  },
  emptyText: {
    textAlign: "center",
    color: colors.gray[400],
    fontSize: 13,
    paddingVertical: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[600],
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
  },
  modalBtnDisabled: {
    opacity: 0.45,
  },
  /* Stars */
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  starIcon: {
    marginHorizontal: 4,
  },
  /* Review input */
  reviewInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.gray[900],
    backgroundColor: colors.gray[50],
    minHeight: 100,
  },
  charCount: {
    fontSize: 11,
    color: colors.gray[400],
    textAlign: "right",
    marginTop: 4,
  },
});
