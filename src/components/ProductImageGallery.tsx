import { useState, useRef, type TouchEvent, type FC } from "react";

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

export const formatImageUrl = (url: string) => {
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

export const ProductImageGallery: FC<GalleryProps> = ({ product, detail = false, onOpen }) => {
  const [index, setIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  
  // Extract all available valid images
  const rawList = [product.image, ...(product.images || [])].filter(Boolean);
  const imageList = rawList.length > 0 ? Array.from(new Set(rawList)) : [];

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const didSwipe = useRef<boolean>(false);

  const prevImage = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (imageList.length <= 1) return;
    setIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}
  };

  const nextImage = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (imageList.length <= 1) return;
    setIndex((prev) => (prev + 1) % imageList.length);
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
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(diffX) > 15 && Math.abs(diffX) > Math.abs(diffY)) {
      e.stopPropagation();
      didSwipe.current = true;
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
    if (Math.abs(diffX) >= 30 && Math.abs(diffX) > Math.abs(diffY) && timeTaken < 650) {
      if (diffX < 0) {
        // Swiped left -> next image
        nextImage();
      } else {
        // Swiped right -> previous image
        prevImage();
      }
    } else if (!didSwipe.current && Math.abs(diffX) < 10 && Math.abs(diffY) < 10 && onOpen && !detail) {
      // Clean tap without drag: open product
      onOpen();
    }
  };

  const currentUrl = imageList[index] ? formatImageUrl(imageList[index]) : placeholder(product.name);

  return (
    <div
      className={`productGallerySwipe ${detail ? "detailGallery" : "cardGallery"}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="galleryImageContainer">
        <img
          src={!imgError && currentUrl ? currentUrl : placeholder(product.name)}
          alt={`${product.name} - rasm ${index + 1}`}
          loading={detail ? "eager" : "lazy"}
          decoding="async"
          onError={() => setImgError(true)}
          className="galleryMainImg"
        />

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

            {/* Pagination Dots */}
            <div className="galleryDots" onClick={(e) => e.stopPropagation()}>
              {imageList.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  className={`galleryDot ${i === index ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex(i);
                  }}
                  aria-label={`Rasm ${i + 1}`}
                />
              ))}
            </div>

            {/* Counter badge (e.g. 1/3) in detail view */}
            {detail && (
              <div className="galleryCounter">
                {index + 1} / {imageList.length}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail view thumbnail strip */}
      {detail && imageList.length > 1 && (
        <div className="galleryThumbnails" onClick={(e) => e.stopPropagation()}>
          {imageList.map((img, i) => (
            <button
              type="button"
              key={i}
              className={`galleryThumbBtn ${i === index ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
            >
              <img src={formatImageUrl(img)} alt={`Thumbnail ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
