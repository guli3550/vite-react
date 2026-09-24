import { useEffect, useState, useRef, type TouchEvent, type FC } from "react";

export interface Product {
  id: number;
  product_code?: string;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  image: string;
  images?: string[];
  description: string;
  sizes: string[];
  colors: string[];
  rating: number;
  reviews: number;
  stock: number;
  featured?: boolean;
  active?: boolean;
  sort_order?: number;
  discount?: number;
}

interface GalleryProps {
  product: Product;
  detail?: boolean;
  onOpen?: () => void;
}

const placeholder = (name = "GULI") =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#f6e8eb"/><text x="400" y="500" text-anchor="middle" font-family="Arial" font-size="42" fill="#b95a70">${name.slice(
      0,
      18
    )}</text></svg>`
  )}`;

const formatImageUrl = (url: string) => {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("images.unsplash.com")) {
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      u.searchParams.set("w", "900");
      u.searchParams.set("q", "78");
    }
    return u.toString();
  } catch {
    return url;
  }
};

const getResponsiveSources = (url: string) => {
  if (!url) return null;
  const match = url.match(/^(.*)-(400|800|1600)\.webp(?:([?#].*))?$/i);
  if (!match) return null;
  const [, base, , suffix = ""] = match;
  return {
    srcSet: [400, 800, 1600].map((width) => `${base}-${width}.webp${suffix} ${width}w`).join(", "),
    sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
  };
};

export const ProductImageGallery: FC<GalleryProps> = ({ product, detail = false, onOpen }) => {
  const [index, setIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const preloadedImagesRef = useRef<Set<string>>(new Set());

  // Extract all available valid images
  const rawList = [product.image, ...(product.images || [])].filter(Boolean);
  const imageList = rawList.length > 0 ? Array.from(new Set(rawList)) : [];

  // Detail sahifasi ochilishi bilan butun galereyani oldindan yuklaymiz.
  // Keyingi rasmga o'tishda tarmoq kutishidan keladigan uzilishlar shu bilan yo'qoladi.
  useEffect(() => {
    if (!detail || imageList.length <= 1) return;

    imageList.forEach((url) => {
      const normalized = formatImageUrl(url);
      if (!normalized || preloadedImagesRef.current.has(normalized)) return;

      const image = new Image();
      image.decoding = "async";
      image.onload = () => preloadedImagesRef.current.add(normalized);
      image.onerror = () => {};
      image.src = normalized;
    });
  }, [detail, imageList]);

  useEffect(() => {
    setImgError(false);
  }, [index]);

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const didSwipe = useRef<boolean>(false);

  const prevImage = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (imageList.length <= 1 || isAnimating) return;
    setIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
    setDragX(0);
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}
  };

  const nextImage = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (imageList.length <= 1 || isAnimating) return;
    setIndex((prev) => (prev + 1) % imageList.length);
    setDragX(0);
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    // Stop propagation so global tab swipe doesn't trigger
    e.stopPropagation();
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isDragging.current = true;
    didSwipe.current = false;
    setDragX(0);
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
      e.stopPropagation();
      didSwipe.current = true;
      setDragX(diffX);
    }
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    e.stopPropagation();

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartX.current;
    const diffY = endY - touchStartY.current;
    const timeTaken = Date.now() - touchStartTime.current;

    // Minimum swipe displacement
    const velocity = Math.abs(diffX) / Math.max(timeTaken, 1);
    const shouldSwipe = Math.abs(diffX) >= 45 && Math.abs(diffX) > Math.abs(diffY) * 1.15 && (timeTaken < 800 || velocity > 0.35);
    if (shouldSwipe && !isAnimating) {
      setIsAnimating(true);
      setDragX(diffX < 0 ? -window.innerWidth : window.innerWidth);
      window.setTimeout(() => {
        setIndex((prev) => diffX < 0 ? (prev + 1) % imageList.length : (prev - 1 + imageList.length) % imageList.length);
        setDragX(0);
        setIsAnimating(false);
      }, 220);
    } else {
      setDragX(0);
      if (!didSwipe.current && Math.abs(diffX) < 10 && Math.abs(diffY) < 10 && onOpen && !detail) onOpen();
    }
  };

  const currentUrl = imageList[index] ? formatImageUrl(imageList[index]) : placeholder(product.name);
  const responsive = currentUrl ? getResponsiveSources(currentUrl) : null;

  return (
    <div
      className={`productGallerySwipe ${detail ? "detailGallery" : "cardGallery"}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="galleryImageContainer">
        <div
          className="gallerySwipeTrack"
          style={{
            transform: `translateX(calc(-100% + ${dragX}px))`,
            transition: isAnimating ? "transform 220ms cubic-bezier(.22,.61,.36,1)" : "none",
          }}
        >
          {[
            imageList.length > 1 ? imageList[(index - 1 + imageList.length) % imageList.length] : imageList[index],
            imageList[index],
            imageList.length > 1 ? imageList[(index + 1) % imageList.length] : imageList[index],
          ].map((url, slot) => {
            const normalized = formatImageUrl(url || "");
            return (
              <img
                key={`${index}-${slot}-${url}`}
                src={normalized || placeholder(product.name)}
                alt={`${product.name} - rasm ${index + 1}`}
                loading="eager"
                decoding="async"
                draggable={false}
                onError={() => slot === 1 && setImgError(true)}
                className="galleryMainImg gallerySwipeSlide"
              />
            );
          })}
        </div>

        {/* Multiple images indicator & dots */}
        {imageList.length > 1 && (
          <>
            {/* Left & Right quick buttons in detail view */}
            {detail && (
              <>
                <button
                  type="button"
                  className="galleryArrowBtn left"
                  onClick={prevImage}
                  aria-label="Oldingi rasm"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="galleryArrowBtn right"
                  onClick={nextImage}
                  aria-label="Keyingi rasm"
                >
                  ›
                </button>
              </>
            )}



            {/* Counter badge (e.g. 1/3) in detail view */}
            {detail && (
              <div className="galleryCounter">
                {index + 1} / {imageList.length}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
