"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { DashboardData, VisionItem } from "@/types/dashboard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

const CATEGORIES = [
  "Med School",
  "Tennis",
  "Travel",
  "Family",
  "Skincare",
  "Home",
  "Personal Growth",
  "Other",
];

export function VisionView({ data, update }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<VisionItem | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [tab, setTab] = useState<"url" | "upload">("url");

  // Form state
  const [urlInput, setUrlInput] = useState("");
  const [urlValid, setUrlValid] = useState<boolean | null>(null);
  const [urlChecking, setUrlChecking] = useState(false);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("Other");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = data.visionBoard?.items ?? [];
  const usedCategories = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean) as string[])
  );
  const filterPills = ["All", ...usedCategories];
  const filtered =
    activeCategory === "All"
      ? items
      : items.filter((i) => i.category === activeCategory);

  const validateUrl = useCallback((url: string) => {
    if (!url.trim()) { setUrlValid(null); return; }
    setUrlChecking(true);
    const img = new Image();
    img.onload = () => { setUrlValid(true); setUrlChecking(false); };
    img.onerror = () => { setUrlValid(false); setUrlChecking(false); };
    img.src = url;
  }, []);

  // Debounced URL validation as user types
  useEffect(() => {
    if (urlTimer.current) clearTimeout(urlTimer.current);
    if (!urlInput.trim()) { setUrlValid(null); return; }
    setUrlValid(null);
    urlTimer.current = setTimeout(() => validateUrl(urlInput), 600);
    return () => { if (urlTimer.current) clearTimeout(urlTimer.current); };
  }, [urlInput, validateUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === "url") {
        if (!urlInput.trim() || !urlValid) return;
        const item: VisionItem = {
          id: id(),
          type: "url",
          src: urlInput.trim(),
          caption: caption.trim() || undefined,
          category: category || undefined,
          addedAt: new Date().toISOString(),
        };
        update((d) => ({
          ...d,
          visionBoard: { items: [...(d.visionBoard?.items ?? []), item] },
        }));
      } else {
        if (!uploadFile) return;
        const form = new FormData();
        form.append("file", uploadFile);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const { url: blobUrl } = await res.json();
        const item: VisionItem = {
          id: id(),
          type: "upload",
          src: blobUrl,
          caption: caption.trim() || undefined,
          category: category || undefined,
          addedAt: new Date().toISOString(),
        };
        update((d) => ({
          ...d,
          visionBoard: { items: [...(d.visionBoard?.items ?? []), item] },
        }));
      }
      resetForm();
      setAddOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setUrlInput("");
    setUrlValid(null);
    setCaption("");
    setCategory("Other");
    setUploadFile(null);
    setUploadPreview(null);
    setTab("url");
  };

  const deleteItem = (itemId: string) => {
    update((d) => ({
      ...d,
      visionBoard: {
        items: (d.visionBoard?.items ?? []).filter((i) => i.id !== itemId),
      },
    }));
  };

  const canSave =
    tab === "url" ? urlValid === true : uploadFile !== null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-brown">Vision Board</h1>
          <p className="text-sand-dark mt-1 italic text-sm">
            What I&apos;m building toward.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="flex-shrink-0">
          <Plus size={14} className="mr-1.5 inline" /> Add to board
        </Button>
      </div>

      {/* Category filter pills */}
      {items.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {filterPills.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "bg-terracotta text-white shadow-soft"
                  : "bg-cream-darker text-brown hover:bg-sand/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Masonry grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center space-y-4">
          <p className="font-serif text-3xl text-sand">Your vision is waiting.</p>
          <p className="text-sand-dark text-sm max-w-xs">
            Add your first image to start building your board.
          </p>
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-1.5 inline" /> Add to board
          </Button>
        </div>
      ) : (
        <div className="masonry-grid">
          {filtered.map((item) => (
            <MasonryCard
              key={item.id}
              item={item}
              onDelete={deleteItem}
              onClick={() => setLightboxItem(item)}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(50,32,26,0.82)", backdropFilter: "blur(10px)" }}
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative flex flex-col items-center gap-4 max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxItem(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxItem.src}
              alt={lightboxItem.caption ?? "Vision board image"}
              className="rounded-2xl max-h-[78vh] w-auto object-contain"
              style={{ maxWidth: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}
            />
            <div className="text-center space-y-1.5">
              {lightboxItem.caption && (
                <p className="font-serif text-lg text-white/90 italic">
                  {lightboxItem.caption}
                </p>
              )}
              {lightboxItem.category && (
                <span className="inline-block text-xs text-white/50 bg-white/10 px-3 py-1 rounded-full">
                  {lightboxItem.category}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add to Board Modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); resetForm(); }}
        title="Add to Board"
        width="max-w-lg"
      >
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-cream-darker rounded-xl mb-5 w-fit">
          {(["url", "upload"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t
                  ? "bg-white text-brown shadow-soft"
                  : "text-sand-dark hover:text-brown"
              }`}
            >
              {t === "url" ? "Paste image URL" : "Upload from device"}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {tab === "url" ? (
            <>
              <div>
                <label className="text-xs font-medium text-brown block mb-1">
                  Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                {urlChecking && (
                  <p className="text-xs text-sand-dark mt-1">Checking…</p>
                )}
                {urlValid === false && (
                  <p className="text-xs text-rose mt-1">
                    That URL didn&apos;t load as an image. Try right-clicking an image
                    and copying its direct URL.
                  </p>
                )}
              </div>
              {urlValid === true && urlInput && (
                <div className="rounded-xl overflow-hidden bg-cream-darker">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlInput}
                    alt="Preview"
                    className="w-full max-h-52 object-cover"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  uploadPreview
                    ? "border-terracotta/40"
                    : "border-sand hover:border-terracotta"
                }`}
              >
                {uploadPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    className="max-h-44 mx-auto rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <p className="text-sand-dark text-sm">
                      Click to choose a file
                    </p>
                    <p className="text-xs text-sand mt-1">JPG, PNG, or WEBP</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              {uploadPreview && (
                <button
                  onClick={() => { setUploadFile(null); setUploadPreview(null); }}
                  className="text-xs text-sand-dark hover:text-terracotta transition-colors"
                >
                  Choose a different file
                </button>
              )}
            </>
          )}

          <div>
            <label className="text-xs font-medium text-brown block mb-1">
              Caption{" "}
              <span className="font-normal text-sand-dark">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="A few words about this…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-brown block mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="secondary"
              onClick={() => { setAddOpen(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? "Saving…" : "Add to Board"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MasonryCard({
  item,
  onDelete,
  onClick,
}: {
  item: VisionItem;
  onDelete: (id: string) => void;
  onClick: () => void;
}) {
  return (
    <div className="masonry-item group">
      <div
        className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1"
        style={{ boxShadow: "0 4px 16px rgba(120,91,78,0.12)" }}
        onClick={onClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.src}
          alt={item.caption ?? "Vision board image"}
          className="w-full block"
          loading="lazy"
          style={{ display: "block" }}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-brown/0 group-hover:bg-brown/10 transition-colors duration-200" />
        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm text-brown opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center hover:bg-rose hover:text-white shadow-soft"
        >
          <X size={12} />
        </button>
      </div>
      {item.caption && (
        <p className="font-serif text-xs text-sand-dark italic mt-1.5 px-0.5 leading-snug">
          {item.caption}
        </p>
      )}
    </div>
  );
}
