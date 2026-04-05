import React, { useState, useEffect, useCallback } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

function TabIcon({ name, color }: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }) {
  return <FontAwesome size={22} name={name} color={color} />;
}

function CreateTabIcon() {
  return (
    <View style={styles.fab}>
      <FontAwesome size={20} name="plus" color={colors.white} />
    </View>
  );
}

const POLL_INTERVAL = 30_000; // 30 seconds

function NotificationBell() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const result = await api.notifications.getUnreadCount();
      setUnreadCount(result.count);
    } catch {
      // silently fail
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return (
    <Pressable style={styles.bellButton} onPress={() => router.push("/notifications")}>
      <FontAwesome name="bell" size={20} color={colors.gray[700]} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Tabs screenOptions={{
        tabBarActiveTintColor: colors.maroon[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      }}>
        <Tabs.Screen name="index" options={{ title: "Market", tabBarIcon: ({ color }) => <TabIcon name="shopping-bag" color={color} /> }} />
        <Tabs.Screen name="storage" options={{ title: "Storage", tabBarIcon: ({ color }) => <TabIcon name="archive" color={color} /> }} />
        <Tabs.Screen name="create" options={{ title: "Post", tabBarIcon: () => <CreateTabIcon />, tabBarLabel: () => null }} />
        <Tabs.Screen name="housing" options={{ title: "Housing", tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
        <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: ({ color }) => <TabIcon name="comment-o" color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <TabIcon name="user" color={color} /> }} />
      </Tabs>

      {/* Floating notification bell — positioned in the top-right safe area */}
      <View style={[styles.bellOverlay, { top: insets.top + 10 }]} pointerEvents="box-none">
        <NotificationBell />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bellOverlay: { position: "absolute", right: 12, zIndex: 100 },
  tabBar: { height: Platform.OS === "ios" ? 85 : 65, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.gray[200], backgroundColor: colors.white },
  tabLabel: { fontSize: 10, fontWeight: "600" },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.maroon[600], alignItems: "center", justifyContent: "center", marginBottom: 4, shadowColor: colors.maroon[600], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  bellButton: { marginRight: 16, padding: 4, position: "relative" },
  badge: { position: "absolute", top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.white },
});
