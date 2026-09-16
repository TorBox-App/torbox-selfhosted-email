"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@wraps/ui/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wraps/ui/components/ui/tabs";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { statusBadge } from "@/components/agent-approval-queue";
import { Button } from "@/components/ui/button";
import type { ApprovalWithMeta } from "@/lib/agents";

type AgentApprovalDetailSheetProps = {
  approval: ApprovalWithMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  pending: boolean;
  onDecision: (
    approval: ApprovalWithMeta,
    decision: "approve" | "reject"
  ) => void;
};

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 font-medium text-muted-foreground">
        {label}
      </span>
      <span className="break-all">{children}</span>
    </div>
  );
}

export function AgentApprovalDetailSheet({
  approval,
  open,
  onOpenChange,
  canManage,
  pending,
  onDecision,
}: AgentApprovalDetailSheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        {approval && (
          <ApprovalDetailBody
            approval={approval}
            canManage={canManage}
            onDecision={onDecision}
            pending={pending}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ApprovalDetailBody({
  approval,
  canManage,
  pending,
  onDecision,
}: {
  approval: ApprovalWithMeta;
  canManage: boolean;
  pending: boolean;
  onDecision: (
    approval: ApprovalWithMeta,
    decision: "approve" | "reject"
  ) => void;
}) {
  const hasHtml =
    typeof approval.payload.html === "string" && approval.payload.html !== "";
  const hasText =
    typeof approval.payload.text === "string" && approval.payload.text !== "";

  const tabs: { value: string; label: string }[] = [];
  if (hasHtml) tabs.push({ value: "preview", label: "Preview" });
  if (hasText) tabs.push({ value: "text", label: "Plain text" });
  if (hasHtml) tabs.push({ value: "source", label: "Source" });
  const defaultTab = hasHtml ? "preview" : "text";

  return (
    <>
      <SheetHeader>
        <SheetTitle>{approval.payload.subject || "(no subject)"}</SheetTitle>
        <SheetDescription className="flex items-center gap-2">
          <span>{approval.agentName || "Unknown agent"}</span>
          {statusBadge(approval.status)}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-2 px-4 text-sm">
        <MetaRow label="From">{approval.payload.from}</MetaRow>
        <MetaRow label="To">{approval.payload.to}</MetaRow>
        {approval.payload.replyTo && (
          <MetaRow label="Reply-To">{approval.payload.replyTo}</MetaRow>
        )}
        <MetaRow label="Reason">{approval.reason || "—"}</MetaRow>
        <MetaRow label="Created">
          {new Date(approval.createdAt).toLocaleString()}
        </MetaRow>
        {approval.status === "FAILED" && approval.errorMessage && (
          <MetaRow label="Error">
            <span className="text-destructive">{approval.errorMessage}</span>
          </MetaRow>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tabs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No message body</p>
        ) : (
          <Tabs defaultValue={defaultTab} key={approval.id}>
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {hasHtml && (
              <TabsContent value="preview">
                <iframe
                  className="h-[60vh] w-full rounded-md border bg-card"
                  referrerPolicy="no-referrer"
                  sandbox=""
                  srcDoc={approval.payload.html}
                  title="Message preview"
                />
              </TabsContent>
            )}
            {hasText && (
              <TabsContent value="text">
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-4 font-mono text-sm">
                  {approval.payload.text}
                </pre>
              </TabsContent>
            )}
            {hasHtml && (
              <TabsContent value="source">
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-4 font-mono text-sm">
                  {approval.payload.html}
                </pre>
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
      {canManage && approval.status === "PENDING" && (
        <SheetFooter className="flex-row justify-end gap-2">
          <Button
            disabled={pending}
            onClick={() => onDecision(approval, "reject")}
            size="sm"
            variant="outline"
          >
            Reject
          </Button>
          <Button
            disabled={pending}
            onClick={() => onDecision(approval, "approve")}
            size="sm"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
          </Button>
        </SheetFooter>
      )}
    </>
  );
}
