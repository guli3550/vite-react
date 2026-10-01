import { useEffect, useState, useMemo, useRef, type FC } from "react";
import type { Product } from "./ProductImageGallery";
import { type CategoryInfo, normalizeCategory } from "../utils/categoryUtils";
import { GULI_LOGO_BASE64 } from "../utils/guliLogoBase64";

export type { CategoryInfo };

interface RotatingCategoryCardProps {
  category: CategoryInfo;
  products: Product[];
  index: number;
  onSelect: (categoryName: string) => void;
  onOpenProduct: (product: Product) => void;
}

export const RotatingCategoryCard: FC<RotatingCategoryCardProps> = ({
  category,
  products,
  index,
  onSelect,
  onOpenProduct
}) => {
  // Ushbu kategoriyaga tegishli mahsulotlar
  const categoryProducts = useMemo(() => {
    const targetNorm = normalizeCategory(category.name);
    return products.filter(p => p.active !== false && normalizeCategory(p.category) === targetNorm);
  }, [products, category.name]);

  // Barcha rasmlar va tovarlar ro'yxati (har bir tovarning rasmlari bilan)
  const rotatingItems = useMemo(() => {
    if (!categoryProducts.length) return [];
    
    const items: Array<{
      product: Product;
      imageUrl: string;
      title: string;
      price: number;
      oldPrice?: number;
      discount?: number;
      isNew?: boolean;
    }> = [];

    categoryProducts.forEach((p, pIdx) => {
      const pImages = [p.image, ...(p.images || [])].filter(Boolean);
      if (pImages.length > 0) {
        // Har bir mahsulot kategoriya kartasida faqat o'zining asosiy
        // rasmini ko'rsatadi. Qo'shimcha galereya rasmlari keyingi mahsulot
        // o'rnini egallamasligi kerak: aylanish tartibi = mahsulot → mahsulot.
        items.push({
          product: p,
          imageUrl: pImages[0],
          title: p.name,
          price: p.price,
          oldPrice: p.oldPrice,
          discount: p.discount,
          isNew: pIdx < 2 || Boolean(p.featured)
        });
      }
    });

    return items;
  }, [categoryProducts]);

  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isCardVisible, setIsCardVisible] = useState(false);

  // Ko'rinmayotgan kategoriya kartalarida timer va rasm almashishini to'xtatamiz.
  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsCardVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setIsCardVisible(Boolean(entry?.isIntersecting));
    }, { rootMargin: "80px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isCardVisible || rotatingItems.length <= 1) return;
    const intervalDuration = 4200 + (index % 3) * 500;
    let fadeTimer: number | undefined;
    const timer = window.setInterval(() => {
      setIsFading(true);
      fadeTimer = window.setTimeout(() => {
        setActiveItemIndex(prev => (prev + 1) % rotatingItems.length);
        setIsFading(false);
      }, 220);
    }, intervalDuration);
    return () => {
      window.clearInterval(timer);
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
    };
  }, [isCardVisible, rotatingItems.length, index]);

  const currentItem = rotatingItems[activeItemIndex] || null;

  const handleClickCard = () => {
    if (currentItem?.product) {
      onOpenProduct(currentItem.product);
    } else {
      onSelect(category.name);
    }
  };

  return (
    <div
      ref={cardRef}
      className="rotatingCategoryCard"
      id={`cat-card-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
      role="button"
      tabIndex={0}
      onClick={handleClickCard}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          handleClickCard();
        }
      }}
      title={currentItem ? `${currentItem.title} mahsulotini ko'rish` : `${category.name} toifasidagi barcha mahsulotlarni ko'rish`}
    >
      {/* Background Image Slideshow */}
      <div className="catCardMedia">
        {currentItem?.imageUrl ? (
          <img
            key={currentItem.imageUrl + activeItemIndex}
            src={currentItem.imageUrl}
            alt={currentItem.title}
            className={`catCardImg ${isFading ? "fading" : ""}`}
            loading={isCardVisible ? "lazy" : "lazy"}
            decoding="async"
          />
        ) : (
          <div className="catCardFallback">
            <span className="catFallbackIcon guli-brand-circle-logo" style={{ width: 50, height: 50, borderRadius: "50%", overflow: "hidden", display: "inline-grid", placeItems: "center" }}>
              <img src={GULI_LOGO_BASE64} alt="Guli Premium" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </span>
          </div>
        )}
        <div className="catCardOverlay" />
      </div>

      {/* Rotating Live Product Info or Category Title */}
      <div className="catCardBottom">
        <h3 className="catTitle">{category.name}</h3>

        {currentItem ? (
          <div
            className={`catLiveProduct ${isFading ? "fading" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenProduct(currentItem.product);
            }}
            title={`${currentItem.title} tovar sahifasiga o'tish`}
          >
            <div className="catLiveProductHeader">
              <span className="catLivePulse" />
              <span className="catLiveName">{currentItem.title}</span>
            </div>
            <div className="catLivePriceRow">
              <span className="catLivePrice">
                {Math.round(currentItem.price).toLocaleString("uz-UZ")} so'm
              </span>
              {currentItem.discount ? (
                <span className="catLiveDiscount">-{currentItem.discount}%</span>
              ) : (
                <span className="catViewProductTag">Ko'rish ›</span>
              )}
            </div>
          </div>
        ) : (
          <span className="catExplorePrompt">To'plamni ko'rish →</span>
        )}
      </div>
    </div>
  );
};

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
  onViewAll
}) => {
  // "Barchasi" dan tashqari asosiy toifalar
  const displayCategories = useMemo(() => {
    return categories.filter(c => c.name !== "Barchasi");
  }, [categories]);

  return (
    <section className="section homeCategoriesSection" aria-label="Kategoriyalar">
      <div className="sectionTitle">
        <div>
          <span className="categorySectionEyebrow">MAHSULOT TOIFALARI</span>
          <h2>Kategoriyalar</h2>
        </div>
        <button
          className="sectionSeeAllBtn"
          onClick={onViewAll}
          id="see-all-categories-btn"
        >
          Barchasi →
        </button>
      </div>

      <div className="categoryScroll rotatingCategoryScroll">
        {displayCategories.map((cat, idx) => (
          <RotatingCategoryCard
            key={cat.name}
            category={cat}
            products={products}
            index={idx}
            onSelect={onSelectCategory}
            onOpenProduct={onOpenProduct}
          />
        ))}
      </div>
    </section>
  );
};
