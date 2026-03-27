import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Package, Plus, Pencil, Trash2, X, Menu,
  ShoppingBag, DollarSign, TrendingUp, Archive
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["Hair Care", "Skin Care", "Styling Tools", "Accessories", "Treatments", "Other"];

function getHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  if (sid) headers["Authorization"] = `Bearer ${sid}`;
  return headers;
}

export function AdminStore() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", description: "", price: "", imageUrl: "", category: "", sku: "", quantity: "0"
  });
  const qc = useQueryClient();

  const { data: locations } = useQuery<any[]>({
    queryKey: ["locations"],
    queryFn: () => fetch("/api/locations", { headers: getHeaders() }).then(r => r.json()),
  });
  const locationId = locations?.[0]?.id;

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-products", locationId],
    queryFn: () => fetch(`/api/store/products/all?locationId=${locationId}`, { headers: getHeaders() }).then(r => r.json()),
    enabled: !!locationId,
  });

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["admin-orders", locationId],
    queryFn: () => fetch(`/api/store/orders?locationId=${locationId}`, { headers: getHeaders() }).then(r => r.json()),
    enabled: !!locationId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editing ? `/api/store/products/${editing.id}` : "/api/store/products";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify({ ...data, locationId }) });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(editing ? "Product updated" : "Product created");
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/products/${id}`, { method: "DELETE", headers: getHeaders() });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product deleted");
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/store/orders/${id}/status`, {
        method: "PATCH", headers: getHeaders(), body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order status updated");
    },
  });

  function resetForm() {
    setForm({ name: "", description: "", price: "", imageUrl: "", category: "", sku: "", quantity: "0" });
    setEditing(null);
    setShowForm(false);
  }

  function startEdit(p: any) {
    setForm({
      name: p.name, description: p.description || "", price: String(p.price),
      imageUrl: p.imageUrl || "", category: p.category || "", sku: p.sku || "",
      quantity: String(p.quantity || 0),
    });
    setEditing(p);
    setShowForm(true);
  }

  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
  const inStockCount = products.filter((p: any) => p.inStock).length;

  return (
    <div className="flex h-screen bg-[#0B1120]">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-white/60"><Menu className="w-5 h-5" /></button>
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-display font-bold text-white">Product Store</h1>
        </div>

        <div className="p-6 space-y-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Products", value: products.length, icon: Package, color: "text-blue-400" },
              { label: "In Stock", value: inStockCount, icon: Archive, color: "text-green-400" },
              { label: "Orders", value: orders.length, icon: ShoppingBag, color: "text-purple-400" },
              { label: "Revenue", value: `$${totalRevenue.toFixed(0)}`, icon: DollarSign, color: "text-primary" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs text-white/40">{s.label}</span>
                </div>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">Products</h2>
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>

          {showForm && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-semibold">{editing ? "Edit Product" : "New Product"}</h3>
                <button onClick={resetForm} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Price *</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="">Select...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">SKU</label>
                  <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Quantity</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Image URL</label>
                  <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-white/50 mb-1 block">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={resetForm} className="px-4 py-2 text-white/40 hover:text-white text-sm">Cancel</button>
                <button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.price}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40">
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {isLoading && <p className="text-white/40 text-sm text-center py-8">Loading products...</p>}
            {!isLoading && products.length === 0 && (
              <div className="text-center py-12 text-white/30">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No products yet. Add your first product to start selling.</p>
              </div>
            )}
            {products.map((p: any) => (
              <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center">
                    <Package className="w-6 h-6 text-white/20" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">{p.name}</h3>
                    {p.category && <span className="text-[10px] px-2 py-0.5 bg-primary/15 text-primary rounded-full">{p.category}</span>}
                  </div>
                  <p className="text-white/40 text-xs truncate mt-0.5">{p.description || "No description"}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="text-primary font-semibold">${p.price.toFixed(2)}</span>
                    <span className="text-white/30">Qty: {p.quantity || 0}</span>
                    {p.sku && <span className="text-white/30">SKU: {p.sku}</span>}
                    <span className={p.inStock ? "text-green-400" : "text-red-400"}>
                      {p.inStock ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(p)} className="p-2 text-white/30 hover:text-white hover:bg-white/5 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { if (confirm("Delete this product?")) deleteMutation.mutate(p.id); }}
                    className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {orders.length > 0 && (
            <>
              <h2 className="text-white font-semibold mt-8">Recent Orders</h2>
              <div className="space-y-2">
                {orders.slice(0, 20).map((o: any) => (
                  <div key={o.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">Order #{o.id.slice(0, 8)}</p>
                        <p className="text-white/40 text-xs">{new Date(o.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-semibold text-sm">${o.totalAmount.toFixed(2)}</span>
                        <select value={o.status} onChange={e => updateOrderStatus.mutate({ id: o.id, status: e.target.value })}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                          {["pending", "confirmed", "shipped", "delivered", "cancelled"].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {o.items?.length > 0 && (
                      <div className="mt-2 text-xs text-white/40">
                        {o.items.map((i: any) => `${i.productName} x${i.quantity}`).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
