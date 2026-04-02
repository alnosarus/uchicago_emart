import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>😵</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>Campus WiFi strikes again...</Text>
      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
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
    color: colors.gray[700],
    textAlign: "center",
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    color: colors.gray[400],
    textAlign: "center",
    marginTop: 4,
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
