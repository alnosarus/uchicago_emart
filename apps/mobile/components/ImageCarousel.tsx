import { useState, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  Image,
  Text,
  Dimensions,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { colors } from "@/constants/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const IMAGE_HEIGHT = SCREEN_WIDTH * 0.75; // 4:3 aspect ratio

interface ImageCarouselProps {
  images: { id: string; url: string; order: number }[];
}

export function ImageCarousel({ images }: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      setActiveIndex(index);
    },
    []
  );

  if (!images || images.length === 0) {
    return (
      <View style={[styles.placeholder, { height: IMAGE_HEIGHT }]}>
        <Text style={styles.placeholderText}>No images</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url }}
            style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
            resizeMode="cover"
          />
        )}
      />
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: SCREEN_WIDTH,
    backgroundColor: colors.gray[100],
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 16,
    color: colors.gray[400],
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.white,
  },
  dotInactive: {
    backgroundColor: "rgba(255,255,255,0.4)",
  },
});
