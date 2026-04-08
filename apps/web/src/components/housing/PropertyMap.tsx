"use client";

import { useEffect, useRef } from "react";
import { useGoogleMaps } from "./GoogleMapsLoader";

type Props = {
  latitude: number;
  longitude: number;
  address?: string;
  height?: number;
  zoom?: number;
};

export function PropertyMap({ latitude, longitude, address, height = 300, zoom = 16 }: Props) {
  const { isLoaded, loadError } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const center = { lat: latitude, lng: longitude };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapId: "HOUSING_PROPERTY_MAP",
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
    } else {
      mapInstanceRef.current.setCenter(center);
      mapInstanceRef.current.setZoom(zoom);
    }

    // Clean up old marker
    if (markerRef.current) {
      markerRef.current.map = null;
    }

    markerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map: mapInstanceRef.current,
      position: center,
      title: address,
    });

    if (address) {
      const infoWindow = new google.maps.InfoWindow({ content: address });
      markerRef.current.addListener("click", () => {
        infoWindow.open({ map: mapInstanceRef.current!, anchor: markerRef.current! });
      });
    }
  }, [isLoaded, latitude, longitude, address, zoom]);

  if (loadError) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-600"
      >
        Map unavailable{address ? `. Address: ${address}` : ""}
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50"
      aria-label={address ? `Map showing ${address}` : "Property map"}
    />
  );
}
