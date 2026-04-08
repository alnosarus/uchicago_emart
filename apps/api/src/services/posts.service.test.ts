import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks — vi.hoisted ensures these are initialized before vi.mock factories run
const {
  verifyPlaceIdMock,
  postCreateMock,
  postFindUniqueMock,
  postUpdateMock,
  postFindManyMock,
} = vi.hoisted(() => ({
  verifyPlaceIdMock: vi.fn(),
  postCreateMock: vi.fn(),
  postFindUniqueMock: vi.fn(),
  postUpdateMock: vi.fn(),
  postFindManyMock: vi.fn(),
}));

vi.mock("./geocoding.service", () => ({
  verifyPlaceId: verifyPlaceIdMock,
  PlaceVerificationError: class PlaceVerificationError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock("../config/database", () => ({
  prisma: {
    post: {
      create: (...args: unknown[]) => postCreateMock(...args),
      findUnique: (...args: unknown[]) => postFindUniqueMock(...args),
      update: (...args: unknown[]) => postUpdateMock(...args),
      findMany: (...args: unknown[]) => postFindManyMock(...args),
    },
  },
}));

// Import AFTER mocks are set up
import { createPost, updatePost } from "./posts.service";
import { HttpError } from "../utils/errors";

const baseHousingInput = {
  authorId: "user-1",
  type: "housing" as const,
  side: "offering",
  title: "Cozy sublet",
  housing: {
    subtype: "sublet",
    side: "offering",
    monthlyRent: 1200,
    bedrooms: "1",
    bathrooms: "1",
    neighborhood: null,
    amenities: [],
    roommates: "solo",
    roommateCount: null,
    moveInDate: null,
    moveOutDate: null,
    leaseStartDate: null,
    leaseDurationMonths: null,
    placeId: "ChIJVALID",
  },
};

const verifiedPlace = {
  address: "1234 E 55th St, Chicago, IL 60615, USA",
  latitude: 41.7943,
  longitude: -87.5907,
  placeId: "ChIJVALID",
};

describe("createPost — housing address verification", () => {
  beforeEach(() => {
    verifyPlaceIdMock.mockReset();
    postCreateMock.mockReset();
    postCreateMock.mockResolvedValue({ id: "post-1" });
  });

  it("verifies placeId and stores Google-authoritative fields on housing create", async () => {
    verifyPlaceIdMock.mockResolvedValue(verifiedPlace);

    await createPost(baseHousingInput);

    expect(verifyPlaceIdMock).toHaveBeenCalledWith("ChIJVALID");
    const createArg = postCreateMock.mock.calls[0][0];
    expect(createArg.data.housing.create).toMatchObject({
      address: verifiedPlace.address,
      latitude: verifiedPlace.latitude,
      longitude: verifiedPlace.longitude,
      placeId: verifiedPlace.placeId,
    });
  });

  it("throws HttpError 400 when verifyPlaceId rejects with PlaceVerificationError", async () => {
    const { PlaceVerificationError } = await import("./geocoding.service");
    verifyPlaceIdMock.mockRejectedValue(
      new PlaceVerificationError("wrong_type", "Please select a street address"),
    );

    await expect(createPost(baseHousingInput)).rejects.toThrow(HttpError);
    await expect(createPost(baseHousingInput)).rejects.toMatchObject({
      status: 400,
      message: "Please select a street address",
    });
    expect(postCreateMock).not.toHaveBeenCalled();
  });

  it("never stores client-submitted latitude/longitude (trust boundary)", async () => {
    verifyPlaceIdMock.mockResolvedValue(verifiedPlace);

    // Cast through unknown to simulate a malicious client payload with extra
    // lat/lng fields that are NOT part of CreatePostInput's housing type.
    const maliciousInput = {
      ...baseHousingInput,
      housing: {
        ...baseHousingInput.housing,
        latitude: 0,
        longitude: 0,
      },
    } as unknown as Parameters<typeof createPost>[0];

    await createPost(maliciousInput);

    const createArg = postCreateMock.mock.calls[0][0];
    expect(createArg.data.housing.create.latitude).toBe(verifiedPlace.latitude);
    expect(createArg.data.housing.create.longitude).toBe(verifiedPlace.longitude);
  });

  it("does not call verifyPlaceId for non-housing posts", async () => {
    verifyPlaceIdMock.mockResolvedValue(verifiedPlace);

    await createPost({
      authorId: "user-1",
      type: "marketplace",
      side: "sell",
      title: "Textbook",
      marketplace: {
        priceType: "fixed",
        priceAmount: 20,
        condition: "good",
        category: "books",
      },
    });

    expect(verifyPlaceIdMock).not.toHaveBeenCalled();
  });
});

describe("updatePost — housing address verification", () => {
  const existingHousing = {
    id: "post-1",
    authorId: "user-1",
    type: "housing" as const,
    status: "active",
    housing: {
      postId: "post-1",
      placeId: "ChIJEXISTING",
      address: "123 Old St, Chicago, IL",
      latitude: 41.79,
      longitude: -87.59,
    },
  };

  beforeEach(() => {
    verifyPlaceIdMock.mockReset();
    postFindUniqueMock.mockReset();
    postUpdateMock.mockReset();
    postUpdateMock.mockResolvedValue({ id: "post-1" });
  });

  it("skips verifyPlaceId when placeId is unchanged", async () => {
    postFindUniqueMock.mockResolvedValue(existingHousing);

    await updatePost("post-1", "user-1", {
      housing: { placeId: "ChIJEXISTING", monthlyRent: 1400 },
    });

    expect(verifyPlaceIdMock).not.toHaveBeenCalled();
    const updateArg = postUpdateMock.mock.calls[0][0];
    // Address fields should NOT be in the update payload
    expect(updateArg.data.housing.update.address).toBeUndefined();
    expect(updateArg.data.housing.update.latitude).toBeUndefined();
  });

  it("re-verifies when placeId changes", async () => {
    postFindUniqueMock.mockResolvedValue(existingHousing);
    verifyPlaceIdMock.mockResolvedValue({
      address: "456 New St, Chicago, IL",
      latitude: 41.80,
      longitude: -87.60,
      placeId: "ChIJNEW",
    });

    await updatePost("post-1", "user-1", {
      housing: { placeId: "ChIJNEW" },
    });

    expect(verifyPlaceIdMock).toHaveBeenCalledWith("ChIJNEW");
    const updateArg = postUpdateMock.mock.calls[0][0];
    expect(updateArg.data.housing.update.address).toBe("456 New St, Chicago, IL");
    expect(updateArg.data.housing.update.placeId).toBe("ChIJNEW");
  });

  it("requires placeId when editing a legacy post (no existing placeId)", async () => {
    postFindUniqueMock.mockResolvedValue({
      ...existingHousing,
      housing: { ...existingHousing.housing, placeId: null, address: null, latitude: null, longitude: null },
    });

    await expect(
      updatePost("post-1", "user-1", { housing: { monthlyRent: 1400 } }),
    ).rejects.toMatchObject({ status: 400, message: /verified address/ });
    expect(verifyPlaceIdMock).not.toHaveBeenCalled();
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  it("allows editing a legacy post when placeId is now provided", async () => {
    postFindUniqueMock.mockResolvedValue({
      ...existingHousing,
      housing: { ...existingHousing.housing, placeId: null, address: null, latitude: null, longitude: null },
    });
    verifyPlaceIdMock.mockResolvedValue({
      address: "789 Legacy St, Chicago, IL",
      latitude: 41.79,
      longitude: -87.59,
      placeId: "ChIJFIRSTTIME",
    });

    await updatePost("post-1", "user-1", {
      housing: { placeId: "ChIJFIRSTTIME", monthlyRent: 1500 },
    });

    expect(verifyPlaceIdMock).toHaveBeenCalledWith("ChIJFIRSTTIME");
    const updateArg = postUpdateMock.mock.calls[0][0];
    expect(updateArg.data.housing.update.address).toBe("789 Legacy St, Chicago, IL");
  });

  it("throws 400 when new placeId is invalid", async () => {
    const { PlaceVerificationError } = await import("./geocoding.service");
    postFindUniqueMock.mockResolvedValue(existingHousing);
    verifyPlaceIdMock.mockRejectedValue(
      new PlaceVerificationError("out_of_bounds", "Address must be in the Chicago area"),
    );

    await expect(
      updatePost("post-1", "user-1", { housing: { placeId: "ChIJNYC" } }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Address must be in the Chicago area",
    });
    expect(postUpdateMock).not.toHaveBeenCalled();
  });
});
