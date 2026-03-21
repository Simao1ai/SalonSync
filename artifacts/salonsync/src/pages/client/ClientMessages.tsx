import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MessageInbox } from "@/components/messages/MessageInbox";
import { MessageThread } from "@/components/messages/MessageThread";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientMessages() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>();

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-60px)] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0A1020]">
        {/* Left: inbox list */}
        <div
          className={cn(
            "w-full md:w-[300px] lg:w-[320px] border-r border-white/[0.06] shrink-0 flex flex-col",
            selectedThreadId && "hidden md:flex"
          )}
        >
          <MessageInbox
            selectedThreadId={selectedThreadId}
            onSelectThread={setSelectedThreadId}
          />
        </div>

        {/* Right: thread view */}
        <div className={cn("flex-1 flex flex-col", !selectedThreadId && "hidden md:flex")}>
          {selectedThreadId ? (
            <MessageThread
              threadId={selectedThreadId}
              onBack={() => setSelectedThreadId(undefined)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-3xl bg-white/[0.04] flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7 text-white/15" />
              </div>
              <h3 className="text-sm font-semibold text-white/50 mb-1">Select a conversation</h3>
              <p className="text-xs text-white/25">Choose a message thread from the left to get started</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
