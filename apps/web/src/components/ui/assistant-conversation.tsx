"use client";

import { Avatar, AvatarFallback } from "@wraps/ui/components/ui/avatar";
import type { UIMessage } from "ai";
import { Bot, Loader2, User } from "lucide-react";
import type { ReactNode } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ui/reasoning";
import { cn } from "@/lib/utils";

type AssistantConversationProps = {
  messages: UIMessage[];
  isLoading: boolean;
  loadingLabel?: string;
  className?: string;
  // Panel-specific assistant-text renderer (e.g. JSON/TSX code-block
  // stripping). Receives whether this specific text part is still streaming.
  // Defaults to rendering the text verbatim when omitted.
  renderAssistantText?: (text: string, isStreaming: boolean) => ReactNode;
  // Rendered inside the scroller when there are no messages yet. Each panel
  // owns its own empty state (limit reached, welcome, quick prompts, etc.).
  emptyState?: ReactNode;
};

// Helper to get concatenated text content from a message
function getMessageText(message: UIMessage) {
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text"
    )
    .map((part) => part.text)
    .join("");
}

export function AssistantConversation({
  messages,
  isLoading,
  loadingLabel = "Generating...",
  className,
  renderAssistantText,
  emptyState,
}: AssistantConversationProps) {
  // A part is still streaming if it's the last part of the last message and
  // generation is in progress.
  const isPartStreaming = (message: UIMessage, partIndex: number) =>
    isLoading &&
    partIndex === message.parts.length - 1 &&
    message.id === messages.at(-1)?.id;

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller className={cn("min-h-0 flex-1", className)}>
        <MessageScrollerViewport>
          <MessageScrollerContent className="p-3">
            {messages.length === 0 ? (
              emptyState
            ) : (
              <>
                {messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    <Message align={message.role === "user" ? "end" : "start"}>
                      <MessageAvatar>
                        <Avatar className="h-6 w-6">
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
                      </MessageAvatar>
                      <MessageContent>
                        {message.role === "assistant" ? (
                          message.parts.map((part, partIndex) => {
                            if (part.type === "reasoning") {
                              const streaming = isPartStreaming(
                                message,
                                partIndex
                              );
                              return (
                                <Reasoning
                                  defaultOpen={streaming}
                                  isStreaming={streaming}
                                  key={`${message.id}-${partIndex}`}
                                >
                                  <ReasoningTrigger />
                                  <ReasoningContent>
                                    {part.text}
                                  </ReasoningContent>
                                </Reasoning>
                              );
                            }

                            if (part.type === "text") {
                              const streaming = isPartStreaming(
                                message,
                                partIndex
                              );
                              return (
                                <Bubble
                                  align="start"
                                  key={`${message.id}-${partIndex}`}
                                  variant="muted"
                                >
                                  <BubbleContent>
                                    {renderAssistantText
                                      ? renderAssistantText(
                                          part.text,
                                          streaming
                                        )
                                      : part.text}
                                  </BubbleContent>
                                </Bubble>
                              );
                            }

                            return null;
                          })
                        ) : (
                          <Bubble align="end" variant="default">
                            <BubbleContent>
                              {getMessageText(message)}
                            </BubbleContent>
                          </Bubble>
                        )}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}

                {isLoading && messages.at(-1)?.role === "user" && (
                  <Marker role="status">
                    <MarkerIcon>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </MarkerIcon>
                    <MarkerContent>{loadingLabel}</MarkerContent>
                  </Marker>
                )}
              </>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
