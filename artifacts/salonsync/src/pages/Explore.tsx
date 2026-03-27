import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Star, MapPin, Scissors, Clock, SlidersHorizontal,
  ArrowLeft, Sparkles, ChevronDown, X, Navigation, Users, Image,
  Filter, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffPreview {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  specialties: string[] | null;
}

interface GalleryImage {
  id: string;
  imageUrl: string;
  caption: string | null;
}

interface TopService {
  id: string;
  name: string;
  basePrice: number;
  durationMinutes: number;
  category: string;
}

interface ExploreLocation {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  timezone: string | null;
  description: string | null;
  logoUrl: string | null;
  tagline: string | null;
  avgRating: number | null;
  reviewCount: number;
  topServices: TopService[];
  allServiceCount: number;
  staffCount: number;
  staffPreview: StaffPreview[];
  gallery: GalleryImage[];
  distance: number | null;
}

const SORTS = [
  { value: "rating", label: "Top Rated" },
  { value: "price", label: "Lowest Price" },
  { value: "distance", label: "Nearest" },
];

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "STANDARD", label: "Standard" },
  { value: "HIGH_VALUE", label: "Premium" },
];

const RATING_OPTIONS = [
  { value: 0, label: "Any Rating" },
  { value: 3, label: "3+ Stars" },
  { value: 4, label: "4+ Stars" },
  { value: 4.5, label: "4.5+ Stars" },
];

function Stars({ rating, count }: { rating: number | null; count: number }) {
  const r = rating ?? 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={cn("text-xs", i <= Math.round(r) ? "text-primary" : "text-white/15")}>★</span>
        ))}
      </div>
      {rating ? (
        <span className="text-[11px] text-white/50">{r.toFixed(1)} ({count})</span>
      ) : (
        <span className="text-[11px] text-white/30">New</span>
      )}
    </div>
  );
}

