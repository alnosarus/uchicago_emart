"use client";

import { useEffect, useRef } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useGoogleMaps } from "./GoogleMapsLoader";

const UCHICAGO_CENTER = { lat: 41.7886, lng: -87.5987 };
const DEFAULT_ZOOM = 13;

export type HousingMapPost = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  monthlyRent: number;
  latitude: number;
  longitude: number;
};

type Props = {
  posts: HousingMapPost[];
  onPinClick: (postId: string) => void;
};

function formatPrice(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function buildInfoWindowContent(post: HousingMapPost): string {
  const thumb = post.thumbnailUrl
    ? `<img src="${post.thumbnailUrl}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:4px;margin-bottom:6px;" />`
    : "";
  return `
    <div style="max-width:200px;font-family:system-ui,sans-serif;">
      ${thumb}
      <div style="font-weight:600;margin-bottom:2px;">${post.title}</div>
      <div style="font-size:14px;color:#333;">${formatPrice(post.monthlyRent)}/mo</div>
      <div style="margin-top:6px;"><a data-post-id="${post.id}" class="housing-map-link" style="color:#800000;font-weight:500;cursor:pointer;">View listing →</a></div>
    </div>
  `;
}

export function HousingMapView({ posts, onPinClick }: Props) {
  const { isLoaded, loadError } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: UCHICAGO_CENTER,
        zoom: DEFAULT_ZOOM,
        mapId: "HOUSING_BROWSE_MAP",
        disableDefaultUI: false,
        clickableIcons: false,
      });
      infoWindowRef.current = new google.maps.InfoWindow();

      // Delegate clicks on "View listing" links inside info windows
      google.maps.event.addListener(infoWindowRef.current, "domready", () => {
        const links = document.querySelectorAll<HTMLElement>(".housing-map-link");
        links.forEach((link) => {
          link.addEventListener("click", () => {
            const id = link.getAttribute("data-post-id");
            if (id) onPinClick(id);
          });
        });
      });
    }

    // Clear existing clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }

    // Build markers
    const markers = posts.map((post) => {
      const badge = document.createElement("div");
      badge.style.cssText = `
        background:#800000;color:white;padding:4px 8px;border-radius:12px;
        font-size:12px;font-weight:600;box-shadow:0 2px 4px rgba(0,0,0,0.2);
        white-space:nowrap;
      `;
      badge.textContent = formatPrice(post.monthlyRent);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: post.latitude, lng: post.longitude },
        content: badge,
        title: post.title,
      });

      marker.addListener("click", () => {
        if (!infoWindowRef.current || !mapInstanceRef.current) return;
        infoWindowRef.current.setContent(buildInfoWindowContent(post));
        infoWindowRef.current.open({ map: mapInstanceRef.current, anchor: marker });
      });

      return marker;
    });

    clustererRef.current = new MarkerClusterer({
      map: mapInstanceRef.current,
      markers,
    });

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
    };
  }, [isLoaded, posts, onPinClick]);

  if (loadError) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-600">
        Map unavailable. Switch to list view to see all listings.
      </div>
    );
  }

  if (posts.length === 0 && isLoaded) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-center text-sm text-gray-600">
        No housing listings with verified addresses yet.
        <br />
        Switch to list view to see all listings.
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-[600px] w-full overflow-hidden rounded-md border border-gray-200"
      aria-label="Map of housing listings"
    />
  );
}
