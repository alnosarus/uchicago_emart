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

export const HOUSING_AMENITIES = [
  { value: "furnished",       label: "Furnished" },
  { value: "in_unit_laundry", label: "In-Unit Laundry" },
  { value: "parking",         label: "Parking" },
  { value: "ac",              label: "AC" },
  { value: "pets_allowed",    label: "Pets Allowed" },
  { value: "dishwasher",      label: "Dishwasher" },
  { value: "gym",             label: "Gym" },
] as const;

export const BEDROOM_OPTIONS = [
  { value: "studio",    label: "Studio" },
  { value: "1",         label: "1 Bedroom" },
  { value: "2",         label: "2 Bedrooms" },
  { value: "3_plus",    label: "3+ Bedrooms" },
] as const;

export const BATHROOM_OPTIONS = [
  { value: "1",      label: "1 Bath" },
  { value: "1.5",    label: "1.5 Bath" },
  { value: "2_plus", label: "2+ Bath" },
] as const;

export const LEASE_DURATION_OPTIONS = [
  { value: 6,  label: "6 months" },
  { value: 9,  label: "9 months" },
  { value: 11, label: "11 months" },
  { value: 12, label: "12 months" },
] as const;
