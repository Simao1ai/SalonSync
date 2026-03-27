import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Star, MapPin, Phone, Mail, Clock, Scissors, ChevronLeft, ChevronRight,
  Calendar, User, Sparkles, ExternalLink, BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Stars({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "lg" }) {
  const r = rating ?? 0;
  const cls = size === "lg" ? "text-sm" : "text-xs";
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={cn(cls, i <= Math.round(r) ? "text-primary" : "text-white/15")}>★</span>
      ))}
    </div>
  );
}

function SentimentBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const label = score >= 0.6 ? "Positive" : score >= 0.3 ? "Neutral" : "Negative";
  const color = score >= 0.6 ? "text-green-400 bg-green-500/10" : score >= 0.3 ? "text-yellow-400 bg-yellow-500/10" : "text-red-400 bg-red-500/10";
  return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", color)}>{label}</span>;
}

function GalleryCarousel({ images }: { images: { id: string; imageUrl: string; caption: string | null }[] }) {
  const [idx, setIdx] = useState(0);
  if (!images.length) {
    return (
      <div className="h-64 md:h-80 bg-gradient-to-br from-[#1A2030] to-[#0D1020] rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-12 h-12 text-primary/20 mx-auto mb-3" />
          <p className="text-white/20 text-sm">No gallery photos yet</p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden group">
      <img src={images[idx].imageUrl} alt={images[idx].caption || "Salon photo"} className="w-full h-full object-cover" />
      {images[idx].caption && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <p className="text-white text-sm">{images[idx].caption}</p>
        </div>
      )}
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft className="w-4 h-4 text-white" /></button>
          <button onClick={() => setIdx(i => (i + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="w-4 h-4 text-white" /></button>
          <div className="absolute bottom-3 right-3 bg-black/50 px-2 py-0.5 rounded-full text-[10px] text-white/80">{idx + 1}/{images.length}</div>
        </>
      )}
    </div>
  );
}

export function SalonDetail() {
  const params = useParams<{ id: string }>();
  const { data: salon, isLoading } = useQuery({
    queryKey: ["salon-detail", params.id],
    queryFn: async () => {
      const r = await fetch(`/api/explore/locations/${params.id}`);
      if (!r.ok) throw new Error("Failed to load salon");
      return r.json();
    },
    enabled: !!params.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080C14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="min-h-screen bg-[#080C14] flex items-center justify-center text-white/40">
        <p>Salon not found</p>
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: salon.name,
    address: { "@type": "PostalAddress", streetAddress: salon.address, addressLocality: salon.city, addressRegion: salon.state, postalCode: salon.zip },
    telephone: salon.phone,
    email: salon.email,
    aggregateRating: salon.avgRating ? { "@type": "AggregateRating", ratingValue: salon.avgRating, reviewCount: salon.reviewCount } : undefined,
    geo: salon.latitude ? { "@type": "GeoCoordinates", latitude: salon.latitude, longitude: salon.longitude } : undefined,
    description: salon.description,
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(201,149,106,0.08),transparent)]" />
      </div>

      <nav className="relative z-10 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/[0.05]">
        <Link href="/explore" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>
        <Link href={`/client/book?loc=${salon.id}`} className="text-sm font-semibold px-5 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-white transition-all shadow-[0_0_16px_rgba(201,149,106,0.25)]">
          Book Now
        </Link>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <GalleryCarousel images={salon.gallery} />

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="font-display text-3xl font-bold mb-2">{salon.name}</h1>
                  {salon.tagline && <p className="text-primary/80 text-sm font-medium mb-2">{salon.tagline}</p>}
                  <div className="flex items-center gap-4 text-sm text-white/50">
                    {salon.address && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{salon.address}, {salon.city}, {salon.state}</span>}
                  </div>
                </div>
                {salon.avgRating && (
                  <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-4 py-2.5">
                    <Star className="w-5 h-5 fill-primary text-primary" />
                    <div>
                      <p className="text-lg font-bold">{salon.avgRating.toFixed(1)}</p>
                      <p className="text-[10px] text-white/40">{salon.reviewCount} reviews</p>
                    </div>
                  </div>
                )}
              </div>
              {salon.description && <p className="text-white/50 text-sm leading-relaxed">{salon.description}</p>}
              <div className="flex items-center gap-4 mt-4 text-sm text-white/40">
                {salon.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{salon.phone}</span>}
                {salon.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{salon.email}</span>}
                {salon.hasAvailabilityToday && <span className="flex items-center gap-1.5 text-green-400"><BadgeCheck className="w-3.5 h-3.5" />Available today</span>}
              </div>
            </motion.div>

            <div>
              <h2 className="font-display text-xl font-bold mb-4">Services</h2>
              <div className="space-y-2">
                {salon.services?.map((svc: any) => (
                  <div key={svc.id} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Scissors className="w-4 h-4 text-primary/70" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{svc.name}</p>
                        <p className="text-[11px] text-white/30">{svc.category} · {svc.durationMinutes} min</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-primary font-semibold">${svc.basePrice}</span>
                      <Link href={`/client/book?loc=${salon.id}&svc=${svc.id}`} className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                        Book
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-display text-xl font-bold mb-4">Reviews</h2>
              {salon.reviews?.length === 0 ? (
                <p className="text-white/30 text-sm">No reviews yet. Be the first!</p>
              ) : (
                <div className="space-y-4">
                  {salon.reviews?.map((rev: any) => (
                    <div key={rev.id} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                            {rev.clientName?.charAt(0) || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{rev.clientName}</p>
                            {rev.staffName && <p className="text-[10px] text-white/30">Stylist: {rev.staffName}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <SentimentBadge score={rev.sentimentScore} />
                          <Stars rating={rev.rating} />
                        </div>
                      </div>
                      {rev.comment && <p className="text-sm text-white/50 leading-relaxed">{rev.comment}</p>}
                      <p className="text-[10px] text-white/20 mt-2">{new Date(rev.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="sticky top-6 space-y-6">
              <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5">
                <h3 className="font-display font-bold text-lg mb-1">Ready to book?</h3>
                <p className="text-xs text-white/40 mb-4">Choose a service and pick your preferred time.</p>
                <Link href={`/client/book?loc=${salon.id}`} className="block w-full text-center py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(201,149,106,0.2)]">
                  Book Appointment
                </Link>
              </div>

              <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5">
                <h3 className="font-display font-bold mb-4">Our Team</h3>
                <div className="space-y-3">
                  {salon.staff?.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                        {s.profileImageUrl ? (
                          <img src={s.profileImageUrl} alt={s.firstName} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          `${s.firstName?.charAt(0) || ""}${s.lastName?.charAt(0) || ""}`
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{s.firstName} {s.lastName}</p>
                        {s.specialties?.length > 0 && (
                          <p className="text-[10px] text-white/30 truncate">{s.specialties.slice(0, 3).join(", ")}</p>
                        )}
                        {s.avgRating && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="w-2.5 h-2.5 fill-primary text-primary" />
                            <span className="text-[10px] text-white/40">{s.avgRating.toFixed(1)} ({s.reviewCount})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!salon.staff || salon.staff.length === 0) && (
                    <p className="text-white/30 text-xs text-center py-2">Team info coming soon</p>
                  )}
                </div>
              </div>

              {salon.latitude && salon.longitude && (
                <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5">
                  <h3 className="font-display font-bold mb-3">Location</h3>
                  <p className="text-sm text-white/50 mb-3">{salon.address}, {salon.city}, {salon.state} {salon.zip}</p>
                  <a
                    href={`https://www.google.com/maps?q=${salon.latitude},${salon.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on Google Maps
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
