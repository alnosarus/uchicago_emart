import { View, Text, Pressable, Image, Alert, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { APP_CONFIG } from "@uchicago-marketplace/shared";
import { colors } from "@/constants/colors";
import { useCallback } from "react";

interface ImagePickerGridProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
}

const MAX = APP_CONFIG.maxImagesPerPost;

async function compressImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    return uri; // Return original if compression fails
  }
}

export function ImagePickerGrid({
  images,
  onImagesChange,
}: ImagePickerGridProps) {
  const remaining = MAX - images.length;

  async function pickFromLibrary() {
    if (remaining <= 0) {
      Alert.alert("Limit reached", `You can add up to ${MAX} photos.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const compressed = await Promise.all(
        result.assets.map((a) => compressImage(a.uri))
      );
      onImagesChange([...images, ...compressed].slice(0, MAX));
    }
  }

  async function takePhoto() {
    if (remaining <= 0) {
      Alert.alert("Limit reached", `You can add up to ${MAX} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera access is needed to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) {
      const compressed = await compressImage(result.assets[0].uri);
      onImagesChange([...images, compressed].slice(0, MAX));
    }
  }

  function removeImage(index: number) {
    const next = [...images];
    next.splice(index, 1);
    onImagesChange(next);
  }

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<string>) => {
      const index = getIndex() ?? 0;
      return (
        <ScaleDecorator>
          <Pressable
            onLongPress={drag}
            disabled={isActive}
            style={[styles.thumbWrapper, isActive && styles.dragging]}
          >
            <Image source={{ uri: item }} style={styles.thumb} />
            {index === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverText}>Cover</Text>
              </View>
            )}
            <Pressable style={styles.removeBtn} onPress={() => removeImage(index)}>
              <FontAwesome name="times" size={10} color={colors.white} />
            </Pressable>
          </Pressable>
        </ScaleDecorator>
      );
    },
    [images]
  );

  return (
    <GestureHandlerRootView>
      <View style={styles.container}>
        <Text style={styles.counter}>
          {images.length}/{MAX} photos
        </Text>

        {images.length > 0 && (
          <DraggableFlatList
            data={images}
            onDragEnd={({ data }) => onImagesChange(data)}
            keyExtractor={(item, i) => `${item}-${i}`}
            renderItem={renderItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}

        {remaining > 0 && (
          <View style={styles.buttons}>
            <Pressable style={styles.addBtn} onPress={pickFromLibrary}>
              <FontAwesome name="photo" size={20} color={colors.gray[400]} />
              <Text style={styles.addLabel}>Library</Text>
            </Pressable>

            <Pressable style={styles.addBtn} onPress={takePhoto}>
              <FontAwesome name="camera" size={20} color={colors.gray[400]} />
              <Text style={styles.addLabel}>Camera</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.hint}>Long press & drag to reorder. First photo is the cover.</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const THUMB_SIZE = 88;

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  counter: {
    fontSize: 13,
    color: colors.gray[500],
    fontWeight: "500",
  },
  listContent: {
    gap: 10,
    paddingVertical: 4,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    overflow: "hidden",
  },
  dragging: {
    opacity: 0.7,
    transform: [{ scale: 1.05 }],
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
  },
  coverBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "rgba(128,0,0,0.85)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
  },
  addBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.gray[300],
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addLabel: {
    fontSize: 10,
    color: colors.gray[400],
    fontWeight: "500",
  },
  hint: {
    fontSize: 11,
    color: colors.gray[400],
  },
});
