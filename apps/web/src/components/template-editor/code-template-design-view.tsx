"use client";

import { Code2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CodeTemplateDesignViewProps = {
  onSwitchToCode: () => void;
};

export function CodeTemplateDesignView({
  onSwitchToCode,
}: CodeTemplateDesignViewProps) {
  return (
    <div className="flex h-full items-center justify-center bg-muted/50">
      <div className="w-full max-w-lg px-6 text-center">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <div className="mb-2 flex items-center justify-center gap-2">
            <h2 className="font-semibold text-xl">AI Email Designer</h2>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
          <p className="mx-auto max-w-sm text-muted-foreground text-sm">
            An AI that understands the full React Email component spec —
            brand-aware, able to generate and edit templates from natural
            language.
          </p>
        </div>

        <Button className="gap-2" onClick={onSwitchToCode} variant="outline">
          <Code2 className="h-4 w-4" />
          View Code & Preview
        </Button>
      </div>
    </div>
  );
}
