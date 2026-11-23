import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Minus, Crosshair, X, MapPin, Loader2 } from "lucide-react";
import {
  formatResolvedAddressLine,
  searchUzbekistanAddresses,
  type AddressSearchCandidate,
} from "../utils/uzbekistanGeocoding";
import type { Language } from "../utils/translations";

declare global {
  interface Window {
    L?: any;
  }
}

export interface YandexCheckoutMapProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lon: number) => void;
  language?: Language;
  region?: string;
  district?: string;
  street?: string;
  house?: string;
  isResolving?: boolean;
  locationLoading?: boolean;
  onRequestLocation?: () => void;
  onSelectCandidate?: (candidate: AddressSearchCandidate) => void;
}

export const YandexCheckoutMap: React.FC<YandexCheckoutMapProps> = ({
  latitude,
  longitude,
  onChange,
  language = "uz",
  region = "",
  district = "",
  street = "",
  house = "",
  isResolving = false,
  locationLoading = false,
  onRequestLocation,
  onSelectCandidate,
}) => {
  const isRu = language === "ru";
  const isEn = language === "en";

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const lastCoordsRef = useRef<{ lat: number; lon: number }>({
    lat: latitude || 41.2995,
    lon: longitude || 69.2401,
  });
  const programmaticMoveRef = useRef(false);
  const moveDebounceRef = useRef<number | null>(null);

  const [leafletReady, setLeafletReady] = useState(Boolean(typeof window !== "undefined" && window.L));
  const [isDragging, setIsDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AddressSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Load Leaflet CSS/JS once cleanly
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.L) {
      setLeafletReady(true);
      return;
    }

    let existingCss = document.querySelector<HTMLLinkElement>('link[data-guli-leaflet="css"]');
    if (!existingCss) {
      existingCss = document.createElement("link");
      existingCss.rel = "stylesheet";
      existingCss.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      existingCss.setAttribute("data-guli-leaflet", "css");
      document.head.appendChild(existingCss);
    }

    let existingScript = document.querySelector<HTMLScriptElement>('script[data-guli-leaflet="js"]');
    const onLoad = () => setLeafletReady(true);

    if (!existingScript) {
      existingScript = document.createElement("script");
      existingScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      existingScript.async = true;
      existingScript.setAttribute("data-guli-leaflet", "js");
      existingScript.addEventListener("load", onLoad);
      document.body.appendChild(existingScript);
    } else {
      existingScript.addEventListener("load", onLoad);
      if (window.L) setLeafletReady(true);
    }

    return () => {
      existingScript?.removeEventListener("load", onLoad);
    };
  }, []);

  // Initialize Leaflet map with Yandex-style fixed center pin & Carto Voyager / OSM fallback
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || !window.L) return;
    const L = window.L;
    const initLat = lastCoordsRef.current.lat || 41.2995;
    const initLon = lastCoordsRef.current.lon || 69.2401;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([initLat, initLon], 17);

      const primaryLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        },
      );

      let fallbackApplied = false;
      primaryLayer.on("tileerror", () => {
        if (fallbackApplied || !mapInstanceRef.current) return;
        fallbackApplied = true;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);
      });

      primaryLayer.addTo(map);

      map.on("movestart", () => {
        if (programmaticMoveRef.current) return;
        setIsDragging(true);
      });

      map.on("moveend", () => {
        setIsDragging(false);
        if (programmaticMoveRef.current) {
          programmaticMoveRef.current = false;
          return;
        }
        const center = map.getCenter();
        if (!center) return;
        const nextLat = Number(center.lat.toFixed(6));
        const nextLon = Number(center.lng.toFixed(6));

        const deltaLat = Math.abs(nextLat - lastCoordsRef.current.lat);
        const deltaLon = Math.abs(nextLon - lastCoordsRef.current.lon);
        if (deltaLat < 0.000015 && deltaLon < 0.000015) return;

        lastCoordsRef.current = { lat: nextLat, lon: nextLon };
        if (moveDebounceRef.current) {
          window.clearTimeout(moveDebounceRef.current);
        }
        moveDebounceRef.current = window.setTimeout(() => {
          onChangeRef.current(nextLat, nextLon);
        }, 240);
      });

      map.on("click", (e: any) => {
        if (!e?.latlng) return;
        setSearchOpen(false);
        map.panTo(e.latlng, { animate: true, duration: 0.32 });
      });

      mapInstanceRef.current = map;
      window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {}
      }, 120);
    }

    return () => {
      if (moveDebounceRef.current) {
        window.clearTimeout(moveDebounceRef.current);
      }
    };
  }, [leafletReady]);

  // Destroy map cleanly on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync external lat/lon updates (GPS detect or search select) to map center
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !latitude || !longitude) return;
    const deltaLat = Math.abs(latitude - lastCoordsRef.current.lat);
    const deltaLon = Math.abs(longitude - lastCoordsRef.current.lon);
    if (deltaLat < 0.00002 && deltaLon < 0.00002) return;

    lastCoordsRef.current = { lat: latitude, lon: longitude };
    programmaticMoveRef.current = true;
    try {
      const currentZoom = map.getZoom?.() || 17;
      map.setView([latitude, longitude], Math.max(currentZoom, 17), { animate: true });
    } catch {}
  }, [latitude, longitude]);

  // Debounced Yandex-style inline address search
  useEffect(() => {
    const clean = searchQuery.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const list = await searchUzbekistanAddresses(
          clean,
          lastCoordsRef.current.lat,
          lastCoordsRef.current.lon,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setSearchResults(list);
          setSearchOpen(true);
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError" && !controller.signal.aborted) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 360);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const resolvedLine = useMemo(() => {
    const line = formatResolvedAddressLine({ region, district, street, house });
    if (line) return line;
    return isRu
      ? "Переместите карту или выберите точку"
      : isEn
      ? "Drag the map or tap a location"
      : "Xaritani suring yoki manzilni bosing";
  }, [region, district, street, house, isRu, isEn]);

  const handleSelectSuggestion = (item: AddressSearchCandidate) => {
    setSearchOpen(false);
    setSearchQuery(item.title);
    lastCoordsRef.current = { lat: item.latitude, lon: item.longitude };
    if (mapInstanceRef.current) {
      programmaticMoveRef.current = true;
      mapInstanceRef.current.setView([item.latitude, item.longitude], 17, { animate: true });
    }
    if (onSelectCandidate) {
      onSelectCandidate(item);
    } else {
      onChangeRef.current(item.latitude, item.longitude);
    }
  };

  return (
    <div className="yandexMapCard" data-testid="yandex-checkout-map">
      {/* Yandex-style Live Address Header + Search */}
      <div className="yandexMapHeader">
        <div className="yandexAddressBanner">
          <span className="yandexPinBadgeIcon" aria-hidden="true">
            {isResolving || locationLoading ? (
              <Loader2 size={16} className="yandexSpin" />
            ) : (
              <MapPin size={16} />
            )}
          </span>
          <div className="yandexAddressTextCol">
            <span className="yandexAddressEyebrow">
              {isResolving || locationLoading
                ? isRu
                  ? "Определяем точный адрес..."
                  : isEn
                  ? "Resolving exact address..."
                  : "Aniq manzil aniqlanmoqda..."
                : isRu
                ? "Выбранный адрес на карте"
                : isEn
                ? "Selected map address"
                : "Xaritadagi tanlangan manzil"}
            </span>
            <strong className="yandexAddressValue">{resolvedLine}</strong>
          </div>
        </div>

        {/* Inline Address Search Box */}
        <div className="yandexSearchWrapper">
          <div className="yandexSearchInputBox">
            <Search size={15} className="yandexSearchLeadIcon" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => {
                if (searchResults.length > 0) setSearchOpen(true);
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isRu
                  ? "Поиск улицы, дома или ориентира..."
                  : isEn
                  ? "Search street, building or landmark..."
                  : "Ko‘cha, uy yoki mo‘ljalni qidiring..."
              }
              aria-label={isRu ? "Поиск адреса" : isEn ? "Search address" : "Manzilni qidirish"}
            />
            {searching && <Loader2 size={14} className="yandexSpin yandexSearchStatusIcon" />}
            {searchQuery && (
              <button
                type="button"
                className="yandexSearchClearBtn"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchOpen(false);
                }}
                aria-label="Tozalash"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <div className="yandexSearchDropdown" role="listbox">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="yandexSearchOption"
                  onClick={() => handleSelectSuggestion(item)}
                >
                  <MapPin size={15} className="yandexOptionIcon" />
                  <div className="yandexOptionText">
                    <b>{item.title}</b>
                    <span>{item.subtitle}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Map Stage */}
      <div className="yandexMapStage">
        <div ref={mapContainerRef} className="yandexLeafletCanvas" />

        {!leafletReady && (
          <div className="yandexMapLoadingOverlay">
            <Loader2 size={22} className="yandexSpin" />
            <span>{isRu ? "Загрузка карты..." : isEn ? "Loading map..." : "Xarita yuklanmoqda..."}</span>
          </div>
        )}

        {/* Fixed Center Yandex Go Teardrop Pin */}
        <div className={`yandexCenterPinWrap ${isDragging ? "isLifted" : ""}`} aria-hidden="true">
          <div className="yandexCenterTooltip">
            {isDragging
              ? isRu
                ? "Отпустите точку"
                : isEn
                ? "Drop pin here"
                : "Shu yerga qo‘ying"
              : isResolving || locationLoading
              ? isRu
                ? "Поиск адреса..."
                : isEn
                ? "Finding address..."
                : "Aniqlanmoqda..."
              : street
              ? `${street}${house ? `, ${house}` : ""}`
              : district || (isRu ? "Точка доставки" : isEn ? "Delivery point" : "Yetkazish nuqtasi")}
          </div>
          <div className="yandexPinMarker">
            <span className="yandexPinCore" />
          </div>
          <div className="yandexPinShadow" />
        </div>

        {/* Floating Right Controls (+ / - / My Location) */}
        <div className="yandexMapControls">
          <button
            type="button"
            className="yandexCtrlBtn"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            title={isRu ? "Приблизить" : isEn ? "Zoom in" : "Yaqinlashtirish"}
            aria-label="Zoom in"
          >
            <Plus size={17} />
          </button>
          <button
            type="button"
            className="yandexCtrlBtn"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            title={isRu ? "Отдалить" : isEn ? "Zoom out" : "Uzoqlashtirish"}
            aria-label="Zoom out"
          >
            <Minus size={17} />
          </button>
          {onRequestLocation && (
            <button
              type="button"
              className={`yandexCtrlBtn yandexLocateBtn ${locationLoading ? "isBusy" : ""}`}
              onClick={onRequestLocation}
              disabled={locationLoading}
              title={isRu ? "Моё местоположение" : isEn ? "My location" : "Joylashuvimni aniqlash"}
              aria-label="Detect current location"
            >
              {locationLoading ? <Loader2 size={17} className="yandexSpin" /> : <Crosshair size={17} />}
            </button>
          )}
        </div>
      </div>

      {/* Concise Hint Footer */}
      <div className="yandexMapFooter">
        <span>
          {isRu
            ? "Нажмите на нужное здание или перетащите карту — адрес заполнится автоматически."
            : isEn
            ? "Tap your exact building or drag the map — the address fields below update automatically."
            : "Aniq uyingiz ustiga bosing yoki xaritani suring — viloyat, tuman, ko‘cha va uy avtomatik yangilanadi."}
        </span>
      </div>
    </div>
  );
};

export default YandexCheckoutMap;
