import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { colors } from "@/constants/colors";

interface SortOption {
  label: string;
  value: string;
}

interface SortPickerProps {
  options: SortOption[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor?: string;
}

export function SortPicker({
  options,
  selected,
  onSelect,
  accentColor = colors.maroon[600],
}: SortPickerProps) {
  const [visible, setVisible] = useState(false);
  const selectedLabel =
    options.find((o) => o.value === selected)?.label ?? "Sort";

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setVisible(true)}>
        <Text style={[styles.triggerText, { color: accentColor }]}>
          Sort: {selectedLabel} ▾
        </Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <Text style={styles.sheetTitle}>Sort By</Text>
                {options.map((option) => {
                  const isActive = option.value === selected;
                  return (
                    <Pressable
                      key={option.value}
                      style={styles.option}
                      onPress={() => {
                        onSelect(option.value);
                        setVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isActive && { color: accentColor, fontWeight: "600" },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {isActive && (
                        <Text style={[styles.check, { color: accentColor }]}>✓</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray[900],
    marginBottom: 12,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  optionText: {
    fontSize: 15,
    color: colors.gray[700],
  },
  check: {
    fontSize: 16,
    fontWeight: "700",
  },
});
