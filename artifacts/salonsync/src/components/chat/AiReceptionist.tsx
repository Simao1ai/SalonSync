import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Sparkles, Send } from "lucide-react";
import { useCreateAnthropicConversation } from "@workspace/api-client-react";
import { useChatStream } from "@/hooks/use-chat-stream";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

export function AiReceptionist() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  
  const { mutateAsync: createConversation } = useCreateAnthropicConversation();
  const { messages, sendMessage, isLoading, setMessages } = useChatStream();
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const startChat = async () => {
    if (!conversationId) {
      try {
        const chat = await createConversation({ data: { title: "Receptionist Help" } });
        setConversationId(chat.id);
        setMessages([{
          role: 'assistant',
          content: "Hello! I'm your SalonSync AI assistant. How can I help you today? I can help you find services, check stylist availability, or answer questions about our location."
        }]);
      } catch (error) {
        console.error("Failed to start chat", error);
      }
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !conversationId || isLoading) return;
    const msg = input.trim();
    setInput("");
    await sendMessage(conversationId, msg);
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startChat}
            className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-r from-primary to-[#b38055] text-white shadow-[0_0_30px_-5px_rgba(201,149,106,0.6)] flex items-center justify-center z-50 hover:shadow-[0_0_40px_-5px_rgba(201,149,106,0.8)] transition-shadow"
          >
            <Sparkles className="w-7 h-7" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-8 right-8 w-[380px] h-[600px] max-h-[80vh] glass-panel rounded-2xl flex flex-col overflow-hidden z-50 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="p-4 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-white leading-tight">AI Receptionist</h3>
                  <p className="text-xs text-primary">Always online</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-white transition-colors p-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={idx} 
                  className={cn(
                    "max-w-[85%] rounded-2xl p-3 text-sm",
                    msg.role === 'user' 
                      ? "ml-auto bg-primary text-primary-foreground rounded-tr-sm" 
                      : "mr-auto bg-[#1a233a] border border-white/5 text-white rounded-tl-sm"
                  )}
                >
                  {msg.content}
                </motion.div>
              ))}
              {isLoading && (
                <div className="mr-auto bg-[#1a233a] border border-white/5 text-white rounded-2xl rounded-tl-sm p-4 w-16 flex items-center justify-center gap-1.5">
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 h-1.5 bg-primary rounded-full" />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-primary rounded-full" />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-primary rounded-full" />
                </div>
              )}
              <div ref={endOfMessagesRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 bg-[#0A0F1D] border-t border-white/5">
              <div className="relative flex items-center">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="pr-12 bg-background/50 border-white/10"
                  disabled={isLoading}
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 p-2 text-primary hover:text-white disabled:opacity-50 disabled:hover:text-primary transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
