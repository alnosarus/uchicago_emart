export const MARKETPLACE_CATEGORIES = [
  "Textbooks & Course Materials",
  "Electronics & Tech",
  "Furniture & Home",
  "Clothing & Accessories",
  "Lab Supplies",
  "Sports & Fitness",
  "Music & Instruments",
  "Services & Tutoring",
  "Other",
] as const;

export const MARKETPLACE_TAGS = [
  "Textbooks",
  "Electronics",
  "Furniture",
  "Clothing",
  "Science",
  "Art",
  "Music",
  "Sports",
  "Kitchen",
  "Engineering",
  "Decor",
  "Transport",
] as const;

export const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "for_parts", label: "For Parts" },
  { value: "unknown", label: "Unknown" },
] as const;

export const NEIGHBORHOODS = [
  "Hyde Park",
  "Woodlawn",
  "South Shore",
  "Kenwood",
  "Bronzeville",
  "Other",
] as const;

export const STORAGE_SIZES = [
  { value: "boxes", label: "A Few Boxes", description: "Small items only" },
  { value: "half_room", label: "Half a Room", description: "Medium amount" },
  { value: "full_room", label: "Full Room", description: "Large amount" },
] as const;
