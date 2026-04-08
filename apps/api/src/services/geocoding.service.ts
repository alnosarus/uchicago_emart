import { env } from "../config/env";

export type VerifiedPlace = {
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
};

export type PlaceVerificationErrorCode =
  | "not_found"
  | "wrong_type"
  | "out_of_bounds"
  | "network";

export class PlaceVerificationError extends Error {
  constructor(
    public code: PlaceVerificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PlaceVerificationError";
  }
}

const BUILDING_TYPES = new Set(["street_address", "premise", "subpremise"]);

type Bbox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

function parseBbox(str: string): Bbox {
  const parts = str.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid GEOCODING_CHICAGO_BBOX: ${str}`);
  }
  const [minLat, minLng, maxLat, maxLng] = parts;
  return { minLat, minLng, maxLat, maxLng };
}

function inBbox(lat: number, lng: number, bbox: Bbox): boolean {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  );
}

/**
 * Resolves a Google Place ID to a canonical, verified address.
 *
 * Security/trust note: this is the ONLY authoritative source of coordinates
 * for housing listings. Never trust lat/lng submitted by clients.
 *
 * Throws PlaceVerificationError with a machine-readable `code` for all
 * failure modes — caller maps these to HTTP 400 responses.
 */
export async function verifyPlaceId(placeId: string): Promise<VerifiedPlace> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "place_id,formatted_address,geometry,types");
  url.searchParams.set("key", env.GOOGLE_PLACES_SERVER_KEY);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (err) {
    throw new PlaceVerificationError(
      "network",
      `Network error contacting Google: ${(err as Error).message}`,
    );
  }

  if (!response.ok) {
    throw new PlaceVerificationError("network", `Google returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    status: string;
    result?: {
      place_id: string;
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      types: string[];
    };
  };

  if (body.status !== "OK" || !body.result) {
    throw new PlaceVerificationError(
      "not_found",
      `Google Place Details returned status ${body.status}`,
    );
  }

  const { result } = body;

  const isBuilding = result.types.some((t) => BUILDING_TYPES.has(t));
  if (!isBuilding) {
    throw new PlaceVerificationError(
      "wrong_type",
      "Please select a specific street address, not a city or neighborhood",
    );
  }

  const bbox = parseBbox(env.GEOCODING_CHICAGO_BBOX);
  const { lat, lng } = result.geometry.location;
  if (!inBbox(lat, lng, bbox)) {
    throw new PlaceVerificationError(
      "out_of_bounds",
      "Address must be in the Chicago area",
    );
  }

  return {
    address: result.formatted_address,
    latitude: lat,
    longitude: lng,
    placeId: result.place_id,
  };
}
