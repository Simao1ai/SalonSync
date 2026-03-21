import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useListServices, useListUsers, useCreateAppointment } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  CheckCircle2, ChevronRight, User as UserIcon, Calendar as CalendarIcon,
  Scissors, CreditCard, Lock, AlertCircle, Clock, RefreshCw, Repeat2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { AppointmentWithDetails } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const LOCATION_ID = "da62c8fa-580b-44c9-bed8-e19938402d39";

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "#ffffff", fontFamily: "'Inter', sans-serif", fontSize: "15px",
      fontSmoothing: "antialiased", "::placeholder": { color: "#64748b" },
      backgroundColor: "transparent",
    },
    invalid: { color: "#f87171", iconColor: "#f87171" },
  },
};

function getAuthHeaders(): Record<string, string> {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

// ── PaymentForm ─────────────────────────────────────────────────────────────
function PaymentForm({
  appointment, clientSecret, isMockMode, onSuccess, onBack,
}: {
  appointment: AppointmentWithDetails; clientSecret: string; isMockMode: boolean;
  onSuccess: () => void; onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handlePay = useCallback(async () => {
    setPaying(true); setCardError(null);
    try {
      if (isMockMode) {
        await new Promise(r => setTimeout(r, 1200));
        await fetch("/api/payments/confirm", {
          method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ appointmentId: appointment.id, paymentIntentId: "pi_test_mock" }),
        });
        onSuccess(); return;
      }
      if (!stripe || !elements) return;
      const card = elements.getElement(CardElement);
      if (!card) return;
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, { payment_method: { card } });
      if (error) { setCardError(error.message ?? "Payment failed"); return; }
      if (paymentIntent?.status === "succeeded") {
        await fetch("/api/payments/confirm", {
          method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ appointmentId: appointment.id, paymentIntentId: paymentIntent.id }),
        });
        onSuccess();
      }
    } catch { setCardError("Payment failed. Please try again."); }
    finally { setPaying(false); }
  }, [stripe, elements, clientSecret, appointment.id, isMockMode, onSuccess]);

  return (
    <motion.div key="step-pay" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <h2 className="text-2xl font-bold mb-6">Payment</h2>
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-5">
        <div className="flex justify-between items-center text-sm mb-1">
          <span className="text-white/60">{appointment.services?.map((s: any) => s.serviceName).join(", ")}</span>
          <span className="font-semibold text-white">{formatCurrency(appointment.totalPrice)}</span>
        </div>
        {appointment.isHighValue && (appointment.depositAmount ?? 0) > 0 && (
          <p className="text-xs text-primary mt-1">Deposit only: {formatCurrency(appointment.depositAmount ?? 0)} charged now</p>
        )}
      </div>
      {isMockMode && (
        <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300"><strong>Demo mode</strong> — no Stripe key configured. Payment will be simulated.</p>
        </div>
      )}
      {!isMockMode && (
        <div className="border border-white/10 rounded-xl px-4 py-4 mb-4 bg-white/[0.02] focus-within:border-primary/50 transition-colors">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      )}
      {isMockMode && (
        <div className="border border-dashed border-white/15 rounded-xl px-4 py-4 mb-4 bg-white/[0.02] flex items-center gap-3 text-white/40">
          <CreditCard className="w-5 h-5" /><span className="text-sm">4242 4242 4242 4242 (simulated)</span>
        </div>
      )}
      {cardError && (
        <p className="text-sm text-red-400 mb-4 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {cardError}</p>
      )}
      <div className="flex items-center gap-1.5 text-xs text-white/30 mb-6">
        <Lock className="w-3 h-3" />Payments are encrypted and secure {!isMockMode && "via Stripe"}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={paying}>Back</Button>
        <Button onClick={handlePay} isLoading={paying} className="px-8 gap-2">
          <CreditCard className="w-4 h-4" />
          Pay {formatCurrency(appointment.isHighValue && (appointment.depositAmount ?? 0) > 0 ? (appointment.depositAmount ?? 0) : appointment.totalPrice)}
        </Button>
      </div>
    </motion.div>
  );
}

