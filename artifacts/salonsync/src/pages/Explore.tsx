import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Star, MapPin, Scissors, Clock, SlidersHorizontal,
  ArrowLeft, Sparkles, ChevronDown, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
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
  phone: string | null;
  timezone: string | null;
  avgRating: number | null;
  reviewCount: number;
  topServices: TopService[];
}

// ── Sort options ───────────────────────────────────────────────────────────
const SORTS = [
  { value: "rating", label: "Top Rated" },
  { value: "price",  label: "Lowest Price" },
];

// ── Stars component ────────────────────────────────────────────────────────
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
        <span className="text-[11px] text-white/50">
          {r.toFixed(1)} ({count} review{count !== 1 ? "s" : ""})
        </span>
      ) : (
        <span className="text-[11px] text-white/30">No reviews yet</span>
      )}
    </div>
  );
}

// ── Price range badge ──────────────────────────────────────────────────────
function PriceBadge({ services }: { services: TopService[] }) {
  if (!services.length) return null;
  const min = Math.min(...services.map(s => s.basePrice));
  const max = Math.max(...services.map(s => s.basePrice));
  const label = min === max ? `$${min}` : `$${min}–$${max}`;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
      {label}
    </span>
  );
}

// ── Salon card ─────────────────────────────────────────────────────────────
function SalonCard({ loc, index }: { loc: ExploreLocation; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="group relative bg-[#0D1422] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-[0_0_30px_rgba(201,149,106,0.08)] transition-all duration-300"
    >
      {/* Gradient header */}
      <div className="h-28 bg-gradient-to-br from-[#1A2030] to-[#0D1020] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_120%,rgba(201,149,106,0.15),transparent)]" />
        {/* Logo placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Scissors className="w-6 h-6 text-primary/70" />
          </div>
        </div>
        {/* Rating badge top-right */}
        {loc.avgRating && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1">
            <Star className="w-3 h-3 fill-primary text-primary" />
            <span className="text-xs font-bold text-white">{loc.avgRating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="p-5">
        {/* Name + address */}
        <div className="mb-3">
          <h3 className="font-display font-bold text-white text-lg leading-tight mb-1 group-hover:text-primary/90 transition-colors">
            {loc.name}
          </h3>
          {loc.address && (
            <div className="flex items-start gap-1.5 text-xs text-white/40">
              <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{loc.address}</span>
            </div>
          )}
        </div>

        {/* Stars */}
        <Stars rating={loc.avgRating} count={loc.reviewCount} />

        {/* Services preview */}
        {loc.topServices.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Top Services</p>
            {loc.topServices.slice(0, 3).map(svc => (
              <div key={svc.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                  <span className="text-xs text-white/60">{svc.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/40">
                  <Clock className="w-3 h-3" />
                  <span>{svc.durationMinutes}m</span>
                  <span className="text-primary/80 font-semibold">${svc.basePrice}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between pt-4 border-t border-white/[0.05]">
          <PriceBadge services={loc.topServices} />
          <Link
            href="/client/book"
            className="text-xs font-semibold px-4 py-2 rounded-full bg-primary hover:bg-primary/90 text-white transition-all shadow-[0_0_16px_rgba(201,149,106,0.2)] hover:shadow-[0_0_24px_rgba(201,149,106,0.35)] hover:-translate-y-px"
          >
            Book Now
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function Explore() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("rating");
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(500);

  const { data: locations = [], isLoading } = useQuery<ExploreLocation[]>({
    queryKey: ["explore-locations", sort],
    queryFn: async () => {
      const r = await fetch(`/api/explore/locations?sort=${sort}`);
      if (!r.ok) throw new Error("Failed to load salons");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    let result = [...locations];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(loc =>
        loc.name.toLowerCase().includes(q) ||
        loc.address?.toLowerCase().includes(q) ||
        loc.topServices.some(s => s.name.toLowerCase().includes(q))
      );
    }
    result = result.filter(loc =>
      !loc.topServices.length || loc.topServices.some(s => s.basePrice <= maxPrice)
    );
    return result;
  }, [locations, search, maxPrice]);

  return (
    <div className="min-h-screen bg-[#080C14] text-white">
      {/* Background noise */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(201,149,106,0.10),transparent)]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/[0.05]">
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
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
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-5 tracking-wide">
            <Sparkles className="w-3 h-3" />
            SALON MARKETPLACE
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Find your perfect{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#daa87a] to-primary/70">
              salon
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Browse top-rated salons, compare services and pricing, and book in seconds.
          </p>
        </motion.div>

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search salons or services…"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-4 pr-9 py-3 text-sm text-white/70 focus:outline-none focus:border-primary/40 transition-colors cursor-pointer"
            >
              {SORTS.map(s => (
                <option key={s.value} value={s.value} className="bg-[#0F1826]">{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-medium",
              showFilters
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:border-white/20"
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-5 mb-6"
          >
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex-1">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block mb-3">
                  Max Service Price: <span className="text-primary">${maxPrice}</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={500}
                  step={10}
                  value={maxPrice}
                  onChange={e => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-white/25 mt-1">
                  <span>$20</span>
                  <span>$500</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Result count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-white/40">
            {isLoading ? "Loading…" : `${filtered.length} salon${filtered.length !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#0D1422] border border-white/[0.05] rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Scissors className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-sm">No salons found matching your search.</p>
            <button
              onClick={() => { setSearch(""); setMaxPrice(500); }}
              className="mt-4 text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((loc, i) => (
              <SalonCard key={loc.id} loc={loc} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
