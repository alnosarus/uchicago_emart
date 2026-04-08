"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type GoogleMapsContextValue = {
  isLoaded: boolean;
  loadError: Error | null;
};

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: null,
});

let loaderPromise: Promise<typeof google> | null = null;

function getLoaderPromise(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not configured"),
    );
  }

  const loader = new Loader({
    apiKey,
    version: "weekly",
    libraries: ["places", "marker"],
  });

  loaderPromise = loader.load();
  return loaderPromise;
}

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLoaderPromise()
      .then(() => {
        if (!cancelled) setIsLoaded(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err as Error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps(): GoogleMapsContextValue {
  return useContext(GoogleMapsContext);
}
