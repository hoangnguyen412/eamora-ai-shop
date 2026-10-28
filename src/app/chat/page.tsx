"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import mockData from "@/mocks/db.json";
import { ChatMessage, CitedProduct } from "@/types";
import { formatPrice } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Sparkles, ShieldCheck, ExternalLink } from "lucide-react";

const initialMessages = mockData.chatHistory as unknown as ChatMessage[];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`, role: "user", content: input.trim(), timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`, role: "assistant",
        content: "Cảm ơn bạn đã hỏi! Mình có thể giúp bạn:\n\n• **So sánh** các sản phẩm công nghệ\n• **Tư vấn** laptop/điện thoại theo nhu cầu & ngân sách\n• **Tra cứu** thông số kỹ thuật chi tiết\n• **Theo dõi giá** với Price Agent\n\nBạn muốn tìm hiểu về sản phẩm nào?",
        groundednessScore: 0.88, timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            AI Shopping Assistant
            <Badge className="bg-gradient-brand text-white border-0 text-[10px]">RAG</Badge>
          </h1>
          <p className="text-xs text-muted-foreground">Tư vấn sản phẩm thông minh với trích dẫn sản phẩm thực tế</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={msg.role === "assistant" ? "bg-gradient-to-br from-violet-500 to-indigo-500 text-white" : "bg-primary text-primary-foreground"}>
                    {msg.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[80%] space-y-3 ${msg.role === "user" ? "items-end" : ""}`}>
                  <div className={`rounded-2xl p-4 text-sm leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-md" : "bg-muted rounded-tl-md"}`}>
                    <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />
                  </div>
                  {msg.citedProducts && msg.citedProducts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msg.citedProducts.map((cp) => (
                        <Link key={cp.id} href={`/products/${cp.id}`}>
                          <Card className="flex items-center gap-2 p-2 pr-3 hover:shadow-md transition-shadow cursor-pointer">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted/50 shrink-0">
                              <Image src={cp.thumbnailUrl} alt={cp.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                            </div>
                            <div>
                              <p className="text-[11px] font-medium line-clamp-1">{cp.name}</p>
                              <p className="text-[10px] text-primary font-bold">{formatPrice(cp.price)}</p>
                            </div>
                            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                  {msg.groundednessScore && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" />
                      Độ tin cậy: {Math.round(msg.groundednessScore * 100)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-500 text-white"><Bot className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl rounded-tl-md p-4">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <CardContent className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Hỏi AI về sản phẩm công nghệ... (Enter để gửi)" className="resize-none min-h-[44px] max-h-32" rows={1} />
            <Button onClick={handleSend} disabled={!input.trim() || isTyping} className="bg-gradient-brand text-white hover:opacity-90 shrink-0" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3" /> Powered by RAG AI — Trích dẫn sản phẩm thực từ cơ sở dữ liệu
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
