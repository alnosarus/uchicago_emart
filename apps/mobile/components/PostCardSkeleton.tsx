import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

function PulseBox({ style }: { style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.pulse, style, { opacity }]} />;
}

export function PostCardSkeleton() {
  return (
    <View style={styles.card}>
      <PulseBox style={styles.image} />
      <View style={styles.content}>
        <PulseBox style={styles.bar1} />
        <PulseBox style={styles.bar2} />
        <PulseBox style={styles.bar3} />
        <PulseBox style={styles.bar4} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  pulse: {
    backgroundColor: colors.gray[200],
    borderRadius: 4,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
  },
  bar1: { width: "70%", height: 14 },
  bar2: { width: "40%", height: 16 },
  bar3: { width: "90%", height: 10 },
  bar4: { width: "50%", height: 10 },
});
