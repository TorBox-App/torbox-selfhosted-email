"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText("https://wraps.dev/why-wraps");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button className="mt-4" onClick={copyUrl} size="sm" variant="outline">
      <Copy className="mr-2 size-4" />
      {copied ? "Copied!" : "Copy link to share"}
    </Button>
  );
}
