"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChatMessage, CitedProduct } from "@/types";
import { formatPrice } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send,
  Bot,
  User,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  MessageCircle,
  X,
} from "lucide-react";

const initialMessages: ChatMessage[] = [
  {
    id: "init-welcome",
    role: "assistant",
    content: "Xin chào! Mình là trợ lý AI mua sắm e-Amora. Mình có thể giúp gì cho bạn hôm nay?",
    timestamp: new Date().toISOString(),
  },
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMessageText = input.trim();
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: userMessageText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("http://localhost:8000/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "user-session-123",
          message: userMessageText,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();

      const citedProducts: CitedProduct[] = Array.isArray(data.products)
        ? data.products.map((p: any) => ({
            id: String(p.id ?? ""),
            name: p.name ?? "",
            price: typeof p.price === "number" ? p.price : Number(p.price) || 0,
            thumbnailUrl: p.imageUrl || "",
          }))
        : [];

      const botMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: data.answer || "Không có câu trả lời từ hệ thống.",
        groundednessScore: typeof data.groundedness_score === "number" ? data.groundedness_score : undefined,
        citedProducts: citedProducts.length > 0 ? citedProducts : undefined,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: "Đã xảy ra lỗi khi kết nối với máy chủ AI. Vui lòng thử lại sau!",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Khung chat nổi */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[calc(100vw-3rem)] sm:w-96 h-[500px] shadow-2xl border rounded-xl overflow-hidden flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 shadow-sm shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">AI Assistant</span>
                  <Badge className="bg-gradient-brand text-white border-0 text-[9px] px-1.5 py-0 h-4">RAG</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">Tư vấn mua sắm e-Amora</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body chat / Danh sách tin nhắn */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4">
            <div
              className="space-y-4"
              role="log"
              aria-label="Lịch sử cuộc trò chuyện"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback
                      className={
                        msg.role === "assistant"
                          ? "bg-gradient-to-br from-violet-500 to-indigo-500 text-white"
                          : "bg-primary text-primary-foreground"
                      }
                    >
                      {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "items-end" : ""}`}>
                    <div
                      className={`rounded-2xl p-3 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-md"
                          : "bg-muted rounded-tl-md text-foreground"
                      }`}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: msg.content
                            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                            .replace(/\n/g, "<br/>"),
                        }}
                      />
                    </div>
                    {msg.citedProducts && msg.citedProducts.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {msg.citedProducts.map((cp) => (
                          <Link key={cp.id} href={`/products/${cp.id}`}>
                            <Card className="flex items-center gap-2 p-1.5 pr-2 hover:shadow-md transition-shadow cursor-pointer">
                              <div className="w-8 h-8 rounded-md overflow-hidden bg-muted/50 shrink-0">
                                {cp.thumbnailUrl ? (
                                  <Image
                                    src={cp.thumbnailUrl}
                                    alt={cp.name}
                                    width={32}
                                    height={32}
                                    className="h-full w-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center bg-muted text-[8px] text-muted-foreground select-none text-center leading-none">
                                    No Image
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-medium truncate">{cp.name}</p>
                                <p className="text-[9px] text-primary font-bold">{formatPrice(cp.price)}</p>
                              </div>
                              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                            </Card>
                          </Link>
                        ))}
                      </div>
                    )}
                    {msg.groundednessScore && (
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Độ tin cậy: {Math.round(msg.groundednessScore * 100)}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2.5" role="status" aria-label="Trợ lý đang nhập">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                      <Bot className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-2xl rounded-tl-md p-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Footer input */}
          <CardContent className="p-3 border-t bg-background">
            <div className="flex gap-1.5 items-end">
              <Textarea
                aria-label="Tin nhắn cho trợ lý AI"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi AI về sản phẩm... (Enter gửi)"
                className="resize-none min-h-[38px] max-h-24 text-xs py-2 px-3"
                rows={1}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                aria-label="Gửi tin nhắn"
                className="bg-gradient-brand text-white hover:opacity-90 shrink-0 h-[38px] w-[38px]"
                size="icon"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-1.5 text-[9px] text-muted-foreground text-center flex items-center justify-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> RAG AI Assistant
            </p>
          </CardContent>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <Button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-brand text-white shadow-xl hover:scale-105 transition-transform flex items-center justify-center p-0"
        aria-label={isOpen ? "Đóng AI Chat" : "Mở AI Chat"}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </Button>
    </>
  );
}
