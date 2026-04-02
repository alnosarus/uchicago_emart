import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface Segment {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  selected: string;
  onSelect: (value: string) => void;
}

export function SegmentedControl({
  segments,
  selected,
  onSelect,
}: SegmentedControlProps) {
  return (
    <View style={styles.track}>
      {segments.map((segment) => {
        const isActive = segment.value === selected;
        return (
          <Pressable
            key={segment.value}
            style={[styles.segment, isActive && styles.activeSegment]}
            onPress={() => onSelect(segment.value)}
          >
            <Text
              style={[
                styles.segmentText,
                isActive && styles.activeSegmentText,
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  activeSegment: {
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.gray[500],
  },
  activeSegmentText: {
    color: colors.gray[900],
    fontWeight: "600",
  },
});
