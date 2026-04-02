import { View, Text, Pressable, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { colors } from "@/constants/colors";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepPress: (step: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepPress,
}: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        const isFuture = stepNum > currentStep;

        return (
          <View key={index} style={styles.stepWrapper}>
            {/* Connector line */}
            {index > 0 && (
              <View
                style={[
                  styles.connector,
                  isCompleted || isCurrent
                    ? { backgroundColor: colors.success }
                    : { backgroundColor: colors.gray[200] },
                ]}
              />
            )}

            <Pressable
              style={styles.stepColumn}
              onPress={() => {
                if (isCompleted) onStepPress(stepNum);
              }}
              disabled={isFuture}
            >
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.completedCircle,
                  isCurrent && styles.currentCircle,
                  isFuture && styles.futureCircle,
                ]}
              >
                {isCompleted ? (
                  <FontAwesome name="check" size={10} color={colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.circleText,
                      isCurrent && styles.currentCircleText,
                      isFuture && styles.futureCircleText,
                    ]}
                  >
                    {stepNum}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  isCurrent && styles.currentLabel,
                  isFuture && styles.futureLabel,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  connector: {
    height: 2,
    flex: 1,
    marginTop: 12,
    marginHorizontal: -4,
  },
  stepColumn: {
    alignItems: "center",
    gap: 4,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  completedCircle: {
    backgroundColor: colors.success,
  },
  currentCircle: {
    backgroundColor: colors.maroon[600],
  },
  futureCircle: {
    backgroundColor: colors.gray[200],
  },
  circleText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.white,
  },
  currentCircleText: {
    color: colors.white,
  },
  futureCircleText: {
    color: colors.gray[400],
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.gray[600],
    textAlign: "center",
  },
  currentLabel: {
    color: colors.maroon[600],
    fontWeight: "600",
  },
  futureLabel: {
    color: colors.gray[400],
  },
});
