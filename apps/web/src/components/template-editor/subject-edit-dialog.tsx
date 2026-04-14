"use client";

import type { EmailType } from "@wraps/db";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wraps/ui/components/ui/dialog";
import { Label } from "@wraps/ui/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@wraps/ui/components/ui/radio-group";
import { Textarea } from "@wraps/ui/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@wraps/ui/components/ui/tooltip";
import { Info } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubjectEditDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  previewText: string;
  emailType?: EmailType;
  onSave: (subject: string, previewText: string, emailType: EmailType) => void;
};

export function SubjectEditDialog({
  isOpen,
  onClose,
  subject,
  previewText,
  emailType = "marketing",
  onSave,
}: SubjectEditDialogProps) {
  const [localSubject, setLocalSubject] = useState(subject);
  const [localPreviewText, setLocalPreviewText] = useState(previewText);
  const [localEmailType, setLocalEmailType] = useState<EmailType>(emailType);

  // Sync with props when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLocalSubject(subject);
      setLocalPreviewText(previewText);
      setLocalEmailType(emailType);
    }
  }, [isOpen, subject, previewText, emailType]);

  const handleSave = useCallback(() => {
    onSave(localSubject, localPreviewText, localEmailType);
    onClose();
  }, [localSubject, localPreviewText, localEmailType, onSave, onClose]);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Email Details</DialogTitle>
          <DialogDescription>
            Set the subject line, preview text, and email type for your
            template.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              onChange={(e) => setLocalSubject(e.target.value)}
              placeholder="Enter email subject line"
              value={localSubject}
            />
            <p className="text-muted-foreground text-xs">
              Use {"{{variableName}}"} to insert dynamic content
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="previewText">Preview Text</Label>
            <Textarea
              className="resize-none"
              id="previewText"
              onChange={(e) => setLocalPreviewText(e.target.value)}
              placeholder="Brief text shown in inbox preview"
              rows={2}
              value={localPreviewText}
            />
            <p className="text-muted-foreground text-xs">
              This text appears in email clients before the email is opened
            </p>
          </div>
          <div className="grid gap-2">
            <TooltipProvider>
              <Label className="flex items-center gap-1.5">
                Email Type
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p>
                      Marketing emails include unsubscribe links and headers for
                      compliance. Transactional emails (like password resets)
                      don&apos;t require unsubscribe options.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </Label>
            </TooltipProvider>
            <RadioGroup
              className="grid grid-cols-2 gap-3"
              onValueChange={(v) => setLocalEmailType(v as EmailType)}
              value={localEmailType}
            >
              <Label
                className="flex cursor-pointer flex-col gap-1 rounded-lg border p-3 [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                htmlFor="marketing"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="marketing" value="marketing" />
                  <span className="font-medium text-sm">Marketing</span>
                </div>
                <span className="text-muted-foreground text-xs">
                  Newsletters, promotions, updates
                </span>
              </Label>
              <Label
                className="flex cursor-pointer flex-col gap-1 rounded-lg border p-3 [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                htmlFor="transactional"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="transactional" value="transactional" />
                  <span className="font-medium text-sm">Transactional</span>
                </div>
                <span className="text-muted-foreground text-xs">
                  Password resets, receipts, alerts
                </span>
              </Label>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
