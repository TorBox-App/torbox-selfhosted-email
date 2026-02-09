"use client";

import { useChat } from "@ai-sdk/react";
import { useThrottler } from "@tanstack/react-pacer";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import {
  AlertTriangle,
  Bot,
  Check,
  Heart,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  User,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ui/reasoning";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getAiUsageQueryKey, useAiUsage } from "@/hooks/use-ai-usage";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { useBrandKits } from "@/hooks/use-brand-kit-queries";
import { extractTsxCode } from "@/lib/ai/extract-tsx-code";
import { cn } from "@/lib/utils";
import { useTemplateStore } from "@/stores/template-store";
import { AIAttachmentChips } from "./ai-attachment-chips";
import {
  AIImageUrlPopover,
  type ImageAttachment,
} from "./ai-image-url-popover";

type CodeTemplateAIPanelProps = {
  orgSlug: string;
  templateId: string;
  currentSource: string;
  onApply: (source: string, compiledHtml: string) => void;
};

const QUICK_PROMPTS = [
  { label: "Welcome Email", prompt: "Create a welcome email for new users" },
  {
    label: "Password Reset",
    prompt: "Create a password reset email with a reset button",
  },
  {
    label: "Newsletter",
    prompt: "Create a newsletter template with multiple sections",
  },
  {
    label: "Order Confirmation",
    prompt: "Create an order confirmation email with order details",
  },
  { label: "Promotional", prompt: "Create a promotional email for a sale" },
];

const FAVORITE_PROMPTS_KEY = "wraps:ai:code:favorite-prompts";

type FavoritePrompt = {
  id: string;
  label: string;
  prompt: string;
};

function useFavoritePrompts() {
  const [favorites, setFavorites] = useState<FavoritePrompt[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITE_PROMPTS_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const saveFavorite = useCallback((prompt: string) => {
    const newFavorite: FavoritePrompt = {
      id: Date.now().toString(),
      label: prompt.slice(0, 30) + (prompt.length > 30 ? "..." : ""),
      prompt,
    };
    setFavorites((prev) => {
      const updated = [...prev, newFavorite];
      localStorage.setItem(FAVORITE_PROMPTS_KEY, JSON.stringify(updated));
      return updated;
    });
    toast.success("Prompt saved to favorites");
    return newFavorite;
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      localStorage.setItem(FAVORITE_PROMPTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { favorites, saveFavorite, removeFavorite };
}

// Extract TSX code from AI response (from ```tsx code block or raw code)
export function CodeTemplateAIPanel({
  orgSlug,
  templateId,
  currentSource,
  onApply,
}: CodeTemplateAIPanelProps) {
  const [input, setInput] = useState("");
  const [imageAttachment, setImageAttachment] =
    useState<ImageAttachment | null>(null);
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [hasShownWarningToast, setHasShownWarningToast] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 44,
    maxHeight: 360,
  });
  const queryClient = useQueryClient();

  // Fetch AI usage
  const { data: aiUsage, refetch: refetchUsage } = useAiUsage(orgSlug);

  // Favorite prompts
  const { favorites, saveFavorite, removeFavorite } = useFavoritePrompts();

  const { selectedBrandKitId } = useTemplateStore((state) => state.localState);
  const { setSelectedBrandKitId } = useTemplateStore((state) => state.actions);
  const { data: brandKits } = useBrandKits(orgSlug);

  const selectedBrandKit = useMemo(() => {
    if (!(brandKits?.length && selectedBrandKitId)) {
      return null;
    }
    return brandKits.find((kit) => kit.id === selectedBrandKitId) ?? null;
  }, [brandKits, selectedBrandKitId]);

  // Use the AI SDK's useChat hook
  const { messages, sendMessage, status, stop, regenerate, error } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/${orgSlug}/emails/templates/ai/generate-code`,
      body: {
        templateId,
        brandKitId: selectedBrandKit?.id,
        existingSource: currentSource || undefined,
        imageUrl: imageAttachment?.url,
        imageBase64: imageAttachment?.base64,
        imageMediaType: imageAttachment?.base64
          ? imageAttachment.contentType
          : undefined,
      },
    }),
    onError: (error) => {
      if (error.message?.includes("limit reached")) {
        toast.error("AI message limit reached", {
          description: "Upgrade your plan for more AI messages.",
        });
        refetchUsage();
      } else {
        toast.error("Failed to generate content", {
          description: error.message,
        });
      }
    },
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: getAiUsageQueryKey(orgSlug) });
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Throttle AI requests
  const sendMessageThrottler = useThrottler(
    (text: string) => {
      sendMessage({ text });
    },
    { wait: 5000, leading: true, trailing: false }
  );

  // Show warning toast
  useEffect(() => {
    if (aiUsage?.warning && !hasShownWarningToast) {
      toast.warning("AI Usage Warning", {
        description: aiUsage.warning,
        duration: 6000,
      });
      setHasShownWarningToast(true);
    }
  }, [aiUsage?.warning, hasShownWarningToast]);

  // Extract TSX from the latest assistant message
  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === "assistant" && !isLoading) {
      const textContent = lastMessage.parts
        .filter(
          (part): part is { type: "text"; text: string } => part.type === "text"
        )
        .map((part) => part.text)
        .join("");

      const code = extractTsxCode(textContent);
      if (code) {
        setPendingSource(code);
      }
    }
  }, [messages, isLoading]);

  // Auto-scroll
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Apply: compile first, then call onApply
  const handleApply = useCallback(async () => {
    if (!pendingSource) {
      return;
    }

    setIsCompiling(true);
    try {
      const resp = await fetch(
        `/api/${orgSlug}/emails/templates/${templateId}/compile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: pendingSource }),
        }
      );

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.message || data.error || "Compilation failed");
      }

      const { compiledHtml } = await resp.json();
      onApply(pendingSource, compiledHtml);
      setPendingSource(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Compilation failed";
      toast.error("Failed to compile generated code", {
        description: message,
      });
    } finally {
      setIsCompiling(false);
    }
  }, [pendingSource, orgSlug, templateId, onApply]);

  const handleReject = useCallback(() => {
    setPendingSource(null);
  }, []);

  const handleSendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) {
        return;
      }
      sendMessageThrottler.maybeExecute(text.trim());
      setInput("");
      setImageAttachment(null);
      adjustHeight(true);
    },
    [isLoading, sendMessageThrottler, adjustHeight]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  const getMessageText = (message: (typeof messages)[number]) =>
    message.parts
      .filter(
        (part): part is { type: "text"; text: string } => part.type === "text"
      )
      .map((part) => part.text)
      .join("");

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">AI Code Assistant</span>
          {aiUsage && aiUsage.limit !== -1 && (
            <span className="text-muted-foreground text-xs">
              ({aiUsage.current}/{aiUsage.limit})
            </span>
          )}
        </div>
        {isLoading && (
          <Button
            className="h-8 w-8 p-0"
            onClick={stop}
            size="sm"
            title="Stop generating"
            variant="ghost"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Usage Warning */}
      {aiUsage?.warning && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <p className="text-xs">{aiUsage.warning}</p>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1" ref={scrollAreaRef}>
        <div className="p-3">
          {aiUsage && aiUsage.remaining === 0 && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="mb-1 font-medium text-sm">
                Monthly Limit Reached
              </h4>
              <p className="mb-4 max-w-[200px] text-muted-foreground text-xs">
                You've used all {aiUsage.limit} AI messages this month. Upgrade
                your plan for more AI assistance.
              </p>
              <Button asChild className="h-8 text-xs" size="sm">
                <a href={`/${orgSlug}/settings/billing`}>Upgrade Plan</a>
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-3">
              <div className="py-4 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Wand2 className="h-5 w-5 text-primary" />
                </div>
                <h4 className="mb-1 font-medium text-sm">AI Code Assistant</h4>
                <p className="text-muted-foreground text-xs">
                  Describe your email to generate React Email TSX
                </p>
              </div>

              <div className="space-y-2">
                <p className="px-1 font-medium text-muted-foreground text-xs">
                  Quick prompts
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((qp) => (
                    <Button
                      className="h-7 px-2.5 text-xs"
                      key={qp.label}
                      onClick={() => handleSendMessage(qp.prompt)}
                      size="sm"
                      variant="outline"
                    >
                      {qp.label}
                    </Button>
                  ))}
                </div>
              </div>

              {favorites.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 px-1 font-medium text-muted-foreground text-xs">
                    <Heart className="h-3 w-3" />
                    Your favorites
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {favorites.map((fav) => (
                      <div className="group relative" key={fav.id}>
                        <Button
                          className="h-7 pr-6 text-xs"
                          onClick={() => handleSendMessage(fav.prompt)}
                          size="sm"
                          variant="secondary"
                        >
                          {fav.label}
                        </Button>
                        <button
                          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavorite(fav.id);
                          }}
                          type="button"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  className={cn(
                    "flex gap-2",
                    message.role === "user" && "flex-row-reverse"
                  )}
                  key={message.id}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-xs",
                        message.role === "assistant"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <Bot className="h-3 w-3" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "min-w-0 flex-1",
                      message.role === "user" && "text-right"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="space-y-2">
                        {message.parts.map((part, partIndex) => {
                          const isLastPart =
                            partIndex === message.parts.length - 1;
                          const isLastMessage =
                            message.id === messages.at(-1)?.id;
                          const isStreamingPart =
                            isLoading && isLastPart && isLastMessage;

                          if (part.type === "reasoning") {
                            return (
                              <Reasoning
                                defaultOpen={isStreamingPart}
                                isStreaming={isStreamingPart}
                                key={`${message.id}-${partIndex}`}
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            );
                          }

                          if (part.type === "text") {
                            return (
                              <div
                                className="inline-block max-w-full rounded-lg bg-muted px-2.5 py-1.5 text-xs"
                                key={`${message.id}-${partIndex}`}
                              >
                                <AssistantCodeMessage content={part.text} />
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    ) : (
                      <div className="inline-block max-w-full rounded-lg bg-primary px-2.5 py-1.5 text-primary-foreground text-xs">
                        {getMessageText(message)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && messages.at(-1)?.role === "user" && (
                <div className="flex gap-2">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1">
                    <div className="inline-block rounded-lg bg-muted px-2.5 py-1.5">
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      Generating your email code...
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="border-t bg-destructive/10 px-3 py-2">
          <p className="text-destructive text-xs">{error.message}</p>
          <Button
            className="mt-1.5 h-7"
            onClick={() => regenerate()}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {/* Pending Content Actions */}
      {pendingSource && !isLoading && !error && (
        <div className="border-t bg-muted/50 px-3 py-2">
          <p className="mb-1.5 font-medium text-xs">
            Apply generated template?
          </p>
          <div className="flex gap-1.5">
            <Button
              className="h-7 flex-1 text-xs"
              disabled={isCompiling}
              onClick={handleApply}
              size="sm"
            >
              {isCompiling ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 h-3 w-3" />
              )}
              Apply
            </Button>
            <Button
              className="h-7 flex-1 text-xs"
              disabled={isCompiling}
              onClick={handleReject}
              size="sm"
              variant="outline"
            >
              <X className="mr-1 h-3 w-3" />
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <form className="border-t p-3" onSubmit={handleSubmit}>
        <div
          className={cn(
            "relative flex flex-col rounded-xl transition-all duration-200",
            "ring-1 ring-black/10 dark:ring-white/10",
            isFocused && "ring-black/20 dark:ring-white/20"
          )}
        >
          <div>
            <Textarea
              className="w-full resize-none overflow-y-auto rounded-xl rounded-b-none border-none bg-black/5 px-3 py-2.5 text-xs leading-relaxed [field-sizing:normal] placeholder:text-muted-foreground focus-visible:ring-0 dark:bg-white/5"
              disabled={isLoading || aiUsage?.remaining === 0}
              onBlur={() => setIsFocused(false)}
              onChange={(e) => {
                setInput(e.target.value);
                adjustHeight();
              }}
              onFocus={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder={
                aiUsage?.remaining === 0
                  ? "Message limit reached"
                  : "Describe your email..."
              }
              ref={textareaRef}
              value={input}
            />
          </div>

          <div className="flex min-h-10 items-center gap-1.5 rounded-b-xl bg-black/5 px-2.5 py-1.5 dark:bg-white/5">
            <AIImageUrlPopover
              disabled={
                !!imageAttachment || isLoading || aiUsage?.remaining === 0
              }
              onAttach={setImageAttachment}
              orgSlug={orgSlug}
            />
            <AIAttachmentChips
              imageAttachment={imageAttachment}
              onRemoveBrandKit={() => setSelectedBrandKitId(null)}
              onRemoveImage={() => setImageAttachment(null)}
              selectedBrandKit={
                selectedBrandKit
                  ? {
                      name: selectedBrandKit.companyName || "Brand Kit",
                      primaryColor: selectedBrandKit.primaryColor,
                    }
                  : null
              }
            />
            <div className="flex-1" />
            {messages.length > 0 && !isLoading && (
              <Button
                className="h-7 w-7"
                disabled={aiUsage?.remaining === 0}
                onClick={() => regenerate()}
                size="icon"
                title="Regenerate"
                type="button"
                variant="ghost"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            {input.trim().length > 10 && (
              <Button
                className="h-7 w-7"
                onClick={() => saveFavorite(input.trim())}
                size="icon"
                title="Save to favorites"
                type="button"
                variant="ghost"
              >
                <Heart className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              className={cn(
                "h-7 w-7 transition-colors",
                input.trim() && !isLoading
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : ""
              )}
              disabled={!input.trim() || isLoading || aiUsage?.remaining === 0}
              size="icon"
              type="submit"
              variant={input.trim() && !isLoading ? "default" : "ghost"}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Render assistant messages, collapsing TSX code blocks
function AssistantCodeMessage({ content }: { content: string }) {
  const parts = content.split(/(```(?:tsx|typescript|ts)?[\s\S]*?```)/g);

  return (
    <div className="space-y-2 whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          return (
            <div
              className="rounded bg-background/50 px-2 py-1 text-muted-foreground text-xs"
              key={`${index}-${part.slice(0, 20)}`}
            >
              [TSX code generated]
            </div>
          );
        }
        const trimmed = part.trim();
        return trimmed ? (
          <span key={`${index}-${trimmed.slice(0, 20)}`}>{trimmed}</span>
        ) : null;
      })}
    </div>
  );
}
