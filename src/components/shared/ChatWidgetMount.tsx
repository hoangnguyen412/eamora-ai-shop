"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Chat widget không nằm trong LCP và chỉ hữu ích khi người dùng bấm mở.
// Tách khỏi bundle ban đầu và chỉ mount sau khi trang rảnh.
const ChatWidget = dynamic(() => import("@/components/shared/ChatWidget"), {
  ssr: false,
});

export default function ChatWidgetMount() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idleId = window.requestIdleCallback?.(
      () => setReady(true),
      { timeout: 2000 }
    );

    if (idleId !== undefined) {
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timeoutId);
  }, []);

  if (!ready) return null;
  return <ChatWidget />;
}
