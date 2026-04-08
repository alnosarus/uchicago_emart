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
import { createPost } from "./posts.service";
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
