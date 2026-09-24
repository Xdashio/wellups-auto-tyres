"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface QuoteMessageComposerProps {
  onSend: (message: string) => Promise<{ success: boolean; error?: string }>;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  senderLabel?: string;
}

export function QuoteMessageComposer({
  onSend,
  placeholder = "Type your message...",
  disabled = false,
  maxLength = 2000,
  senderLabel,
}: QuoteMessageComposerProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedLength = message.trim().length;
  const isOverLimit = message.length > maxLength;
  const isEmpty = trimmedLength === 0;

  const handleSend = async () => {
    if (isEmpty || isOverLimit || disabled || sending) return;

    setSending(true);
    setError(null);

    const result = await onSend(message.trim());

    setSending(false);

    if (result.success) {
      setMessage("");
    } else {
      setError(result.error || "Failed to send message.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-2">
      {senderLabel && (
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
          {senderLabel}
        </span>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          data-testid="quote-message-input"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || sending}
          rows={1}
          className="w-full min-h-[38px] max-h-[120px] rounded-none border border-border bg-input px-3 py-2 text-sm text-foreground placeholder-muted-foreground/60 resize-none disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Message"
        />
        <Button
          data-testid="send-message-btn"
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={isEmpty || isOverLimit || disabled || sending}
          className="shrink-0 h-[38px] px-3"
          aria-label="Send message"
        >
          {sending ? (
            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex justify-between items-center">
        {error && (
          <span className="text-xs text-destructive font-medium" role="alert">
            {error}
          </span>
        )}
        {!error && <span />}
        <span
          className={`text-[10px] ${
            isOverLimit ? "text-destructive font-semibold" : "text-muted-foreground"
          }`}
        >
          {message.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
