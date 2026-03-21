import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListAppointments, useListReviews, useCreateReview } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { format } from "date-fns";
import { Star, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star className={`w-8 h-8 ${i <= (hovered || value) ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`} />
        </button>
      ))}
    </div>
  );
}

export function ClientReviews() {
  const { user } = useAuth();
  const { data: appointments } = useListAppointments({ clientId: user?.id });
  const { data: reviews, refetch } = useListReviews({ clientId: user?.id });
  const { mutate: createReview } = useCreateReview();

  const reviewableApts = (appointments ?? []).filter(a => {
    if (a.status !== "COMPLETED") return false;
    const alreadyReviewed = (reviews ?? []).some(r => r.appointmentId === a.id);
    return !alreadyReviewed;
  });

  const [pendingReview, setPendingReview] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const apt = reviewableApts.find(a => a.id === pendingReview);

  function handleSubmit() {
    if (!pendingReview || !apt?.staffId) return;
    setSubmitting(true);
    createReview(
      {
        data: {
          appointmentId: pendingReview,
          staffId: apt.staffId,
          locationId: apt.locationId ?? "da62c8fa-580b-44c9-bed8-e19938402d39",
          rating,
          comment: comment.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Review submitted — thank you!");
          setPendingReview(null);
          setRating(5);
          setComment("");
          refetch();
        },
        onError: () => toast.error("Failed to submit review"),
        onSettled: () => setSubmitting(false),
      }
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">My Reviews</h1>
        <p className="text-muted-foreground mt-1">Share your experience with your stylists</p>
      </div>

      {reviewableApts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Awaiting Your Review
          </h2>
          <div className="space-y-3">
            {reviewableApts.map(a => (
              <Card key={a.id} className="border-yellow-500/20 bg-yellow-500/5">
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{a.services?.map(s => s.service?.name).join(", ")}</p>
                    <p className="text-sm text-muted-foreground">
                      with {a.staff?.firstName} · {format(new Date(a.startTime), "MMMM d, yyyy")}
                    </p>
                  </div>
                  {pendingReview === a.id ? (
                    <Button size="sm" variant="outline" onClick={() => setPendingReview(null)}>Cancel</Button>
                  ) : (
                    <Button size="sm" onClick={() => { setPendingReview(a.id); setRating(5); setComment(""); }}>
                      Write Review
                    </Button>
                  )}
                </CardContent>

                {pendingReview === a.id && (
                  <div className="px-5 pb-5 border-t border-yellow-500/20 pt-5 space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Your Rating</p>
                      <StarPicker value={rating} onChange={setRating} />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Your Comments (optional)</p>
                      <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        rows={3}
                        placeholder="Tell us about your experience..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                      />
                    </div>
                    <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Submit Review
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        Past Reviews ({reviews?.length ?? 0})
      </h2>
      {(!reviews || reviews.length === 0) ? (
        <Card className="border-dashed border-white/10 bg-transparent">
          <CardContent className="p-12 text-center">
            <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No reviews yet. Complete an appointment to share your experience.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => {
            const apt = appointments?.find(a => a.id === r.appointmentId);
            return (
              <Card key={r.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{apt?.staff?.firstName} {apt?.staff?.lastName}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(r.createdAt), "MMMM d, yyyy")}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={`w-4 h-4 ${i <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground italic">"{r.comment}"</p>}
                  {r.sentimentLabel && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                      AI Sentiment: {r.sentimentLabel}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