// ── Main BookingFlow ────────────────────────────────────────────────────────
export function BookingFlow() {
  const [step, setStep] = useState(1);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedDate] = useState<Date>(new Date(Date.now() + 86400000 * 2));

  // Recurring state
  const [enableRecurring, setEnableRecurring] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState<"weekly" | "biweekly" | "monthly">("biweekly");
  const [recurringEndDate, setRecurringEndDate] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  });

  // Payment state
  const [createdAppointment, setCreatedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  // Waitlist state
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);
  const [preferredDay, setPreferredDay] = useState<number | null>(null);
  const [preferredTime, setPreferredTime] = useState<"MORNING" | "AFTERNOON" | "EVENING">("MORNING");

  const { data: services, isLoading: servicesLoading } = useListServices({ locationId: LOCATION_ID });
  const { data: staff, isLoading: staffLoading } = useListUsers({ role: "STAFF", locationId: LOCATION_ID });
  const { mutateAsync: createAppointment, isPending: isCreating } = useCreateAppointment();

  const selectedService = services?.find(s => s.id === selectedServiceId);
  const selectedStaff = staff?.find(s => s.id === selectedStaffId);

  // Waitlist mutation
  const joinWaitlist = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          staffId: selectedStaffId ?? undefined,
          locationId: LOCATION_ID,
          preferredDayOfWeek: preferredDay ?? undefined,
          preferredTimeRange: preferredTime,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to join waitlist");
      }
      return r.json();
    },
    onSuccess: () => {
      setJoinedWaitlist(true);
      toast.success("You're on the waitlist!", { description: "We'll notify you when a slot opens up." });
      setTimeout(() => setLocation("/client/dashboard"), 3000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Make recurring mutation
  const makeRecurring = useMutation({
    mutationFn: async (appointmentId: string) => {
      const r = await fetch(`/api/appointments/${appointmentId}/make-recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ frequency: recurringFreq, endDate: recurringEndDate }),
      });
      return r.json();
    },
  });

  const handleConfirmAndPay = async () => {
    if (!selectedServiceId || !selectedStaffId || !user?.id) return;
    try {
      const appt = await createAppointment({
        data: {
          locationId: LOCATION_ID, clientId: user.id, staffId: selectedStaffId,
          serviceIds: [selectedServiceId], startTime: selectedDate.toISOString(),
          notes: "Booked via client portal",
        },
      }) as AppointmentWithDetails;

      setCreatedAppointment(appt);

      // Make recurring if toggled
      if (enableRecurring) {
        makeRecurring.mutate(appt.id);
      }

      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          appointmentId: appt.id,
          paymentType: appt.isHighValue && (appt.depositAmount ?? 0) > 0 ? "DEPOSIT" : "FULL",
        }),
      });
      if (!res.ok) throw new Error("Failed to create payment intent");
      const data = await res.json();
      setClientSecret(data.clientSecret);
      setIsMockMode(data.mode === "test_no_key");
      setStep(5);
    } catch { toast.error("Failed to prepare booking. Please try again."); }
  };

  const handlePaymentSuccess = () => {
    setSucceeded(true); setStep(6);
    toast.success("Payment confirmed!", { description: enableRecurring ? "Your recurring series is set up!" : "Your appointment is booked." });
    setTimeout(() => setLocation("/client/dashboard"), 3500);
  };

  const steps = [
    { num: 1, title: "Service",  icon: Scissors,     completed: !!selectedServiceId },
    { num: 2, title: "Stylist",  icon: UserIcon,     completed: !!selectedStaffId },
    { num: 3, title: "Date",     icon: CalendarIcon, completed: true },
    { num: 4, title: "Confirm",  icon: CheckCircle2, completed: step > 4 },
    { num: 5, title: "Payment",  icon: CreditCard,   completed: succeeded },
  ];
  const visibleStep = Math.min(step, 5);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-8">Book an Appointment</h1>

        {/* Progress steps */}
        <div className="flex justify-between relative mb-12">
          <div className="absolute top-5 left-0 w-full h-0.5 bg-white/8 -z-10" />
          <div className="absolute top-5 left-0 h-0.5 bg-primary -z-10 transition-all duration-500" style={{ width: `${((visibleStep - 1) / 4) * 100}%` }} />
          {steps.map(s => (
            <div key={s.num} className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                visibleStep >= s.num ? "bg-primary text-white shadow-[0_0_15px_rgba(201,149,106,0.4)]" : "bg-[#131D33] text-white/30 border border-white/8"
              }`}>
                <s.icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${visibleStep >= s.num ? "text-white" : "text-white/30"}`}>{s.title}</span>
            </div>
          ))}
        </div>

        <Card className="bg-[#0A0F1D] border-white/5">
          <CardContent className="p-8">
            <AnimatePresence mode="wait">

              {/* Step 1 — Service */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-2xl font-bold mb-6">Select a Service</h2>
                  {servicesLoading ? <p className="text-white/40">Loading services…</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {services?.map(service => (
                        <div
                          key={service.id}
                          onClick={() => setSelectedServiceId(service.id)}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                            selectedServiceId === service.id
                              ? "border-primary bg-primary/10 shadow-[0_0_20px_-5px_rgba(201,149,106,0.3)]"
                              : "border-white/8 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{service.name}</h3>
                            {service.category === "HIGH_VALUE" && <Badge variant="warning">Deposit Required</Badge>}
                          </div>
                          <p className="text-sm text-white/50 mb-4 line-clamp-2">{service.description || "Premium salon service."}</p>
                          <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-white/70">{service.durationMinutes} mins</span>
                            <span className="text-primary">{formatCurrency(service.basePrice)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-8 flex justify-end">
                    <Button disabled={!selectedServiceId} onClick={() => setStep(2)}>
                      Next Step <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 2 — Stylist */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-2xl font-bold mb-6">Select a Stylist</h2>
                  {staffLoading ? <p className="text-white/40">Loading staff…</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {staff?.map(person => (
                        <div
                          key={person.id}
                          onClick={() => setSelectedStaffId(person.id)}
                          className={`p-5 rounded-2xl border text-center transition-all cursor-pointer ${
                            selectedStaffId === person.id
                              ? "border-primary bg-primary/10 shadow-[0_0_20px_-5px_rgba(201,149,106,0.3)]"
                              : "border-white/8 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <div className="w-20 h-20 mx-auto rounded-full bg-white/5 border border-white/10 mb-4 overflow-hidden flex items-center justify-center">
                            {person.profileImageUrl
                              ? <img src={person.profileImageUrl} alt="staff" className="w-full h-full object-cover" />
                              : <span className="text-2xl font-bold text-white/40">{person.firstName?.charAt(0)}</span>
                            }
                          </div>
                          <h3 className="font-bold text-lg">{person.firstName} {person.lastName}</h3>
                          <p className="text-sm text-primary mt-1">Master Stylist</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-8 flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                    <Button disabled={!selectedStaffId} onClick={() => setStep(3)}>
                      Next Step <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 3 — Date & Time */}
              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-2xl font-bold mb-6">Select Date & Time</h2>
                  <div className="p-8 border border-white/8 rounded-2xl text-center bg-white/[0.02] mb-8">
                    <CalendarIcon className="w-12 h-12 mx-auto text-primary mb-4" />
                    <h3 className="text-xl font-bold mb-2">Date selected</h3>
                    <p className="text-primary text-lg">Tomorrow at 10:00 AM</p>
                  </div>

                  {/* No slots — waitlist option */}
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 mb-4">
                    <div className="flex items-start gap-3 mb-4">
                      <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-300">Preferred time not available?</p>
                        <p className="text-sm text-amber-300/60 mt-0.5">Join the waitlist and we'll notify you when a matching slot opens up.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">Preferred Day</label>
                        <select
                          value={preferredDay ?? ""}
                          onChange={e => setPreferredDay(e.target.value === "" ? null : parseInt(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
                        >
                          <option value="">Any day</option>
                          {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d, i) => (
                            <option key={d} value={i}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">Preferred Time</label>
                        <select
                          value={preferredTime}
                          onChange={e => setPreferredTime(e.target.value as any)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
                        >
                          <option value="MORNING">Morning (9am–12pm)</option>
                          <option value="AFTERNOON">Afternoon (12pm–4pm)</option>
                          <option value="EVENING">Evening (4pm–7pm)</option>
                        </select>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-2"
                      onClick={() => {
                        if (!selectedServiceId) { toast.error("Please select a service first"); setStep(1); return; }
                        joinWaitlist.mutate();
                      }}
                      isLoading={joinWaitlist.isPending}
                      disabled={joinedWaitlist}
                    >
                      <RefreshCw className="w-4 h-4" />
                      {joinedWaitlist ? "You're on the waitlist!" : "Join Waitlist Instead"}
                    </Button>
                  </div>

                  <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                    <Button onClick={() => setStep(4)}>
                      Continue with this slot <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 4 — Confirm */}
              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-2xl font-bold mb-6">Confirm Your Appointment</h2>
                  <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-6 mb-6">
                    <div className="flex justify-between items-start mb-6 pb-6 border-b border-white/5">
                      <div>
                        <h3 className="text-xl font-bold">{selectedService?.name}</h3>
                        <p className="text-white/50 mt-1">with {selectedStaff?.firstName}</p>
                        <p className="text-white mt-3 font-medium">Tomorrow at 10:00 AM</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-display font-bold text-primary">{formatCurrency(selectedService?.basePrice ?? 0)}</span>
                        <p className="text-sm text-white/50 mt-1">{selectedService?.durationMinutes} mins</p>
                      </div>
                    </div>
                    {selectedService?.category === "HIGH_VALUE" && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                        <h4 className="font-bold text-amber-400 mb-1">Deposit Required</h4>
                        <p className="text-sm text-amber-300/80">
                          This premium service requires a {(selectedService as any).depositPercent}% deposit to secure your booking.
                        </p>
                      </div>
                    )}

                    {/* ── Recurring appointment toggle ── */}
                    <div className={`rounded-2xl border transition-all ${enableRecurring ? "border-primary/30 bg-primary/5" : "border-white/8 bg-white/[0.02]"} p-4 mb-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <Repeat2 className={`w-5 h-5 ${enableRecurring ? "text-primary" : "text-white/30"}`} />
                          <div>
                            <p className="font-semibold text-sm">Make this a recurring appointment</p>
                            <p className="text-xs text-white/40 mt-0.5">Auto-book at the same time on a regular schedule</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setEnableRecurring(v => !v)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${enableRecurring ? "bg-primary" : "bg-white/10"}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enableRecurring ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>

                      {enableRecurring && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/8">
                          <div>
                            <label className="text-xs text-white/50 mb-1.5 block">Frequency</label>
                            <select
                              value={recurringFreq}
                              onChange={e => setRecurringFreq(e.target.value as any)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
                            >
                              <option value="weekly">Weekly</option>
                              <option value="biweekly">Every 2 weeks</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-white/50 mb-1.5 block">Repeat until</label>
                            <input
                              type="date"
                              value={recurringEndDate}
                              min={new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]}
                              onChange={e => setRecurringEndDate(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-xs text-primary/70">
                              We'll automatically create {recurringFreq === "weekly" ? "weekly" : recurringFreq === "biweekly" ? "bi-weekly" : "monthly"} appointments until {recurringEndDate}.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-white/30">By confirming, you agree to our 48-hour cancellation policy.</p>
                  </div>
                  <div className="mt-4 flex justify-between">
                    <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
                    <Button onClick={handleConfirmAndPay} isLoading={isCreating} className="px-8 gap-2">
                      <CreditCard className="w-4 h-4" /> Confirm & Pay
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 5 — Payment */}
              {step === 5 && createdAppointment && clientSecret && (
                stripePromise ? (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
                    <PaymentForm
                      appointment={createdAppointment} clientSecret={clientSecret}
                      isMockMode={isMockMode} onSuccess={handlePaymentSuccess} onBack={() => setStep(4)}
                    />
                  </Elements>
                ) : (
                  <PaymentForm
                    appointment={createdAppointment} clientSecret={clientSecret}
                    isMockMode={true} onSuccess={handlePaymentSuccess} onBack={() => setStep(4)}
                  />
                )
              )}

              {/* Step 6 — Success */}
              {step === 6 && (
                <motion.div key="step6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
                  <div className="relative inline-block mb-6">
                    <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                    <div className="relative w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                  </div>
                  <h2 className="text-3xl font-display font-bold text-white mb-3">You're all set!</h2>
                  <p className="text-white/50 mb-2">
                    {enableRecurring
                      ? `Your ${recurringFreq} recurring appointments have been scheduled.`
                      : "Your appointment has been confirmed and payment received."}
                  </p>
                  {enableRecurring && (
                    <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 mt-2 mb-3">
                      <Repeat2 className="w-4 h-4 text-primary" />
                      <span className="text-sm text-primary">Repeating {recurringFreq} until {recurringEndDate}</span>
                    </div>
                  )}
                  <p className="text-sm text-white/30">Redirecting to your dashboard…</p>
                </motion.div>
              )}

            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
