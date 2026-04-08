import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyPlaceId, PlaceVerificationError } from "./geocoding.service";

// Mock the env module so tests don't require a real key
vi.mock("../config/env", () => ({
  env: {
    GOOGLE_PLACES_SERVER_KEY: "test-key",
    GEOCODING_CHICAGO_BBOX: "41.6,-87.9,42.1,-87.5",
  },
}));

// Valid Google Place Details response for a UChicago-area building
const validResponse = {
  status: "OK",
  result: {
    place_id: "ChIJTEST_VALID",
    formatted_address: "1234 E 55th St, Chicago, IL 60615, USA",
    geometry: { location: { lat: 41.7943, lng: -87.5907 } },
    types: ["street_address"],
  },
};

describe("verifyPlaceId", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns canonical address, lat, lng for a valid building place_id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => validResponse,
    });

    const result = await verifyPlaceId("ChIJTEST_VALID");

    expect(result).toEqual({
      address: "1234 E 55th St, Chicago, IL 60615, USA",
      latitude: 41.7943,
      longitude: -87.5907,
      placeId: "ChIJTEST_VALID",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("place_id=ChIJTEST_VALID");
    expect(calledUrl).toContain("key=test-key");
  });

  it("throws 'not_found' when Google returns ZERO_RESULTS", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS", result: null }),
    });

    await expect(verifyPlaceId("ChIJBOGUS")).rejects.toThrow(PlaceVerificationError);
    await expect(verifyPlaceId("ChIJBOGUS")).rejects.toMatchObject({ code: "not_found" });
  });

  it("throws 'not_found' when Google returns INVALID_REQUEST", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "INVALID_REQUEST" }),
    });

    await expect(verifyPlaceId("badid")).rejects.toMatchObject({ code: "not_found" });
  });

  it("throws 'wrong_type' when the place is a city (locality)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        result: {
          place_id: "ChIJCHICAGO",
          formatted_address: "Chicago, IL, USA",
          geometry: { location: { lat: 41.8781, lng: -87.6298 } },
          types: ["locality", "political"],
        },
      }),
    });

    await expect(verifyPlaceId("ChIJCHICAGO")).rejects.toMatchObject({ code: "wrong_type" });
  });

  it("throws 'wrong_type' when the place is a neighborhood", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        result: {
          place_id: "ChIJHYDEPARK",
          formatted_address: "Hyde Park, Chicago, IL, USA",
          geometry: { location: { lat: 41.794, lng: -87.59 } },
          types: ["neighborhood", "political"],
        },
      }),
    });

    await expect(verifyPlaceId("ChIJHYDEPARK")).rejects.toMatchObject({ code: "wrong_type" });
  });

  it("accepts 'premise' and 'subpremise' types", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        result: {
          place_id: "ChIJAPT",
          formatted_address: "1234 E 55th St Apt 3, Chicago, IL 60615, USA",
          geometry: { location: { lat: 41.7943, lng: -87.5907 } },
          types: ["subpremise"],
        },
      }),
    });

    const result = await verifyPlaceId("ChIJAPT");
    expect(result.address).toContain("Apt 3");
  });

  it("throws 'out_of_bounds' when lat/lng falls outside Chicago bbox", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        result: {
          place_id: "ChIJNYC",
          formatted_address: "350 5th Ave, New York, NY 10118, USA",
          geometry: { location: { lat: 40.7484, lng: -73.9857 } },
          types: ["street_address"],
        },
      }),
    });

    await expect(verifyPlaceId("ChIJNYC")).rejects.toMatchObject({ code: "out_of_bounds" });
  });

  it("throws 'network' when fetch itself rejects", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(verifyPlaceId("ChIJTEST")).rejects.toMatchObject({ code: "network" });
  });

  it("throws 'network' when HTTP response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(verifyPlaceId("ChIJTEST")).rejects.toMatchObject({ code: "network" });
  });
});
