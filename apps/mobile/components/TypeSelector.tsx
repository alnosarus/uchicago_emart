import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface TypeSelectorProps {
  selectedType: string | null;
  onSelectType: (type: string) => void;
  selectedSubtype?: string | null;
  onSelectSubtype?: (subtype: string) => void;
}

const TYPE_TILES = [
  {
    value: "marketplace",
    icon: "\uD83C\uDFEA",
    label: "Marketplace",
    description: "Buy, sell, or trade items",
  },
  {
    value: "storage",
    icon: "\uD83D\uDCE6",
    label: "Storage",
    description: "Offer or find storage space",
  },
  {
    value: "housing",
    icon: "\uD83C\uDFE0",
    label: "Housing",
    description: "Sublets and lease passdowns",
  },
] as const;

const HOUSING_SUBTYPES = [
  { value: "sublet", label: "Sublet", description: "Short-term sublease" },
  { value: "passdown", label: "Passdown", description: "Full lease transfer" },
] as const;

export function TypeSelector({
  selectedType,
  onSelectType,
  selectedSubtype,
  onSelectSubtype,
}: TypeSelectorProps) {
  return (
    <View style={styles.container}>
      {TYPE_TILES.map((tile) => {
        const isActive = selectedType === tile.value;
        const accent =
          tile.value === "marketplace"
            ? colors.marketplace.primary
            : tile.value === "storage"
              ? colors.storage.primary
              : colors.housing.primary;
        const lightBg =
          tile.value === "marketplace"
            ? colors.marketplace.light
            : tile.value === "storage"
              ? colors.storage.light
              : colors.housing.light;

        return (
          <Pressable
            key={tile.value}
            style={[
              styles.tile,
              isActive && { borderColor: accent, backgroundColor: lightBg },
            ]}
            onPress={() => onSelectType(tile.value)}
          >
            <Text style={styles.tileIcon}>{tile.icon}</Text>
            <View style={styles.tileTextContainer}>
              <Text style={[styles.tileLabel, isActive && { color: accent }]}>
                {tile.label}
              </Text>
              <Text style={styles.tileDesc}>{tile.description}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Housing subtype selector */}
      {selectedType === "housing" && onSelectSubtype && (
        <View style={styles.subtypeContainer}>
          <Text style={styles.subtypeTitle}>What type of housing?</Text>
          <View style={styles.subtypeRow}>
            {HOUSING_SUBTYPES.map((sub) => {
              const isActive = selectedSubtype === sub.value;
              return (
                <Pressable
                  key={sub.value}
                  style={[
                    styles.subtypeBtn,
                    isActive && {
                      borderColor: colors.housing.primary,
                      backgroundColor: colors.housing.light,
                    },
                  ]}
                  onPress={() => onSelectSubtype(sub.value)}
                >
                  <Text
                    style={[
                      styles.subtypeBtnLabel,
                      isActive && { color: colors.housing.primary },
                    ]}
                  >
                    {sub.label}
                  </Text>
                  <Text style={styles.subtypeBtnDesc}>{sub.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  tileIcon: {
    fontSize: 28,
  },
  tileTextContainer: {
    flex: 1,
    gap: 2,
  },
  tileLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray[900],
  },
  tileDesc: {
    fontSize: 13,
    color: colors.gray[500],
  },
  subtypeContainer: {
    gap: 8,
    paddingLeft: 4,
  },
  subtypeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray[700],
  },
  subtypeRow: {
    flexDirection: "row",
    gap: 10,
  },
  subtypeBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
    alignItems: "center",
    gap: 2,
  },
  subtypeBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray[800],
  },
  subtypeBtnDesc: {
    fontSize: 11,
    color: colors.gray[500],
  },
});
