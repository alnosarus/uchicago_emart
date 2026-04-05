import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { ConversationWithDetails } from "@uchicago-marketplace/shared";
import { colors } from "@/constants/colors";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

/* ── Helpers ── */

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ── Component ── */

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    try {
      const result = await api.conversations.list();
      setConversations(result.data);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchConversations();
  }, [fetchConversations]);

  const renderItem = useCallback(
    ({ item }: { item: ConversationWithDetails }) => {
      const initials = getInitials(item.otherParticipant.name);
      const hasUnread = item.unreadCount > 0;

      return (
        <Pressable
          style={[styles.row, hasUnread && styles.rowUnread]}
          onPress={() => router.push(`/messages/${item.id}` as never)}
        >
          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          {/* Content */}
          <View style={styles.rowContent}>
            <View style={styles.rowHeader}>
              <Text style={[styles.participantName, hasUnread && styles.bold]} numberOfLines={1}>
                {item.otherParticipant.name}
              </Text>
              {item.lastMessage && (
                <Text style={styles.timeText}>
                  {timeAgo(item.lastMessage.createdAt)}
                </Text>
              )}
            </View>

            <Text style={styles.postTitle} numberOfLines={1}>
              {item.post.title}
            </Text>

            {item.lastMessage && (
              <Text
                style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
                numberOfLines={1}
              >
                {item.lastMessage.body}
              </Text>
            )}
          </View>

          {/* Unread badge */}
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [router]
  );

  const keyExtractor = useCallback((item: ConversationWithDetails) => item.id, []);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Messages</Text>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.emptyContainer}>
          <FontAwesome name="comment-o" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>Sign in to view messages</Text>
          <Text style={styles.emptySubtitle}>
            Log in to chat with buyers and sellers
          </Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.maroon[600]} />
        </View>
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.emptyContainer}>
          <FontAwesome name="comment-o" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>
            Message a seller to start chatting
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.gray[900],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    backgroundColor: colors.white,
    gap: 12,
  },
  rowUnread: {
    backgroundColor: colors.maroon[50],
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.maroon[100],
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.maroon[700],
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  participantName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: colors.gray[900],
  },
  bold: {
    fontWeight: "700",
  },
  timeText: {
    fontSize: 12,
    color: colors.gray[400],
  },
  postTitle: {
    fontSize: 12,
    color: colors.maroon[600],
    fontWeight: "500",
  },
  lastMessage: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 1,
  },
  lastMessageUnread: {
    color: colors.gray[700],
    fontWeight: "500",
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.maroon[600],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.white,
  },
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
