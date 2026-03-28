import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  ShoppingBag, ShoppingCart, Plus, Minus, X, Menu, Package, Check, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@workspace/replit-auth-web";

function getHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  if (sid) headers["Authorization"] = `Bearer ${sid}`;
  return headers;
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
}

export function ClientStore() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [tab, setTab] = useState<"shop" | "orders">("shop");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: locations } = useQuery<any[]>({
    queryKey: ["locations"],
    queryFn: () => fetch("/api/locations", { headers: getHeaders() }).then(r => r.json()),
  });
  const locationId = locations?.[0]?.id;

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["store-products", locationId],
    queryFn: () => fetch(`/api/store/products?locationId=${locationId}`, { headers: getHeaders() }).then(r => r.json()),
    enabled: !!locationId,
  });

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["my-orders"],
    queryFn: () => fetch("/api/store/orders", { headers: getHeaders() }).then(r => r.json()),
    enabled: tab === "orders",
  });

  const orderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/store/orders", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          locationId,
          items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Order placed successfully!");
      setCart([]);
      setShowCart(false);
      qc.invalidateQueries({ queryKey: ["store-products"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  function addToCart(product: any) {
    setCart(prev => {
      const existing = prev.find(c => c.productId === product.id);
      if (existing) {
        return prev.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl, quantity: 1 }];
    });
    toast.success(`${product.name} added to cart`);
  }

  function updateCartQty(productId: string, delta: number) {
    setCart(prev => prev.map(c => {
      if (c.productId !== productId) return c;
      const newQty = c.quantity + delta;
      return newQty <= 0 ? c : { ...c, quantity: newQty };
    }).filter(c => c.quantity > 0));
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(c => c.productId !== productId));
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
  const filtered = selectedCategory ? products.filter((p: any) => p.category === selectedCategory) : products;

  return (
    <div className="flex h-screen bg-[#0B1120]">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-y-auto relative">
        <div className="sticky top-0 z-10 bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-white/60"><Menu className="w-5 h-5" /></button>
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-display font-bold text-white">Product Store</h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex bg-white/5 rounded-lg p-0.5">
              <button onClick={() => setTab("shop")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "shop" ? "bg-primary text-white" : "text-white/40 hover:text-white"}`}>
                Shop
              </button>
              <button onClick={() => setTab("orders")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "orders" ? "bg-primary text-white" : "text-white/40 hover:text-white"}`}>
                My Orders
              </button>
            </div>
            <button onClick={() => setShowCart(true)} className="relative p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 max-w-6xl mx-auto">
          {tab === "shop" && (
            <>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  <button onClick={() => setSelectedCategory("")}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!selectedCategory ? "bg-primary text-white" : "bg-white/5 text-white/40 hover:text-white"}`}>
                    All
                  </button>
                  {categories.map(c => (
                    <button key={c} onClick={() => setSelectedCategory(c === selectedCategory ? "" : c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === c ? "bg-primary text-white" : "bg-white/5 text-white/40 hover:text-white"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              )}

              {isLoading && <p className="text-white/40 text-center py-12">Loading products...</p>}

              {!isLoading && filtered.length === 0 && (
                <div className="text-center py-16 text-white/30">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg mb-1">No products available</p>
                  <p className="text-sm">Check back soon for new arrivals.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p: any) => {
                  const inCart = cart.find(c => c.productId === p.id);
                  return (
                    <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden group hover:border-primary/30 transition-colors">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-48 object-cover" />
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                          <Package className="w-12 h-12 text-primary/30" />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-white font-medium">{p.name}</h3>
                            {p.category && <span className="text-[10px] text-primary/80">{p.category}</span>}
                          </div>
                          <span className="text-primary font-bold text-lg">${p.price.toFixed(2)}</span>
                        </div>
                        {p.description && <p className="text-white/40 text-xs mt-2 line-clamp-2">{p.description}</p>}
                        <button onClick={() => addToCart(p)}
                          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
                          {inCart ? <><Check className="w-4 h-4" /> In Cart ({inCart.quantity})</> : <><Plus className="w-4 h-4" /> Add to Cart</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "orders" && (
            <div className="space-y-3">
              {orders.length === 0 && (
                <div className="text-center py-16 text-white/30">
                  <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">No orders yet</p>
                </div>
              )}
              {orders.map((o: any) => (
                <div key={o.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-white font-medium text-sm">Order #{o.id.slice(0, 8)}</p>
                      <p className="text-white/40 text-xs">{new Date(o.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-primary font-bold">${Number(o.totalAmount || 0).toFixed(2)}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        o.status === "delivered" ? "bg-green-500/15 text-green-400" :
                        o.status === "cancelled" ? "bg-red-500/15 text-red-400" :
                        "bg-primary/15 text-primary"
                      }`}>{o.status}</span>
                    </div>
                  </div>
                  {o.items?.map((i: any) => (
                    <div key={i.id} className="flex items-center gap-3 py-1 text-xs text-white/50">
                      {i.productImage && <img src={i.productImage} alt="" className="w-8 h-8 rounded object-cover" />}
                      <span className="flex-1">{i.productName}</span>
                      <span>x{i.quantity}</span>
                      <span className="text-white/30">${(Number(i.priceAtTime || 0) * Number(i.quantity || 0)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {showCart && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
            <div className="relative w-full max-w-md bg-[#0F1829] border-l border-white/[0.06] flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" /> Cart ({cartCount})
                </h2>
                <button onClick={() => setShowCart(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 && <p className="text-white/30 text-center py-8">Your cart is empty</p>}
                {cart.map(item => (
                  <div key={item.productId} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                        <Package className="w-5 h-5 text-white/20" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.name}</p>
                      <p className="text-primary text-xs">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateCartQty(item.productId, -1)}
                        className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-white text-sm">{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.productId, 1)}
                        className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item.productId)} className="text-white/20 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-white/[0.06] p-4 space-y-3">
                  <div className="flex justify-between text-white">
                    <span className="font-medium">Total</span>
                    <span className="font-bold text-primary text-lg">${cartTotal.toFixed(2)}</span>
                  </div>
                  <button onClick={() => orderMutation.mutate()} disabled={orderMutation.isPending}
                    className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {orderMutation.isPending ? "Placing order..." : <>Place Order <ChevronRight className="w-4 h-4" /></>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
