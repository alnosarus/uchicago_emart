import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

export default function StorageScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Storage Feed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  text: { fontSize: 16, color: colors.gray[500] },
});
