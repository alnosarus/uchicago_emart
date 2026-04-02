export const colors = {
  marketplace: { primary: "#800000", light: "#fdf2f2", badge: "#800000" },
  storage: { primary: "#b45309", light: "#fef7e0", badge: "#b45309" },
  housing: { primary: "#6366f1", light: "#ede9fe", badge: "#6366f1" },
  maroon: { 50: "#fdf2f2", 100: "#f5d5d5", 500: "#a00000", 600: "#800000", 700: "#660000" },
  gray: { 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626", 900: "#171717" },
  white: "#ffffff",
  black: "#000000",
  star: "#f5a623",
  success: "#2d6a2d",
  error: "#dc2626",
  badge: {
    condition: { bg: "#f0f7f0", text: "#2d6a2d" },
    category: { bg: "#f0f0f7", text: "#4a4a8a" },
    size: { bg: "#fef7e0", text: "#8a6d2a" },
    location: { bg: "#e0f0ff", text: "#2a5a8a" },
    amenity: { bg: "#fef3c7", text: "#92400e" },
    bedroom: { bg: "#ede9fe", text: "#5b21b6" },
  },
} as const;

export function getAccentColor(type: string): string {
  if (type === "marketplace") return colors.marketplace.primary;
  if (type === "storage") return colors.storage.primary;
  if (type === "housing") return colors.housing.primary;
  return colors.maroon[600];
}