function SalonCard({ loc, index }: { loc: ExploreLocation; index: number }) {
  const hasGallery = loc.gallery.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
    >
      <Link href={`/explore/${loc.id}`} className="group block relative bg-[#0D1422] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-[0_0_30px_rgba(201,149,106,0.08)] transition-all duration-300">
        <div className="h-36 relative overflow-hidden">
          {hasGallery ? (
            <img src={loc.gallery[0].imageUrl} alt={loc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1A2030] to-[#0D1020]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_120%,rgba(201,149,106,0.15),transparent)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                {loc.logoUrl ? (
                  <img src={loc.logoUrl} alt={loc.name} className="w-14 h-14 rounded-2xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Scissors className="w-6 h-6 text-primary/70" />
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1422] via-transparent to-transparent" />
          {loc.avgRating && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1">
              <Star className="w-3 h-3 fill-primary text-primary" />
              <span className="text-xs font-bold text-white">{loc.avgRating.toFixed(1)}</span>
            </div>
          )}
          {loc.gallery.length > 1 && (
            <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1">
              <Image className="w-3 h-3 text-white/70" />
              <span className="text-[10px] text-white/70">{loc.gallery.length}</span>
            </div>
          )}
          {loc.distance !== null && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1">
              <Navigation className="w-3 h-3 text-white/60" />
              <span className="text-[10px] text-white/60">{loc.distance.toFixed(1)} mi</span>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="mb-2">
            <h3 className="font-display font-bold text-white text-lg leading-tight mb-0.5 group-hover:text-primary/90 transition-colors">
              {loc.name}
            </h3>
            {loc.tagline && <p className="text-[11px] text-primary/60 mb-1">{loc.tagline}</p>}
            {loc.address && (
              <div className="flex items-start gap-1.5 text-xs text-white/40">
                <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                <span>{loc.address}{loc.city ? `, ${loc.city}` : ""}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <Stars rating={loc.avgRating} count={loc.reviewCount} />
            {loc.staffCount > 0 && (
              <span className="text-[10px] text-white/30 flex items-center gap-1">
                <Users className="w-3 h-3" />{loc.staffCount} stylists
              </span>
            )}
          </div>

          {loc.staffPreview.length > 0 && (
            <div className="flex items-center gap-1 mb-3">
              {loc.staffPreview.slice(0, 4).map((s, i) => (
                <div key={s.id} className="w-7 h-7 rounded-full bg-primary/10 border-2 border-[#0D1422] flex items-center justify-center text-[9px] text-primary font-bold" style={{ marginLeft: i > 0 ? -6 : 0 }}>
                  {s.profileImageUrl ? (
                    <img src={s.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    `${s.firstName?.charAt(0) || ""}${s.lastName?.charAt(0) || ""}`
                  )}
                </div>
              ))}
              {loc.staffCount > 4 && <span className="text-[10px] text-white/30 ml-1">+{loc.staffCount - 4}</span>}
            </div>
          )}

          {loc.topServices.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {loc.topServices.slice(0, 3).map(svc => (
                <div key={svc.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-white/50">
                    <div className="w-1 h-1 rounded-full bg-primary/50" />
                    <span>{svc.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/40">
                    <span>{svc.durationMinutes}m</span>
                    <span className="text-primary/80 font-semibold">${svc.basePrice}</span>
                  </div>
                </div>
              ))}
              {loc.allServiceCount > 3 && (
                <p className="text-[10px] text-white/25 text-center mt-1">+{loc.allServiceCount - 3} more services</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
            {loc.topServices.length > 0 ? (
              <span className="text-[10px] text-white/30">
                From <span className="text-primary font-semibold">${Math.min(...loc.topServices.map(s => Number(s.basePrice)))}</span>
              </span>
            ) : <span />}
            <span className="text-xs font-semibold px-4 py-2 rounded-full bg-primary hover:bg-primary/90 text-white transition-all shadow-[0_0_16px_rgba(201,149,106,0.2)]">
              View & Book
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function Explore() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("rating");
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(500);
  const [minPrice, setMinPrice] = useState(0);
  const [category, setCategory] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [maxDistance, setMaxDistance] = useState(50);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoStatus("denied"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGeoStatus("granted");
        setSort("distance");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("sort", sort);
    if (search.trim()) p.set("search", search.trim());
    if (category) p.set("category", category);
    if (minRating > 0) p.set("minRating", minRating.toString());
    if (minPrice > 0) p.set("minPrice", minPrice.toString());
    if (maxPrice < 500) p.set("maxPrice", maxPrice.toString());
    if (userLat !== undefined && userLng !== undefined) {
      p.set("lat", userLat.toString());
      p.set("lng", userLng.toString());
      if (maxDistance < 50) p.set("maxDistance", maxDistance.toString());
    }
    return p.toString();
  }, [sort, search, category, minRating, minPrice, maxPrice, userLat, userLng, maxDistance]);

  const { data: locations = [], isLoading } = useQuery<ExploreLocation[]>({
    queryKey: ["explore-locations", queryParams],
    queryFn: async () => {
      const r = await fetch(`/api/explore/locations?${queryParams}`);
      if (!r.ok) throw new Error("Failed to load salons");
      return r.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const activeFilterCount = [
    category !== "",
    minRating > 0,
    minPrice > 0,
    maxPrice < 500,
    maxDistance < 50 && geoStatus === "granted",
  ].filter(Boolean).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: locations.slice(0, 10).map((loc, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "HairSalon",
        name: loc.name,
        address: loc.address,
        aggregateRating: loc.avgRating ? { "@type": "AggregateRating", ratingValue: loc.avgRating, reviewCount: loc.reviewCount } : undefined,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(201,149,106,0.10),transparent)]" />
      </div>

      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/[0.05]">
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Home
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-[0_0_12px_rgba(201,149,106,0.3)]">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display text-lg font-bold">SalonSync</span>
        </div>
        <Link href="/client/book" className="text-sm font-semibold px-4 py-2 rounded-full bg-primary hover:bg-primary/90 text-white transition-all">
          Book Now
        </Link>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-5 tracking-wide">
            <Sparkles className="w-3 h-3" />
            SALON MARKETPLACE
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Find your perfect{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#daa87a] to-primary/70">salon</span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Browse top-rated salons, compare services, read verified reviews, and book in seconds.
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search salons, services, or stylists… (e.g. &quot;balayage near me&quot;)"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
              </button>
            )}
          </div>

          {geoStatus !== "granted" && (
            <button
              onClick={requestLocation}
              disabled={geoStatus === "loading"}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:border-primary/30 hover:text-primary transition-all text-sm font-medium"
            >
              {geoStatus === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              {geoStatus === "loading" ? "Locating…" : "Near Me"}
            </button>
          )}

          <div className="relative">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-4 pr-9 py-3 text-sm text-white/70 focus:outline-none focus:border-primary/40 transition-colors cursor-pointer"
            >
              {SORTS.filter(s => s.value !== "distance" || geoStatus === "granted").map(s => (
                <option key={s.value} value={s.value} className="bg-[#0F1826]">{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-medium relative",
              showFilters
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:border-white/20"
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {geoStatus === "granted" && (
          <div className="flex items-center gap-2 mb-4">
            <Navigation className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400/70">Location enabled — sorting by distance</span>
          </div>
        )}

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-5 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-primary/40">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value} className="bg-[#0F1826]">{c.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Min Rating</label>
                    <select value={minRating} onChange={e => setMinRating(Number(e.target.value))} className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-primary/40">
                      {RATING_OPTIONS.map(r => <option key={r.value} value={r.value} className="bg-[#0F1826]">{r.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-2">
                      Price Range: <span className="text-primary">${minPrice} – ${maxPrice}</span>
                    </label>
                    <div className="flex gap-2">
                      <input type="range" min={0} max={500} step={10} value={minPrice} onChange={e => setMinPrice(Number(e.target.value))} className="flex-1 accent-primary h-1.5 cursor-pointer" />
                      <input type="range" min={0} max={500} step={10} value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} className="flex-1 accent-primary h-1.5 cursor-pointer" />
                    </div>
                  </div>

                  {geoStatus === "granted" && (
                    <div>
                      <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-2">
                        Max Distance: <span className="text-primary">{maxDistance} mi</span>
                      </label>
                      <input type="range" min={1} max={50} step={1} value={maxDistance} onChange={e => setMaxDistance(Number(e.target.value))} className="w-full accent-primary h-1.5 cursor-pointer" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setCategory(""); setMinRating(0); setMinPrice(0); setMaxPrice(500); setMaxDistance(50); }}
                  className="mt-4 text-xs text-primary hover:underline"
                >
                  Reset all filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-white/40">
            {isLoading ? "Searching…" : `${locations.length} salon${locations.length !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#0D1422] border border-white/[0.05] rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-24">
            <Scissors className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-sm mb-2">No salons found matching your search.</p>
            <p className="text-white/20 text-xs mb-4">Try broadening your filters or searching for a different service.</p>
            <button
              onClick={() => { setSearch(""); setCategory(""); setMinRating(0); setMinPrice(0); setMaxPrice(500); setMaxDistance(50); }}
              className="text-xs text-primary hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {locations.map((loc, i) => (
              <SalonCard key={loc.id} loc={loc} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
