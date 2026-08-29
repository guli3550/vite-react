import { useEffect, useState, useMemo, type FC } from "react";
import type { Product } from "./ProductImageGallery";

export interface CategoryInfo {
  name: string;
  icon?: string;
}

export const FIXED_CATEGORIES = [
  "Penyuar",
  "Pijama",
  "Bezgalter",
  "Mayka",
  "Tursik",
  "Komplektlar",
  "Sexy ledy"
] as const;

export function getSynchronizedCategories(products: Product[]): CategoryInfo[] {
  const baseCategories: CategoryInfo[] = [
    { name: "Barchasi" },
    ...FIXED_CATEGORIES.map(name => ({ name }))
  ];

  const seen = new Set(baseCategories.map(c => c.name));
  const dynamicCategories: CategoryInfo[] = [...baseCategories];

  products.forEach(p => {
    if (p.category && !seen.has(p.category)) {
      seen.add(p.category);
      dynamicCategories.push({
        name: p.category
      });
    }
  });

  return dynamicCategories;
}

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
    return products.filter(p => p.category === category.name);
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
        // Asosiy rasm
        items.push({
          product: p,
          imageUrl: pImages[0],
          title: p.name,
          price: p.price,
          oldPrice: p.oldPrice,
          discount: p.discount,
          isNew: pIdx < 2 || Boolean(p.featured)
        });
        // Agar qo'shimcha rasmlar bo'lsa
        if (pImages.length > 1) {
          items.push({
            product: p,
            imageUrl: pImages[1],
            title: p.name,
            price: p.price,
            oldPrice: p.oldPrice,
            discount: p.discount,
            isNew: Boolean(p.featured)
          });
        }
      }
    });

    return items;
  }, [categoryProducts]);

  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (rotatingItems.length <= 1) return;

    // Har bir karta bir xil vaqtda emas, ketma-ket (staggered) o'zgarishi uchun
    const intervalDuration = 3400 + (index % 3) * 600;

    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setActiveItemIndex(prev => (prev + 1) % rotatingItems.length);
        setIsFading(false);
      }, 280);
    }, intervalDuration);

    return () => clearInterval(timer);
  }, [rotatingItems.length, index]);

  const currentItem = rotatingItems[activeItemIndex] || null;
  const count = categoryProducts.length;

  const handleClickCard = () => {
    if (currentItem?.product) {
      onOpenProduct(currentItem.product);
    } else {
      onSelect(category.name);
    }
  };

  const handleCategoryBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(category.name);
  };

  return (
    <div
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
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="catCardFallback">
            <span className="catFallbackIcon" style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", display: "inline-grid", placeItems: "center" }}>
              <img src="/guli_logo.jpg" alt="Guli Premium" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </span>
          </div>
        )}
        <div className="catCardOverlay" />
      </div>

      {/* Top Header Badge */}
      <div className="catCardTop">
        {count > 0 ? (
          <span
            className="catCountBadge"
            onClick={handleCategoryBadgeClick}
            title={`${category.name} toifasidagi barcha ${count} ta mahsulotni ko'rish`}
          >
            {count} xil ›
          </span>
        ) : (
          <span className="catCountBadge empty">Katalog ›</span>
        )}
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
