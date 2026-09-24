import { useEffect, useState, type FormEvent } from "react";
import { EmptyState } from "./AdminUIComponents";
import { getApiBaseUrl } from "../../lib/apiOrigin";

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  productCount: number;
  sortOrder: number;
  active: boolean;
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: "pinyuar", name: "Penyuar", slug: "pinyuar", icon: "🌸", productCount: 0, sortOrder: 1, active: true },
  { id: "pijama", name: "Pijama", slug: "pijama", icon: "🌙", productCount: 0, sortOrder: 2, active: true },
  { id: "byustgalter", name: "Byusgalter", slug: "byustgalter", icon: "👙", productCount: 0, sortOrder: 3, active: true },
  { id: "mayka", name: "Mayka", slug: "mayka", icon: "🎽", productCount: 0, sortOrder: 4, active: true },
  { id: "tursik", name: "Tursik", slug: "tursik", icon: "🩲", productCount: 0, sortOrder: 5, active: true },
];

export function AdminCategoriesTab({ notify }: { notify: (m: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🌸");

  const adminRequest = async (path: string, options: RequestInit = {}) => {
    const token = sessionStorage.getItem("guli_admin_token") || "";
    const base = (sessionStorage.getItem("guli_custom_api_url") || getApiBaseUrl()).replace(/\/$/, "");
    const response = await fetch(base + path, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(options.headers || {}),
      },
    });
    const json = await response.json().catch(() => null);
    if (response.status === 401) throw new Error("Admin sessiyasi tugagan");
    if (!response.ok || json?.success === false) {
      throw new Error(json?.message || "Server xatosi");
    }
    return json;
  };

  const loadCategories = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const json = await adminRequest("/api/admin/categories");
      setCategories(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      if (!silent) {
        setCategories((current) => current.length ? current : DEFAULT_CATEGORIES);
        notify(error instanceof Error ? error.message : "Kategoriyalarni yuklashda xatolik");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
    const interval = window.setInterval(() => void loadCategories(true), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const handleOpenAdd = () => {
    setEditingCat(null);
    setName("");
    setIcon("🌸");
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Category) => {
    setEditingCat(c);
    setName(c.name);
    setIcon(c.icon || "🌸");
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    try {
      const body = JSON.stringify({
        name: cleanName,
        icon: icon.trim() || "🌸",
        active: editingCat ? editingCat.active : true,
        sortOrder: editingCat?.sortOrder,
      });
      if (editingCat) {
        await adminRequest("/api/admin/categories/" + encodeURIComponent(editingCat.slug), {
          method: "PUT",
          body,
        });
        notify("Kategoriya yangilandi ✓");
      } else {
        await adminRequest("/api/admin/categories", {
          method: "POST",
          body,
        });
        notify("Yangi kategoriya qo‘shildi ✓");
      }
      setModalOpen(false);
      await loadCategories(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Kategoriya saqlanmadi");
    }
  };

  const toggleActive = async (category: Category) => {
    try {
      await adminRequest("/api/admin/categories/" + encodeURIComponent(category.slug), {
        method: "PUT",
        body: JSON.stringify({
          name: category.name,
          icon: category.icon,
          sortOrder: category.sortOrder,
          active: !category.active,
        }),
      });
      await loadCategories(true);
      notify(category.active ? "Kategoriya o‘chirildi ✓" : "Kategoriya qayta yoqildi ✓");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Kategoriya holatini o‘zgartirib bo‘lmadi");
    }
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

      {loading ? (
        <div className="emptyAdmin">Kategoriyalar yuklanmoqda…</div>
      ) : categories.length === 0 ? (
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
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td><span className="catIconDisplay">{cat.icon}</span></td>
                  <td><b>{cat.name}</b></td>
                  <td><span className="promoCode">{cat.slug}</span></td>
                  <td><b>{cat.productCount} ta mahsulot</b></td>
                  <td>#{cat.sortOrder}</td>
                  <td>
                    <span className={"pill " + (cat.active ? "" : "mutedPill")}>
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
                        onClick={() => void toggleActive(cat)}
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
              <button type="button" onClick={() => setModalOpen(false)}>×</button>
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
