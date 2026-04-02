import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/colors";

interface EmptyStateProps {
  icon: string;
  message: string;
  showCreateButton?: boolean;
}

export function EmptyState({ icon, message, showCreateButton }: EmptyStateProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
      {showCreateButton && (
        <Pressable
          style={styles.button}
          onPress={() => router.push("/(tabs)/create" as never)}
        >
          <Text style={styles.buttonText}>Create a Post</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: colors.gray[500],
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: 20,
    backgroundColor: colors.maroon[600],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
});
