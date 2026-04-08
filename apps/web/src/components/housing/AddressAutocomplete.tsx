"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "./GoogleMapsLoader";

// UChicago main quad — used as the center for location bias
const UCHICAGO_CENTER = { lat: 41.7886, lng: -87.5987 };
const BIAS_RADIUS_METERS = 10_000;

export type SelectedPlace = {
  placeId: string;
  formattedAddress: string;
};

type Props = {
  onSelect: (place: SelectedPlace | null) => void;
  initialValue?: string;
  error?: string | null;
  disabled?: boolean;
};

export function AddressAutocomplete({ onSelect, initialValue, error, disabled }: Props) {
  const { isLoaded, loadError } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [hasSelection, setHasSelection] = useState(Boolean(initialValue));

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Using the classic Autocomplete class — the newer PlaceAutocompleteElement
    // is a web component with different integration, and this is simpler for now.
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      types: ["address"],
      fields: ["place_id", "formatted_address", "types"],
      bounds:
        new google.maps.Circle({
          center: UCHICAGO_CENTER,
          radius: BIAS_RADIUS_METERS,
        }).getBounds() ?? undefined,
      strictBounds: false,
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.place_id && place.formatted_address) {
        setHasSelection(true);
        onSelect({
          placeId: place.place_id,
          formattedAddress: place.formatted_address,
        });
      }
    });

    autocompleteRef.current = autocomplete;

    return () => {
      listener.remove();
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [isLoaded, onSelect]);

  // When the user types AFTER selecting, clear the selection
  // (forces them to re-pick from the dropdown)
  function handleInput() {
    if (hasSelection) {
      setHasSelection(false);
      onSelect(null);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Address verification is temporarily unavailable. Please try again in a moment.
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        defaultValue={initialValue ?? ""}
        onInput={handleInput}
        disabled={disabled || !isLoaded}
        placeholder={isLoaded ? "Start typing an address…" : "Loading address search…"}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-600 ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {!error && hasSelection && (
        <p className="mt-1 text-xs text-green-700">Address verified ✓</p>
      )}
    </div>
  );
}
