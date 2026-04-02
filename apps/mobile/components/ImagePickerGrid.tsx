import { View, Text, Pressable, Image, Alert, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { APP_CONFIG } from "@uchicago-marketplace/shared";
import { colors } from "@/constants/colors";

interface ImagePickerGridProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
}

const MAX = APP_CONFIG.maxImagesPerPost;

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
      const uris = result.assets.map((a) => a.uri);
      onImagesChange([...images, ...uris].slice(0, MAX));
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
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      onImagesChange([...images, result.assets[0].uri].slice(0, MAX));
    }
  }

  function removeImage(index: number) {
    const next = [...images];
    next.splice(index, 1);
    onImagesChange(next);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>
        {images.length}/{MAX} photos
      </Text>

      <View style={styles.grid}>
        {images.map((uri, i) => (
          <View key={uri + i} style={styles.thumbWrapper}>
            <Image source={{ uri }} style={styles.thumb} />
            <Pressable style={styles.removeBtn} onPress={() => removeImage(i)}>
              <FontAwesome name="times" size={10} color={colors.white} />
            </Pressable>
          </View>
        ))}

        {remaining > 0 && (
          <>
            <Pressable style={styles.addBtn} onPress={pickFromLibrary}>
              <FontAwesome name="photo" size={20} color={colors.gray[400]} />
              <Text style={styles.addLabel}>Library</Text>
            </Pressable>

            <Pressable style={styles.addBtn} onPress={takePhoto}>
              <FontAwesome name="camera" size={20} color={colors.gray[400]} />
              <Text style={styles.addLabel}>Camera</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    overflow: "hidden",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
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
});
