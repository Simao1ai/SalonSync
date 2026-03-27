import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Info, AlertTriangle, AlertCircle, Bell, X } from "lucide-react";

export function AnnouncementsBanner() {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const { data: announcements } = useQuery<Array<{
    id: number;
    title: string;
    message: string;
    type: string;
    createdAt: string;
  }>>({
    queryKey: ["tenant-announcements"],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const sid = sessionStorage.getItem("__salonsync_dev_sid__");
      if (sid) headers["Authorization"] = `Bearer ${sid}`;
      const r = await fetch("/api/announcements", { headers });
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 60000,
  });

  const visible = announcements?.filter(a => !dismissed.has(a.id)) ?? [];
  if (visible.length === 0) return null;

  const typeStyles: Record<string, { bg: string; border: string; icon: typeof Info; iconColor: string }> = {
    info: { bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Info, iconColor: "text-blue-400" },
    warning: { bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle, iconColor: "text-amber-400" },
    alert: { bg: "bg-red-500/10", border: "border-red-500/20", icon: AlertCircle, iconColor: "text-red-400" },
    update: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Bell, iconColor: "text-emerald-400" },
  };

  return (
    <div className="space-y-3 mb-6">
      <AnimatePresence>
        {visible.slice(0, 3).map(ann => {
          const style = typeStyles[ann.type] || typeStyles.info;
          const Icon = style.icon;
          return (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className={`${style.bg} border ${style.border} rounded-xl p-4 flex items-start gap-3`}
            >
              <Icon className={`w-5 h-5 ${style.iconColor} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{ann.title}</p>
                <p className="text-xs text-white/60 mt-0.5">{ann.message}</p>
              </div>
              <button
                onClick={() => setDismissed(prev => new Set(prev).add(ann.id))}
                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
