import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { Notification } from "@uchicago-marketplace/shared";
import { colors } from "@/constants/colors";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

/* ── Type icon mapping ── */

const TYPE_ICONS: Record<string, React.ComponentProps<typeof FontAwesome>["name"]> = {
  review: "star",
  save: "heart",
  expiring: "clock-o",
  system: "bullhorn",
  message: "comment-o",
  match: "link",
};

/* ── Relative time helper ── */

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/* ── Pagination state ── */

interface PaginationState {
  page: number;
  totalPages: number;
}

/* ── Component ── */

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<PaginationState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isFetchingRef = useRef(false);

  const fetchNotifications = useCallback(
    async (page: number = 1, append: boolean = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        const result = await api.notifications.list(page, 20);
        setNotifications((prev) =>
          append ? [...prev, ...result.data] : result.data
        );
        setPagination({
          page: result.pagination.page,
          totalPages: result.pagination.totalPages,
        });
      } catch {
        // silently fail
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchNotifications(1, false);
  }, [fetchNotifications]);

  const handleLoadMore = useCallback(() => {
    if (!pagination || pagination.page >= pagination.totalPages || isLoadingMore) return;
    setIsLoadingMore(true);
    fetchNotifications(pagination.page + 1, true);
  }, [pagination, isLoadingMore, fetchNotifications]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await api.notifications.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // silently fail
    }
  }, []);

  const handleTap = useCallback(
    async (notification: Notification) => {
      // Mark as read optimistically
      if (!notification.isRead) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        api.notifications.markAsRead(notification.id).catch(() => {});
      }

      // Navigate to the linked resource
      if (notification.link) {
        const postMatch = notification.link.match(/\/posts\/(.+)/);
        if (postMatch) {
          router.push(`/posts/${postMatch[1]}`);
        }
      }
    },
    [router]
  );

  const handleRenew = useCallback(
    async (postId: string) => {
      try {
        await api.posts.renew(postId);
        setNotifications((prev) =>
          prev.map((n) =>
            n.link === `/posts/${postId}` && n.type === "expiring"
              ? {
                  ...n,
                  body: n.body.replace(
                    "expires in 3 days. Renew it to keep it active.",
                    "has been renewed!"
                  ),
                }
              : n
          )
        );
      } catch {
        // silently fail
      }
    },
    []
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => {
      const iconName = TYPE_ICONS[item.type] || "bell";
      const postId = item.link?.match(/\/posts\/(.+)/)?.[1];
      const showRenew =
        item.type === "expiring" &&
        postId &&
        !item.body.includes("has been renewed");

      return (
        <Pressable
          style={[styles.notificationRow, !item.isRead && styles.notificationUnread]}
          onPress={() => handleTap(item)}
        >
          <View style={[styles.iconCircle, !item.isRead && styles.iconCircleUnread]}>
            <FontAwesome name={iconName} size={16} color={!item.isRead ? colors.maroon[600] : colors.gray[400]} />
          </View>

          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text
                style={[styles.notificationTitle, !item.isRead && styles.notificationTitleUnread]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={styles.notificationTime}>
                {timeAgo(item.createdAt as unknown as string)}
              </Text>
            </View>

            <Text style={styles.notificationBody} numberOfLines={2}>
              {item.body}
            </Text>

            {showRenew && (
              <Pressable
                style={styles.renewButton}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleRenew(postId);
                }}
              >
                <Text style={styles.renewButtonText}>Renew Post</Text>
              </Pressable>
            )}
          </View>

          {!item.isRead && <View style={styles.unreadDot} />}
        </Pressable>
      );
    },
    [handleTap, handleRenew]
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={18} color={colors.gray[900]} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.backButton} />
        </View>
        {unreadCount > 0 && (
          <View style={styles.subHeaderRow}>
            <Text style={styles.unreadCountText}>{unreadCount} unread</Text>
            <Pressable onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllText}>Mark all as read</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.maroon[600]} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="bell-o" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            We'll notify you when something happens
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                style={styles.footer}
                color={colors.maroon[600]}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

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

  /* Header */
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray[900],
  },
  subHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 2,
  },
  unreadCountText: {
    fontSize: 13,
    color: colors.gray[500],
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.maroon[600],
  },

  /* List */
  listContent: {
    paddingVertical: 4,
  },
  footer: {
    paddingVertical: 20,
  },

  /* Notification row */
  notificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    backgroundColor: colors.white,
  },
  notificationUnread: {
    backgroundColor: colors.maroon[50],
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  iconCircleUnread: {
    backgroundColor: colors.maroon[100],
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: colors.gray[700],
  },
  notificationTitleUnread: {
    fontWeight: "700",
    color: colors.gray[900],
  },
  notificationTime: {
    fontSize: 12,
    color: colors.gray[400],
  },
  notificationBody: {
    fontSize: 13,
    color: colors.gray[600],
    marginTop: 2,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.maroon[500],
    marginLeft: 8,
    marginTop: 6,
  },

  /* Renew button */
  renewButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: colors.maroon[600],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  renewButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray[700],
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 4,
    textAlign: "center",
  },
});
