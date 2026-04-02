import React from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";

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

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.maroon[600],
      tabBarInactiveTintColor: colors.gray[400],
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabLabel,
      headerShown: false,
    }}>
      <Tabs.Screen name="marketplace" options={{ title: "Market", tabBarIcon: ({ color }) => <TabIcon name="shopping-bag" color={color} /> }} />
      <Tabs.Screen name="storage" options={{ title: "Storage", tabBarIcon: ({ color }) => <TabIcon name="archive" color={color} /> }} />
      <Tabs.Screen name="create" options={{ title: "Post", tabBarIcon: () => <CreateTabIcon />, tabBarLabel: () => null }} />
      <Tabs.Screen name="housing" options={{ title: "Housing", tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <TabIcon name="user" color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { height: Platform.OS === "ios" ? 85 : 65, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.gray[200], backgroundColor: colors.white },
  tabLabel: { fontSize: 10, fontWeight: "600" },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.maroon[600], alignItems: "center", justifyContent: "center", marginBottom: 4, shadowColor: colors.maroon[600], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
});
