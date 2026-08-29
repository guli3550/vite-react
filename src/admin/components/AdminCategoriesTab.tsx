import { useState, useMemo } from "react";
import { EmptyState } from "./AdminUIComponents";
import { normalizeCategory } from "../../utils/categoryUtils";
import { DEFAULT_PRODUCTS } from "../../utils/defaultProducts";

export type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string;
  productCount: number;
  sortOrder: number;
  active: boolean;
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: "Penyuar", slug: "penyuar", icon: "🌸", productCount: 0, sortOrder: 1, active: true },
  { id: 2, name: "Pijama", slug: "pijama", icon: "🌙", productCount: 0, sortOrder: 2, active: true },
  { id: 3, name: "Byusgalter", slug: "byusgalter", icon: "👙", productCount: 0, sortOrder: 3, active: true },
  { id: 4, name: "Mayka", slug: "mayka", icon: "🎽", productCount: 0, sortOrder: 4, active: true },
  { id: 5, name: "Tursik", slug: "tursik", icon: "🩲", productCount: 0, sortOrder: 5, active: true },
];

export function AdminCategoriesTab({ notify }: { notify: (m: string) => void }) {
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem("guli_admin_categories");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  // Calculate live product counts for each category
  const categoriesWithLiveCounts = useMemo(() => {
    let allProds = DEFAULT_PRODUCTS;
    try {
      const savedProds = localStorage.getItem("guli_products");
      if (savedProds) {
        const parsed = JSON.parse(savedProds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allProds = parsed;
        }
      }
    } catch {}

    return categories.map((cat) => {
      const normalizedCatName = normalizeCategory(cat.name);
      const count = allProds.filter(
        (p) => normalizeCategory(p.category) === normalizedCatName
      ).length;
      return { ...cat, productCount: count };
    });
  }, [categories]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🌸");

  const saveToStorage = (cats: Category[]) => {
    setCategories(cats);
    try {
      localStorage.setItem("guli_admin_categories", JSON.stringify(cats));
    } catch {}
  };

  const handleOpenAdd = () => {
    setEditingCat(null);
    setName("");
    setIcon("🌸");
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Category) => {
    setEditingCat(c);
    setName(c.name);
    setIcon(c.icon);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCat) {
      const updated = categories.map((c) =>
        c.id === editingCat.id ? { ...c, name: name.trim(), icon } : c
      );
      saveToStorage(updated);
      notify("Kategoriya yangilandi ✓");
    } else {
      const newCat: Category = {
        id: Date.now(),
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/\s+/g, "-"),
        icon,
        productCount: 0,
        sortOrder: categories.length + 1,
        active: true,
      };
      saveToStorage([...categories, newCat]);
      notify("Yangi kategoriya qo‘shildi ✓");
    }
    setModalOpen(false);
  };

  const toggleActive = (id: number) => {
    const updated = categories.map((c) => (c.id === id ? { ...c, active: !c.active } : c));
    saveToStorage(updated);
    notify("Kategoriya holati o‘zgardi ✓");
  };

  return (
    <section className="proPanel tablePanel">
      <div className="panelHead">
        <div>
          <span className="proEyebrow">KATALOG TUZILMASI</span>
          <h2>Kategoriyalar ({categories.length})</h2>
        </div>
        <button type="button" className="proPrimary" onClick={handleOpenAdd}>
          + Kategoriya qo‘shish
        </button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon="🗂"
          title="Kategoriyalar mavjud emas"
          description="Yangi kategoriya yaratish uchun tugmani bosing"
          actionLabel="+ Kategoriya yaratish"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th>Ikonka</th>
                <th>Kategoriya nomi</th>
                <th>Slug</th>
                <th>Mahsulotlar</th>
                <th>Tartib</th>
                <th>Holat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categoriesWithLiveCounts.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    <span className="catIconDisplay">{cat.icon}</span>
                  </td>
                  <td>
                    <b>{cat.name}</b>
                  </td>
                  <td>
                    <span className="promoCode">{cat.slug}</span>
                  </td>
                  <td>
                    <b>{cat.productCount} ta mahsulot</b>
                  </td>
                  <td>#{cat.sortOrder}</td>
                  <td>
                    <span className={`pill ${cat.active ? "" : "mutedPill"}`}>
                      {cat.active ? "Faol" : "O‘chiq"}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" onClick={() => handleOpenEdit(cat)}>
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        className="dangerBtn"
                        onClick={() => toggleActive(cat.id)}
                      >
                        {cat.active ? "O‘chirish" : "Yoqish"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modalShade" onMouseDown={() => setModalOpen(false)}>
          <div className="proModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <span className="proEyebrow">KATEGORIYA</span>
                <h2>{editingCat ? "Kategoriyani tahrirlash" : "Yangi kategoriya"}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="formGrid">
                <label>
                  Ikonka (Emoji)
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="Masalan: 👙"
                    required
                  />
                </label>
                <label>
                  Kategoriya nomi
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Masalan: Bodi va Korse"
                    required
                  />
                </label>
              </div>
              <div className="modalActions">
                <button type="button" onClick={() => setModalOpen(false)}>
                  Bekor qilish
                </button>
                <button type="submit" className="proPrimary">
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
