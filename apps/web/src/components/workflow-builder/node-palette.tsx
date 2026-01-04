"use client";

import type { WorkflowStepType } from "@wraps/db";
import {
  Bell,
  Clock,
  GitBranch,
  Hourglass,
  LogOut,
  Mail,
  MailOpen,
  MessageSquare,
  UserCog,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NodePaletteItem = {
  type: WorkflowStepType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
};

const paletteItems: NodePaletteItem[] = [
  {
    type: "trigger",
    label: "Trigger",
    description: "Start workflow",
    icon: <Zap className="h-4 w-4" />,
    accentColor: "bg-yellow-500",
  },
  {
    type: "send_email",
    label: "Send Email",
    description: "Send an email",
    icon: <Mail className="h-4 w-4" />,
    accentColor: "bg-blue-500",
  },
  {
    type: "send_sms",
    label: "Send SMS",
    description: "Send a text message",
    icon: <MessageSquare className="h-4 w-4" />,
    accentColor: "bg-green-500",
  },
  {
    type: "delay",
    label: "Delay",
    description: "Wait before continuing",
    icon: <Clock className="h-4 w-4" />,
    accentColor: "bg-purple-500",
  },
  {
    type: "condition",
    label: "Condition",
    description: "Branch Yes/No",
    icon: <GitBranch className="h-4 w-4" />,
    accentColor: "bg-orange-500",
  },
  {
    type: "update_contact",
    label: "Update Contact",
    description: "Modify contact data",
    icon: <UserCog className="h-4 w-4" />,
    accentColor: "bg-indigo-500",
  },
  // Webhook node disabled until delivery retry/verification is implemented
  // {
  //   type: "webhook",
  //   label: "Webhook",
  //   description: "Call external API",
  //   icon: <Webhook className="h-4 w-4" />,
  //   accentColor: "bg-cyan-500",
  // },
  // Slice 3 nodes
  {
    type: "wait_for_event",
    label: "Wait for Event",
    description: "Wait until event occurs",
    icon: <Hourglass className="h-4 w-4" />,
    accentColor: "bg-amber-500",
  },
  {
    type: "wait_for_email_engagement",
    label: "Email Engagement",
    description: "Wait for open/click",
    icon: <MailOpen className="h-4 w-4" />,
    accentColor: "bg-purple-500",
  },
  {
    type: "subscribe_topic",
    label: "Topic",
    description: "Manage subscription",
    icon: <Bell className="h-4 w-4" />,
    accentColor: "bg-emerald-500",
  },
  {
    type: "exit",
    label: "Exit",
    description: "End workflow",
    icon: <LogOut className="h-4 w-4" />,
    accentColor: "bg-red-500",
  },
];

type NodePaletteProps = {
  onAddNode: (type: WorkflowStepType) => void;
};

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const onDragStart = (event: React.DragEvent, nodeType: WorkflowStepType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="absolute top-4 left-4 z-10 w-48 rounded-lg border bg-background p-3 shadow-sm">
      <div className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Nodes
      </div>
      <div className="space-y-2">
        {paletteItems.map((item) => (
          <div
            className={cn(
              "flex cursor-grab items-center gap-3 rounded-md border p-2",
              "transition-colors hover:border-border hover:bg-muted/50",
              "active:cursor-grabbing"
            )}
            draggable
            key={item.type}
            onClick={() => onAddNode(item.type)}
            onDragStart={(e) => onDragStart(e, item.type)}
          >
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded text-white",
                item.accentColor
              )}
            >
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground text-sm">
                {item.label}
              </div>
              <div className="truncate text-muted-foreground text-xs">
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
