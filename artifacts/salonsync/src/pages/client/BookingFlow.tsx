import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useListServices, useListUsers, useCreateAppointment } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { CheckCircle2, ChevronRight, User as UserIcon, Calendar as CalendarIcon, Scissors } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

export function BookingFlow() {
  const [step, setStep] = useState(1);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const locationId = "1"; // Default location for prototype
  
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  // Mocking date/time selection for prototype
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(Date.now() + 86400000 * 2)); 
  
  const { data: services, isLoading: servicesLoading } = useListServices({ locationId });
  const { data: staff, isLoading: staffLoading } = useListUsers({ role: 'STAFF', locationId });
  
  const { mutateAsync: createAppointment, isPending } = useCreateAppointment();

  const selectedService = services?.find(s => s.id === selectedServiceId);
  const selectedStaff = staff?.find(s => s.id === selectedStaffId);

  const handleConfirm = async () => {
    if (!selectedServiceId || !selectedStaffId || !user?.id) return;
    
    try {
      await createAppointment({
        data: {
          locationId,
          clientId: user.id,
          staffId: selectedStaffId,
          serviceIds: [selectedServiceId],
          startTime: selectedDate.toISOString(),
          notes: "Booked via client portal"
        }
      });
      toast.success("Appointment Confirmed!", {
        description: "We look forward to seeing you.",
      });
      setLocation("/client/dashboard");
    } catch (err) {
      toast.error("Failed to book appointment", {
        description: "Please try again later."
      });
    }
  };

  const steps = [
    { num: 1, title: "Service", icon: Scissors, completed: !!selectedServiceId },
    { num: 2, title: "Stylist", icon: UserIcon, completed: !!selectedStaffId },
    { num: 3, title: "Date & Time", icon: CalendarIcon, completed: true },
    { num: 4, title: "Confirm", icon: CheckCircle2, completed: false },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-8">Book an Appointment</h1>
        
        {/* Progress Bar */}
        <div className="flex justify-between relative mb-12">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -z-10" />
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-primary -z-10 transition-all duration-500"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          />
          {steps.map((s) => (
            <div key={s.num} className="flex flex-col items-center gap-2">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  step >= s.num ? 'bg-primary text-white shadow-[0_0_15px_rgba(201,149,106,0.5)]' : 'bg-[#131D33] text-muted-foreground border border-white/10'
                }`}
              >
                <s.icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${step >= s.num ? 'text-white' : 'text-muted-foreground'}`}>{s.title}</span>
            </div>
          ))}
        </div>

        <Card className="bg-[#0A0F1D] border-white/5">
          <CardContent className="p-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-2xl font-bold mb-6">Select a Service</h2>
                  {servicesLoading ? (
                    <p className="text-muted-foreground">Loading services...</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {services?.map(service => (
                        <div 
                          key={service.id}
                          onClick={() => setSelectedServiceId(service.id)}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                            selectedServiceId === service.id 
                              ? 'border-primary bg-primary/10 shadow-[0_0_20px_-5px_rgba(201,149,106,0.3)]' 
                              : 'border-white/10 bg-[#131D33]/50 hover:border-white/20'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{service.name}</h3>
                            {service.category === 'HIGH_VALUE' && <Badge variant="warning">Deposit Required</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{service.description || 'Premium salon service.'}</p>
                          <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-white">{service.durationMinutes} mins</span>
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

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-2xl font-bold mb-6">Select a Stylist</h2>
                  {staffLoading ? (
                    <p className="text-muted-foreground">Loading staff...</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {staff?.map(person => (
                        <div 
                          key={person.id}
                          onClick={() => setSelectedStaffId(person.id)}
                          className={`p-5 rounded-2xl border text-center transition-all cursor-pointer ${
                            selectedStaffId === person.id 
                              ? 'border-primary bg-primary/10 shadow-[0_0_20px_-5px_rgba(201,149,106,0.3)]' 
                              : 'border-white/10 bg-[#131D33]/50 hover:border-white/20'
                          }`}
                        >
                          <div className="w-20 h-20 mx-auto rounded-full bg-white/5 border border-white/10 mb-4 overflow-hidden">
                            {person.profileImageUrl ? (
                                <img src={person.profileImageUrl} alt="staff" className="w-full h-full object-cover"/>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/50">{person.firstName?.charAt(0)}</div>
                            )}
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

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-2xl font-bold mb-6">Select Date & Time</h2>
                  {/* Mock calendar for prototype speed */}
                  <div className="p-8 border border-white/10 rounded-2xl text-center bg-[#131D33]/50 mb-8">
                     <CalendarIcon className="w-12 h-12 mx-auto text-primary mb-4" />
                     <h3 className="text-xl font-bold mb-2">Date selected</h3>
                     <p className="text-primary text-lg">Tomorrow at 10:00 AM</p>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                    <Button onClick={() => setStep(4)}>
                      Next Step <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-2xl font-bold mb-6">Confirm Your Appointment</h2>
                  
                  <div className="bg-[#131D33]/50 border border-white/10 rounded-2xl p-6 mb-8">
                    <div className="flex justify-between items-start mb-6 pb-6 border-b border-white/5">
                      <div>
                        <h3 className="text-xl font-bold">{selectedService?.name}</h3>
                        <p className="text-muted-foreground mt-1">with {selectedStaff?.firstName}</p>
                        <p className="text-white mt-3 font-medium">Tomorrow at 10:00 AM</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-display font-bold text-primary">{formatCurrency(selectedService?.basePrice || 0)}</span>
                        <p className="text-sm text-muted-foreground mt-1">{selectedService?.durationMinutes} mins</p>
                      </div>
                    </div>
                    
                    {selectedService?.category === 'HIGH_VALUE' && (
                      <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-6">
                        <h4 className="font-bold text-warning mb-1">Deposit Required</h4>
                        <p className="text-sm text-warning/80">This premium service requires a {selectedService.depositPercent}% deposit to secure your booking. Cancellation within 48 hours will forfeit this deposit.</p>
                      </div>
                    )}
                    
                    <div className="text-sm text-muted-foreground">
                      By confirming, you agree to our 48-hour cancellation policy.
                    </div>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
                    <Button onClick={handleConfirm} isLoading={isPending} className="px-8">
                      Confirm & Pay
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
