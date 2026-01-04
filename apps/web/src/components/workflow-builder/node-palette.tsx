"use client";

import type { WorkflowStepType } from "@wraps/db";
import { Clock, LogOut, Mail, MessageSquare, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface NodePaletteItem {
  type: WorkflowStepType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
}

const paletteItems: NodePaletteItem[] = [
  {
    type: "trigger",
    label: "Trigger",
    description: "Start workflow",
    icon: <Zap className="w-4 h-4" />,
    accentColor: "bg-yellow-500",
  },
  {
    type: "send_email",
    label: "Send Email",
    description: "Send an email",
    icon: <Mail className="w-4 h-4" />,
    accentColor: "bg-blue-500",
  },
  {
    type: "send_sms",
    label: "Send SMS",
    description: "Send a text message",
    icon: <MessageSquare className="w-4 h-4" />,
    accentColor: "bg-green-500",
  },
  {
    type: "delay",
    label: "Delay",
    description: "Wait before continuing",
    icon: <Clock className="w-4 h-4" />,
    accentColor: "bg-purple-500",
  },
  {
    type: "exit",
    label: "Exit",
    description: "End workflow",
    icon: <LogOut className="w-4 h-4" />,
    accentColor: "bg-red-500",
  },
];

interface NodePaletteProps {
  onAddNode: (type: WorkflowStepType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const onDragStart = (
    event: React.DragEvent,
    nodeType: WorkflowStepType
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="absolute left-4 top-4 z-10 bg-white rounded-lg border shadow-sm p-3 w-48">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        Nodes
      </div>
      <div className="space-y-2">
        {paletteItems.map((item) => (
          <div
            key={item.type}
            className={cn(
              "flex items-center gap-3 p-2 rounded-md border cursor-grab",
              "hover:bg-gray-50 hover:border-gray-300 transition-colors",
              "active:cursor-grabbing"
            )}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            onClick={() => onAddNode(item.type)}
          >
            <div
              className={cn(
                "w-7 h-7 rounded flex items-center justify-center text-white",
                item.accentColor
              )}
            >
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">
                {item.label}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
