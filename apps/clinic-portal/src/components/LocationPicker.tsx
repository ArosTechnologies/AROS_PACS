import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

interface LocationPickerProps {
  address: string;
  latitude: number | null;
  longitude: number | null;
  primaryColor?: string;
  onChange: (data: { address: string; latitude: number; longitude: number }) => void;
}

// Controller to smoothly pan map when coordinates change externally
function MapPanController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

// Map Click Listener component
function MapClickEvents({ onLocationSelected }: { onLocationSelected: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelected(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({
  address,
  latitude,
  longitude,
  primaryColor = '#0284c7',
  onChange,
}: LocationPickerProps) {
  const defaultLat = latitude || 19.4184;
  const defaultLng = longitude || -99.1643;

  const [currentCoords, setCurrentCoords] = useState<[number, number]>([defaultLat, defaultLng]);
  const [searchQuery, setSearchQuery] = useState(address);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync coords if props change externally
  useEffect(() => {
    if (latitude && longitude && (latitude !== currentCoords[0] || longitude !== currentCoords[1])) {
      setCurrentCoords([latitude, longitude]);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    setSearchQuery(address);
  }, [address]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Custom AROS Marker Icon with dynamic clinic theme color
  const arosPinIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-aros-location-pin',
      html: `
        <div class="relative w-10 h-10 -translate-x-1/2 -translate-y-full cursor-grab active:cursor-grabbing group">
          <div class="w-10 h-10 flex items-center justify-center text-white shadow-xl border-2 border-white transition-transform group-hover:scale-110" style="background-color: ${primaryColor};">
            <span class="material-symbols-outlined text-2xl font-bold" style="font-variation-settings: 'FILL' 1;">location_on</span>
          </div>
          <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r-2 border-b-2 border-white" style="background-color: ${primaryColor};"></div>
          <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-black/30 rounded-full blur-[1px]"></div>
        </div>
      `,
      iconSize: [40, 48],
      iconAnchor: [20, 48],
      popupAnchor: [0, -48],
    });
  }, [primaryColor]);

  // Open-Source Autocomplete Search (OpenStreetMap Nominatim API)
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&addressdetails=1&limit=6&countrycodes=mx,us,es,co,ar,cl`;
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch (err) {
        console.error('Error fetching address suggestions:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  // User selects an address from the autocomplete suggestions
  const handleSelectSuggestion = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const formattedAddress = item.display_name;

    setCurrentCoords([lat, lon]);
    setSearchQuery(formattedAddress);
    setShowDropdown(false);
    setSuggestions([]);

    onChange({
      address: formattedAddress,
      latitude: lat,
      longitude: lon,
    });
  };

  // Reverse Geocoding when Pin is Dragged or Map is Clicked
  const handleCoordsSelected = async (lat: number, lng: number) => {
    setCurrentCoords([lat, lng]);
    setIsReverseGeocoding(true);

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const resolvedAddress = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSearchQuery(resolvedAddress);
        onChange({
          address: resolvedAddress,
          latitude: lat,
          longitude: lng,
        });
      } else {
        onChange({
          address: searchQuery || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          latitude: lat,
          longitude: lng,
        });
      }
    } catch (err) {
      console.error('Error reverse geocoding:', err);
      onChange({
        address: searchQuery || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        latitude: lat,
        longitude: lng,
      });
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // GPS My Location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización GPS.');
      return;
    }

    setIsGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGeolocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        handleCoordsSelected(lat, lng);
      },
      (err) => {
        setIsGeolocating(false);
        alert('No se pudo obtener la ubicación GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="flex flex-col gap-3 w-full" ref={containerRef}>
      {/* Search Input with Autocomplete Dropdown */}
      <div className="relative w-full">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              required
              value={searchQuery}
              onChange={handleSearchInputChange}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              placeholder="Escribe una calle, colonia, código postal o nombre de edificio..."
              className="h-11 w-full border border-slate-300 pl-10 pr-10 bg-white text-slate-900 focus:bg-white focus:border-[var(--color-clinic-accent)] focus:ring-1 focus:ring-[var(--color-clinic-accent)] outline-none text-sm font-medium transition-all shadow-sm"
            />
            {isSearching ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="material-symbols-outlined animate-spin text-slate-400 text-lg">progress_activity</span>
              </div>
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setShowDropdown(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Limpiar búsqueda"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isGeolocating}
            className="h-11 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-sm transition-colors cursor-pointer"
            title="Usar mi ubicación GPS actual"
          >
            <span className={`material-symbols-outlined text-base ${isGeolocating ? 'animate-spin' : 'text-accent'}`}>
              {isGeolocating ? 'progress_activity' : 'my_location'}
            </span>
            <span className="hidden sm:inline">Mi Ubicación GPS</span>
          </button>
        </div>

        {/* Autocomplete Dropdown List */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 shadow-2xl z-[1001] max-h-64 overflow-y-auto divide-y divide-slate-100">
            {suggestions.map((item, idx) => {
              const parts = item.display_name.split(',');
              const mainTitle = parts[0];
              const subtitle = parts.slice(1).join(',').trim();

              return (
                <div
                  key={item.place_id || idx}
                  onClick={() => handleSelectSuggestion(item)}
                  className="p-3 hover:bg-slate-50 cursor-pointer flex items-start gap-2.5 transition-colors group"
                >
                  <span className="material-symbols-outlined text-accent text-lg shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    location_on
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{mainTitle}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{subtitle}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono self-center shrink-0">
                    {item.type || 'Lugar'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Leaflet Mini-Map with Pin Location Picker */}
      <div className="relative w-full h-64 border border-slate-300 bg-slate-100 overflow-hidden shadow-inner">
        <MapContainer
          center={currentCoords}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapPanController center={currentCoords} />
          <MapClickEvents onLocationSelected={handleCoordsSelected} />
          <Marker
            position={currentCoords}
            icon={arosPinIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                handleCoordsSelected(pos.lat, pos.lng);
              },
            }}
          />
        </MapContainer>

        {/* Map Overlay Instructions & Status */}
        <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2.5 py-1 border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-sm flex items-center gap-1.5 z-[1000] pointer-events-none">
          <span className="material-symbols-outlined text-xs text-accent">touch_app</span>
          <span>Haz clic en el mapa o arrastra el pin para ajustar la entrada</span>
        </div>

        {isReverseGeocoding && (
          <div className="absolute bottom-2 left-2 bg-slate-900/90 text-white px-3 py-1 text-xs font-bold flex items-center gap-2 shadow-lg z-[1000]">
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            <span>Obteniendo dirección exacta...</span>
          </div>
        )}
      </div>

      {/* Map status */}
      <div className="flex flex-wrap items-center justify-end gap-2 p-1 text-xs">
        <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
          <span className="material-symbols-outlined text-xs font-bold">check_circle</span>
          Ubicación Guardada
        </span>
      </div>
    </div>
  );
}
