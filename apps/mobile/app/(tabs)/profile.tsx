import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.avatarPlaceholder}>
        <FontAwesome name="user" size={40} color={colors.gray[300]} />
      </View>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Sign in to manage your posts, messages, and saved items.</Text>
      <View style={styles.button}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </View>
      <Text style={styles.hint}>Coming in Phase 1 (Auth)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.white },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.gray[100], alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: colors.gray[900] },
  subtitle: { fontSize: 13, color: colors.gray[500], textAlign: "center", marginTop: 8, lineHeight: 18 },
  button: { marginTop: 20, backgroundColor: colors.maroon[600], paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, opacity: 0.5 },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  hint: { marginTop: 8, fontSize: 11, color: colors.gray[400] },
});
