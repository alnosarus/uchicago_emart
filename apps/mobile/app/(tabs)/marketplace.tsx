import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

export default function MarketplaceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Marketplace Feed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  text: { fontSize: 16, color: colors.gray[500] },
});
