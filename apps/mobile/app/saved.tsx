import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";
import { api } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { ErrorState } from "@/components/ErrorState";
import type { PostWithDetails } from "@uchicago-marketplace/shared";

export default function SavedPostsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    setError(null);
    try {
      const result = await api.saved.list();
      setPosts(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved posts");
    }
  }, []);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      await fetchSaved();
      setIsLoading(false);
    }
    load();
  }, [fetchSaved]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchSaved();
    setIsRefreshing(false);
  }

  /* NavBar */
  const navBar = (
    <View style={[styles.navBar, { paddingTop: insets.top }]}>
      <Pressable style={styles.navButton} onPress={() => router.back()}>
        <FontAwesome name="arrow-left" size={18} color={colors.gray[900]} />
      </Pressable>
      <Text style={styles.navTitle}>Saved Posts</Text>
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

  if (error) {
    return (
      <View style={styles.container}>
        {navBar}
        <ErrorState onRetry={fetchSaved} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {navBar}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.maroon[600]}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
          posts.length === 0 && styles.emptyContent,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FontAwesome name="heart-o" size={48} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No saved posts yet</Text>
            <Text style={styles.emptySubtitle}>
              Save posts you like and find them here later.
            </Text>
          </View>
        }
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

  /* List */
  listContent: {
    flexGrow: 1,
  },
  emptyContent: {
    flex: 1,
  },

  /* Empty state */
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.gray[800],
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.gray[500],
    textAlign: "center",
    lineHeight: 18,
  },
});
