"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { DashboardData, SkincareProduct } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { today as todayStr, id } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function SkincareView({ data, update }: Props) {
  const [productOpen, setProductOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [productForm, setProductForm] = useState<{ name: string; brand: string; routine: "am" | "pm" | "both"; isTesting: boolean; startDate: string; notes: string }>({ name: "", brand: "", routine: "am", isTesting: false, startDate: "", notes: "" });
  const [checkInForm, setCheckInForm] = useState({ breakouts: false, observations: "", changes: "" });
  const today = todayStr();

  const amProducts = data.skincareProducts.filter((p) => p.routine === "am" || p.routine === "both").sort((a, b) => a.order - b.order);
  const pmProducts = data.skincareProducts.filter((p) => p.routine === "pm" || p.routine === "both").sort((a, b) => a.order - b.order);
  const testingProducts = data.skincareProducts.filter((p) => p.isTesting);

  const addProduct = () => {
    if (!productForm.name.trim()) return;
    const maxOrder = Math.max(0, ...data.skincareProducts.filter((p) => p.routine === productForm.routine).map((p) => p.order));
    update((d) => ({ ...d, skincareProducts: [...d.skincareProducts, { ...productForm, id: id(), order: maxOrder + 1 }] }));
    setProductForm({ name: "", brand: "", routine: "am", isTesting: false, startDate: "", notes: "" });
    setProductOpen(false);
  };

  const deleteProduct = (pid: string) => {
    update((d) => ({ ...d, skincareProducts: d.skincareProducts.filter((p) => p.id !== pid) }));
  };

  const addCheckIn = () => {
    if (!checkInForm.observations.trim()) return;
    update((d) => ({ ...d, skinCheckIns: [...d.skinCheckIns, { ...checkInForm, id: id(), date: today }] }));
    setCheckInForm({ breakouts: false, observations: "", changes: "" });
    setCheckInOpen(false);
  };

  const renderProductList = (products: SkincareProduct[], label: string) => (
    <div>
      <p className="text-sm font-semibold text-brown mb-3">{label}</p>
      <div className="space-y-2">
        {products.length === 0 ? (
          <p className="text-sand-dark text-sm">None added yet</p>
        ) : (
          products.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl group ${p.isTesting ? "bg-rose/10 border border-rose/20" : "bg-cream-dark"}`}>
              <span className="text-xs text-sand-dark w-5 text-center font-medium">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-brown font-medium">{p.name}</p>
                {p.brand && <p className="text-xs text-sand-dark">{p.brand}</p>}
                {p.isTesting && <p className="text-xs text-rose">🧪 Testing{p.startDate ? ` since ${format(parseISO(p.startDate), "MMM d")}` : ""}</p>}
                {p.notes && <p className="text-xs text-sand-dark italic">{p.notes}</p>}
              </div>
              <button onClick={() => deleteProduct(p.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose flex-shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Skincare</h1>
          <p className="text-sand-dark mt-1">Real data for your future dermatology practice ✨</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCheckInOpen(true)}>
            <Sparkles size={14} className="mr-1.5 inline" /> Skin Check-in
          </Button>
          <Button onClick={() => setProductOpen(true)}>
            <Plus size={14} className="mr-1.5 inline" /> Add Product
          </Button>
        </div>
      </div>

      {testingProducts.length > 0 && (
        <Card title="Currently Testing" subtitle="Products on trial">
          <div className="space-y-2 mt-2">
            {testingProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose/10 border border-rose/20">
                <span className="text-base">🧪</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-brown">{p.name}</p>
                  {p.startDate && <p className="text-xs text-sand-dark">Started {format(parseISO(p.startDate), "MMMM d, yyyy")}</p>}
                  {p.notes && <p className="text-xs text-brown italic">{p.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>{renderProductList(amProducts, "☀️ AM Routine")}</Card>
        <Card>{renderProductList(pmProducts, "🌙 PM Routine")}</Card>
      </div>

      <Card title="Skin Check-in Log">
        {data.skinCheckIns.length === 0 ? (
          <p className="text-sand-dark text-sm">No check-ins yet. Log your skin&apos;s journey! 🌸</p>
        ) : (
          <div className="space-y-3">
            {[...data.skinCheckIns].reverse().slice(0, 15).map((c) => (
              <div key={c.id} className="p-3 rounded-xl bg-cream-dark">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-sand-dark">{format(parseISO(c.date), "EEEE, MMMM d, yyyy")}</p>
                  {c.breakouts && <span className="text-xs bg-rose/20 text-rose px-2 py-0.5 rounded-full">Breakout</span>}
                </div>
                <p className="text-sm text-brown">{c.observations}</p>
                {c.changes && <p className="text-xs text-sand-dark mt-1">Changed: {c.changes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={productOpen} onClose={() => setProductOpen(false)} title="Add Product">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Product Name</label>
            <input type="text" placeholder="e.g. CeraVe Hydrating Cleanser" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Brand (optional)</label>
            <input type="text" placeholder="e.g. CeraVe" value={productForm.brand} onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Routine</label>
            <select value={productForm.routine} onChange={(e) => { const r = e.target.value as SkincareProduct["routine"]; setProductForm({ ...productForm, routine: r }); }}>
              <option value="am">AM only</option>
              <option value="pm">PM only</option>
              <option value="both">Both AM & PM</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="testing" checked={productForm.isTesting} onChange={(e) => setProductForm({ ...productForm, isTesting: e.target.checked })} className="w-4 h-4 accent-terracotta" />
            <label htmlFor="testing" className="text-sm text-brown">Currently testing / trialing</label>
          </div>
          {productForm.isTesting && (
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Start date</label>
              <input type="date" value={productForm.startDate} onChange={(e) => setProductForm({ ...productForm, startDate: e.target.value })} />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea rows={2} placeholder="Skin concerns it targets, results so far…" value={productForm.notes} onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setProductOpen(false)}>Cancel</Button>
            <Button onClick={addProduct}>Add Product</Button>
          </div>
        </div>
      </Modal>

      <Modal open={checkInOpen} onClose={() => setCheckInOpen(false)} title="Skin Check-in">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="breakout" checked={checkInForm.breakouts} onChange={(e) => setCheckInForm({ ...checkInForm, breakouts: e.target.checked })} className="w-4 h-4 accent-terracotta" />
            <label htmlFor="breakout" className="text-sm text-brown">Any breakouts?</label>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Observations</label>
            <textarea rows={3} placeholder="How does your skin look and feel today? Texture, hydration, redness…" value={checkInForm.observations} onChange={(e) => setCheckInForm({ ...checkInForm, observations: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Any changes (products, diet, sleep)?</label>
            <input type="text" placeholder="e.g. Tried new toner, slept poorly" value={checkInForm.changes} onChange={(e) => setCheckInForm({ ...checkInForm, changes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCheckInOpen(false)}>Cancel</Button>
            <Button onClick={addCheckIn}>Save Check-in</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
