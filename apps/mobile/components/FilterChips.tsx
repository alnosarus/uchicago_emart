import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface Chip {
  label: string;
  value: string;
}

interface FilterChipsProps {
  chips: Chip[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor?: string;
}

export function FilterChips({
  chips,
  selected,
  onSelect,
  accentColor = colors.maroon[600],
}: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {chips.map((chip) => {
        const isActive = chip.value === selected;
        return (
          <Pressable
            key={chip.value}
            style={[
              styles.chip,
              isActive
                ? { backgroundColor: accentColor }
                : { backgroundColor: colors.gray[100] },
            ]}
            onPress={() => onSelect(chip.value)}
          >
            <Text
              style={[
                styles.chipText,
                isActive
                  ? { color: colors.white }
                  : { color: colors.gray[600] },
              ]}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
