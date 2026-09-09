import React, { useState } from "react";
import { cn } from "../lib/utils.js";
import { MapPin } from "lucide-react";

function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  fallbackLocations = []
}) {
  const [activeFallbackLocation, setActiveFallbackLocation] = useState(null);
  const visibleFallbackLocations = fallbackLocations.length
    ? fallbackLocations
    : [{ id: "center", name: "Nova Pharm", ...initialCenter }];
  const latitudes = visibleFallbackLocations.map(location => location.lat);
  const longitudes = visibleFallbackLocations.map(location => location.lng);
  const latitudePadding = Math.max((Math.max(...latitudes) - Math.min(...latitudes)) * 0.35, 0.008);
  const longitudePadding = Math.max((Math.max(...longitudes) - Math.min(...longitudes)) * 0.35, 0.012);
  const minLat = Math.min(...latitudes) - latitudePadding;
  const maxLat = Math.max(...latitudes) + latitudePadding;
  const minLng = Math.min(...longitudes) - longitudePadding;
  const maxLng = Math.max(...longitudes) + longitudePadding;

  return (
    <div className={cn("relative w-full h-[500px] overflow-hidden rounded-3xl border bg-muted/30", className)}>
      <iframe
        title="Nova Pharm խանութների քարտեզ"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik`}
        className="w-full h-full border-0"
        loading="lazy"
      />
      <div className="absolute inset-0 pointer-events-none">
        {visibleFallbackLocations.map(location => {
          const left = ((location.lng - minLng) / (maxLng - minLng)) * 100;
          const top = (1 - (location.lat - minLat) / (maxLat - minLat)) * 100;
          return (
            <button
              key={location.id}
              type="button"
              title={location.name}
              aria-label={location.name}
              onClick={() => setActiveFallbackLocation(location)}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <MapPin className="h-4 w-4" />
            </button>
          );
        })}
      </div>
      {activeFallbackLocation ? (
        <div className="absolute right-4 top-4 max-w-[calc(100%-2rem)] rounded-xl bg-white/95 px-3 py-2 shadow-lg text-xs text-foreground">
          <p className="font-semibold">{activeFallbackLocation.name}</p>
          <p className="mt-0.5 text-muted-foreground">{activeFallbackLocation.address}</p>
        </div>
      ) : null}
      <div className="absolute left-4 bottom-4 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 shadow-lg text-xs font-medium text-foreground">
        <MapPin className="w-4 h-4 text-primary" />
        Գյումրիի Nova Pharm խանութների տարածք
      </div>
    </div>
  );
}

export { MapView };
