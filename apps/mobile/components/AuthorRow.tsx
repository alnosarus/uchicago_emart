import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";
import { formatRelativeTime } from "@uchicago-marketplace/shared";

interface AuthorRowProps {
  name: string;
  rating?: number | null;
  createdAt: Date | string;
}

export function AuthorRow({ name, rating, createdAt }: AuthorRowProps) {
  const timeAgo = formatRelativeTime(new Date(createdAt));
  return (
    <View style={styles.row}>
      <Text style={styles.name}>{name}</Text>
      {rating != null && <Text style={styles.star}>★ {rating.toFixed(1)}</Text>}
      <Text style={styles.time}>{timeAgo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  name: { fontSize: 11, color: colors.gray[600] },
  star: { fontSize: 10, color: colors.star },
  time: { fontSize: 10, color: colors.gray[300], marginLeft: "auto" },
});
