import { memo, useEffect, useMemo, useRef, useState, type FC } from "react";
import type { Product } from "./ProductImageGallery";
import type { CategoryInfo } from "../utils/categoryUtils";
import {
  buildCategoryShowcaseMap,
  pickNextRotatableCategory,
  type CategoryShowcaseItem,
} from "../utils/categoryShowcase";
import { GULI_LOGO_BASE64 } from "../utils/guliLogoBase64";
import { resolvePublicMediaUrl } from "../utils/resolvePublicMediaUrl";
import "./RotatingCategorySection.css";

export type { CategoryInfo };

interface RotatingCategoryCardProps {
  category: CategoryInfo;
  items?: CategoryShowcaseItem[];
  products?: Product[];
  activeItemIndex?: number;
  isFading?: boolean;
  onSelect: (categoryName: string) => void;
  onOpenProduct: (product: Product) => void;
}

const RotatingCategoryCardBase: FC<RotatingCategoryCardProps> = ({
  category,
  items,
  products,
  activeItemIndex = 0,
  isFading = false,
  onSelect,
  onOpenProduct,
}) => {
  const resolvedItems = useMemo(() => {
    if (items) return items;
    if (!products?.length) return [];
    return buildCategoryShowcaseMap([category], products)[category.name] || [];
  }, [items, products, category]);

  const currentItem =
    resolvedItems.length > 0
      ? resolvedItems[activeItemIndex % resolvedItems.length] || resolvedItems[0]
      : null;

  const handleClickCard = () => {
    if (currentItem?.product) {
      onOpenProduct(currentItem.product);
    } else {
      onSelect(category.name);
    }
  };

  return (
    <button
      type="button"
      className="rotatingCategoryCard"
      id={`cat-card-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={handleClickCard}
      title={
        currentItem
          ? `${currentItem.title} mahsulotini ko'rish`
          : `${category.name} toifasidagi barcha mahsulotlarni ko'rish`
      }
    >
      <div className="catCardMedia">
        {currentItem?.imageUrl ? (
          <img
            src={resolvePublicMediaUrl(currentItem.imageUrl)}
            alt={currentItem.title}
            className={isFading ? "catCardImg fading" : "catCardImg"}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="catCardFallback">
            <span
              className="catFallbackIcon guli-brand-circle-logo"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                overflow: "hidden",
                display: "inline-grid",
                placeItems: "center",
              }}
            >
              <img
                src={GULI_LOGO_BASE64}
                alt="Guli Premium"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </span>
          </div>
        )}
        <div className="catCardOverlay" aria-hidden="true" />
        {currentItem?.discount && currentItem.discount > 0 ? (
          <span className="catLiveDiscount">-{currentItem.discount}%</span>
        ) : null}
      </div>

      <div className="catCardBottom">
        <h3 className="catTitle">{category.name}</h3>

        {currentItem ? (
          <div className={isFading ? "catLiveMeta fading" : "catLiveMeta"}>
            <span className="catLiveName">{currentItem.title}</span>
            <span className="catLivePriceRow">
              <span className="catLivePrice">
                {Math.round(currentItem.price).toLocaleString("uz-UZ")} so'm
              </span>
              <span className="catViewProductTag" aria-hidden="true">›</span>
            </span>
          </div>
        ) : (
          <span className="catExplorePrompt">To'plam ›</span>
        )}
      </div>
    </button>
  );
};

export const RotatingCategoryCard = memo(RotatingCategoryCardBase);

interface RotatingCategoriesSectionProps {
  categories: CategoryInfo[];
  products: Product[];
  onSelectCategory: (categoryName: string) => void;
  onOpenProduct: (product: Product) => void;
  onViewAll: () => void;
}

export const RotatingCategoriesSection: FC<RotatingCategoriesSectionProps> = ({
  categories,
  products,
  onSelectCategory,
  onOpenProduct,
  onViewAll,
}) => {
  const displayCategories = useMemo(
    () => categories.filter((c) => c.name !== "Barchasi"),
    [categories],
  );

  const showcaseMap = useMemo(
    () => buildCategoryShowcaseMap(displayCategories, products),
    [displayCategories, products],
  );

  const categoryNames = useMemo(
    () => displayCategories.map((c) => c.name),
    [displayCategories],
  );

  const [slotIndices, setSlotIndices] = useState<Record<string, number>>({});
  const [fadingCategory, setFadingCategory] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const rotationCursorRef = useRef(0);
  const [isSectionVisible, setIsSectionVisible] = useState(true);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsSectionVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSectionVisible(Boolean(entry?.isIntersecting));
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const hasRotatableCategories = useMemo(
    () => categoryNames.some((name) => (showcaseMap[name]?.length || 0) > 1),
    [categoryNames, showcaseMap],
  );

  useEffect(() => {
    if (!isSectionVisible || !isDocumentVisible || prefersReducedMotion || !hasRotatableCategories) {
      setFadingCategory(null);
      return;
    }

    let fadeTimer: number | undefined;
    const interval = window.setInterval(() => {
      const next = pickNextRotatableCategory(
        categoryNames,
        showcaseMap,
        rotationCursorRef.current,
      );
      if (!next) return;

      rotationCursorRef.current = next.nextCursor;
      const targetName = next.categoryName;
      const itemCount = showcaseMap[targetName]?.length || 0;
      if (itemCount <= 1) return;

      setFadingCategory(targetName);
      fadeTimer = window.setTimeout(() => {
        setSlotIndices((prev) => ({
          ...prev,
          [targetName]: ((prev[targetName] || 0) + 1) % itemCount,
        }));
        setFadingCategory((current) => (current === targetName ? null : current));
      }, 170);
    }, 2600);

    return () => {
      window.clearInterval(interval);
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
    };
  }, [
    isSectionVisible,
    isDocumentVisible,
    prefersReducedMotion,
    hasRotatableCategories,
    categoryNames,
    showcaseMap,
  ]);

  return (
    <section
      ref={sectionRef}
      className="section homeCategoriesSection"
      aria-label="Mahsulot toifalari"
    >
      <div className="homeCategoriesCompactAction">
        <span className="categorySectionEyebrow">KOLLEKSIYALAR</span>
        <button
          type="button"
          className="sectionSeeAllBtn"
          onClick={onViewAll}
          id="see-all-categories-btn"
        >
          Barchasi →
        </button>
      </div>

      <div className="categoryScroll rotatingCategoryScroll">
        {displayCategories.map((cat) => (
          <RotatingCategoryCard
            key={cat.name}
            category={cat}
            items={showcaseMap[cat.name] || []}
            activeItemIndex={slotIndices[cat.name] || 0}
            isFading={fadingCategory === cat.name}
            onSelect={onSelectCategory}
            onOpenProduct={onOpenProduct}
          />
        ))}
      </div>
    </section>
  );
};
