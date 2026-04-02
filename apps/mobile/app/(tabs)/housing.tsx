import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PostWithDetails } from "@uchicago-marketplace/shared";
import { colors } from "@/constants/colors";
import { usePostsFeed } from "@/hooks/usePostsFeed";
import { PostCard } from "@/components/PostCard";
import { SkeletonList } from "@/components/PostCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SearchBar } from "@/components/SearchBar";
import { FilterChips } from "@/components/FilterChips";
import { SortPicker } from "@/components/SortPicker";
import { SegmentedControl } from "@/components/SegmentedControl";

const SEGMENTS = [
  { label: "Sublets", value: "sublet" },
  { label: "Passdowns", value: "passdown" },
];

const SIDE_CHIPS = [
  { label: "All", value: "" },
  { label: "Offering", value: "offering" },
  { label: "Looking", value: "looking" },
];

const SORT_OPTIONS = [
  { label: "Recent", value: "recent" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

export default function HousingScreen() {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState("");
  const feed = usePostsFeed({
    type: "housing",
    initialFilters: { subtype: "sublet" },
  });

  const handleSearchSubmit = useCallback(() => {
    feed.updateFilters({ q: searchText || undefined });
  }, [searchText, feed]);

  const handleSegmentSelect = useCallback(
    (value: string) => {
      feed.updateFilters({ subtype: value as "sublet" | "passdown" });
    },
    [feed]
  );

  const handleSideSelect = useCallback(
    (value: string) => {
      feed.updateFilters({ side: (value || undefined) as "offering" | "looking" | undefined });
    },
    [feed]
  );

  const handleSortSelect = useCallback(
    (value: string) => {
      feed.updateFilters({ sort: value as "recent" | "price_asc" | "price_desc" });
    },
    [feed]
  );

  const renderItem = useCallback(
    ({ item }: { item: PostWithDetails }) => <PostCard post={item} />,
    []
  );

  const keyExtractor = useCallback((item: PostWithDetails) => item.id, []);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Housing</Text>

      <View style={styles.segmentRow}>
        <SegmentedControl
          segments={SEGMENTS}
          selected={feed.filters.subtype ?? "sublet"}
          onSelect={handleSegmentSelect}
        />
      </View>

      <View style={styles.searchRow}>
        <SearchBar
          value={searchText}
          onChangeText={setSearchText}
          onSubmit={handleSearchSubmit}
          placeholder="Search housing..."
        />
      </View>

      <FilterChips
        chips={SIDE_CHIPS}
        selected={feed.filters.side ?? ""}
        onSelect={handleSideSelect}
        accentColor={colors.housing.primary}
      />

      <View style={styles.metaRow}>
        <Text style={styles.countText}>
          {feed.total} {feed.total === 1 ? "post" : "posts"}
        </Text>
        <SortPicker
          options={SORT_OPTIONS}
          selected={feed.filters.sort ?? "recent"}
          onSelect={handleSortSelect}
          accentColor={colors.housing.primary}
        />
      </View>
    </View>
  );

  if (feed.isLoading) {
    return (
      <View style={styles.container}>
        {header}
        <SkeletonList count={5} />
      </View>
    );
  }

  if (feed.error) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState onRetry={feed.refresh} />
      </View>
    );
  }

  if (feed.posts.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="🏠"
          message={"No housing posts yet \u2014\nhelp a fellow Maroon find a home!"}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feed.posts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        refreshing={feed.isRefreshing}
        onRefresh={feed.refresh}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          feed.isLoadingMore ? (
            <ActivityIndicator
              style={styles.footer}
              color={colors.housing.primary}
            />
          ) : null
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
  header: {
    gap: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.gray[900],
    paddingHorizontal: 16,
  },
  segmentRow: {
    paddingHorizontal: 16,
  },
  searchRow: {
    paddingHorizontal: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  countText: {
    fontSize: 13,
    color: colors.gray[500],
  },
  footer: {
    paddingVertical: 20,
  },
});
