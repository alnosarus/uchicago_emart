import { useState, useCallback } from "react";
import type { CreatePostInput } from "@uchicago-marketplace/shared";
import { api } from "@/lib/api";

export interface CreatePostState {
  step: number;
  images: string[];

  type: "marketplace" | "storage" | "housing" | null;
  housingSubtype: "sublet" | "passdown" | null;

  title: string;
  description: string;

  // Marketplace
  side: string;
  category: string;
  condition: string;
  priceType: "fixed" | "free" | "trade";
  priceAmount: string;
  tradeDescription: string;
  tags: string[];

  // Storage
  startDate: string;
  endDate: string;
  size: string;
  locationType: string;
  neighborhood: string;
  isFree: boolean;
  priceMonthly: string;
  restrictions: string;

  // Housing
  monthlyRent: string;
  bedrooms: string;
  bathrooms: string;
  amenities: string[];
  roommates: string;
  roommateCount: string;
  moveInDate: string;
  moveOutDate: string;
  leaseStartDate: string;
  leaseDurationMonths: string;

  isSubmitting: boolean;
  error: string | null;
}

const INITIAL_STATE: CreatePostState = {
  step: 1,
  images: [],
  type: null,
  housingSubtype: null,
  title: "",
  description: "",

  side: "sell",
  category: "",
  condition: "",
  priceType: "fixed",
  priceAmount: "",
  tradeDescription: "",
  tags: [],

  startDate: "",
  endDate: "",
  size: "",
  locationType: "on_campus",
  neighborhood: "",
  isFree: false,
  priceMonthly: "",
  restrictions: "",

  monthlyRent: "",
  bedrooms: "",
  bathrooms: "",
  amenities: [],
  roommates: "solo",
  roommateCount: "",
  moveInDate: "",
  moveOutDate: "",
  leaseStartDate: "",
  leaseDurationMonths: "",

  isSubmitting: false,
  error: null,
};

export function useCreatePost() {
  const [state, setState] = useState<CreatePostState>({ ...INITIAL_STATE });

  const update = useCallback((partial: Partial<CreatePostState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const goToStep = useCallback((n: number) => {
    setState((prev) => ({ ...prev, step: n, error: null }));
  }, []);

  const canAdvance = useCallback((): boolean => {
    switch (state.step) {
      case 1:
        // Photos are optional
        return true;
      case 2:
        if (!state.type) return false;
        if (state.type === "housing" && !state.housingSubtype) return false;
        return true;
      case 3:
        return state.title.trim().length >= 1 && state.title.length <= 80;
      case 4:
        return validateTypeDetails(state);
      default:
        return true;
    }
  }, [state]);

  const nextStep = useCallback(() => {
    if (state.step < 5 && canAdvance()) {
      setState((prev) => ({ ...prev, step: prev.step + 1, error: null }));
    }
  }, [state.step, canAdvance]);

  const prevStep = useCallback(() => {
    if (state.step > 1) {
      setState((prev) => ({ ...prev, step: prev.step - 1, error: null }));
    }
  }, [state.step]);

  const buildPayload = useCallback((): CreatePostInput | null => {
    const base = {
      title: state.title.trim(),
      description: state.description.trim() || null,
    };

    if (state.type === "marketplace") {
      return {
        ...base,
        type: "marketplace" as const,
        side: state.side as "sell" | "buy",
        marketplace: {
          priceType: state.priceType,
          priceAmount:
            state.priceType === "fixed" ? parseFloat(state.priceAmount) || 0 : null,
          condition: state.condition as "new" | "like_new" | "good" | "fair" | "for_parts" | "unknown",
          category: state.category,
          tradeDescription:
            state.priceType === "trade" ? state.tradeDescription || null : null,
          tags: state.tags,
        },
      };
    }

    if (state.type === "storage") {
      return {
        ...base,
        type: "storage" as const,
        side: state.side as "has_space" | "need_storage",
        storage: {
          startDate: state.startDate,
          endDate: state.endDate,
          size: state.size as "boxes" | "half_room" | "full_room",
          locationType: state.locationType as "on_campus" | "off_campus",
          neighborhood: state.neighborhood || null,
          priceMonthly: state.isFree
            ? null
            : parseFloat(state.priceMonthly) || null,
          isFree: state.isFree,
          restrictions: state.restrictions || null,
        },
      };
    }

    if (state.type === "housing") {
      return {
        ...base,
        type: "housing" as const,
        side: state.side as "offering" | "looking",
        housing: {
          subtype: state.housingSubtype as "sublet" | "passdown",
          side: state.side as "offering" | "looking",
          monthlyRent: parseFloat(state.monthlyRent) || 0,
          bedrooms: state.bedrooms as "studio" | "1" | "2" | "3_plus",
          bathrooms: state.bathrooms as "1" | "1.5" | "2_plus",
          neighborhood: state.neighborhood || null,
          amenities: state.amenities,
          roommates: state.roommates as "solo" | "shared",
          roommateCount:
            state.roommates === "shared"
              ? parseInt(state.roommateCount, 10) || null
              : null,
          moveInDate:
            state.housingSubtype === "sublet" ? state.moveInDate || null : null,
          moveOutDate:
            state.housingSubtype === "sublet" ? state.moveOutDate || null : null,
          leaseStartDate:
            state.housingSubtype === "passdown" ? state.leaseStartDate || null : null,
          leaseDurationMonths:
            state.housingSubtype === "passdown"
              ? parseInt(state.leaseDurationMonths, 10) || null
              : null,
        },
      };
    }

    return null;
  }, [state]);

  const submit = useCallback(async (): Promise<string | null> => {
    const payload = buildPayload();
    if (!payload) {
      update({ error: "Invalid post data" });
      return null;
    }

    update({ isSubmitting: true, error: null });

    try {
      const post = await api.posts.create(payload);

      // Upload images if any
      if (state.images.length > 0) {
        const formData = new FormData();
        state.images.forEach((uri, i) => {
          const filename = uri.split("/").pop() || `photo_${i}.jpg`;
          const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
          const mimeType = ext === "png" ? "image/png" : "image/jpeg";
          formData.append("images", {
            uri,
            name: filename,
            type: mimeType,
          } as unknown as Blob);
        });
        await api.posts.uploadImages(post.id, formData);
      }

      const postId = post.id;
      setState({ ...INITIAL_STATE });
      return postId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create post";
      update({ isSubmitting: false, error: message });
      return null;
    }
  }, [buildPayload, state.images, update]);

  const reset = useCallback(() => {
    setState({ ...INITIAL_STATE });
  }, []);

  return {
    state,
    update,
    goToStep,
    nextStep,
    prevStep,
    canAdvance,
    buildPayload,
    submit,
    reset,
  };
}

function validateTypeDetails(s: CreatePostState): boolean {
  if (s.type === "marketplace") {
    if (!s.category) return false;
    if (!s.condition) return false;
    if (s.priceType === "fixed" && !s.priceAmount) return false;
    if (s.priceType === "trade" && !s.tradeDescription.trim()) return false;
    return true;
  }

  if (s.type === "storage") {
    if (!s.startDate || !s.endDate) return false;
    if (!s.size) return false;
    if (!s.isFree && !s.priceMonthly) return false;
    return true;
  }

  if (s.type === "housing") {
    if (!s.monthlyRent) return false;
    if (!s.bedrooms) return false;
    if (!s.bathrooms) return false;
    if (s.housingSubtype === "sublet" && (!s.moveInDate || !s.moveOutDate)) return false;
    if (s.housingSubtype === "passdown" && (!s.leaseStartDate || !s.leaseDurationMonths)) return false;
    return true;
  }

  return false;
}
