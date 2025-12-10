"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SubjectEditDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  previewText: string;
  onSave: (subject: string, previewText: string) => void;
};

export function SubjectEditDialog({
  isOpen,
  onClose,
  subject,
  previewText,
  onSave,
}: SubjectEditDialogProps) {
  const [localSubject, setLocalSubject] = useState(subject);
  const [localPreviewText, setLocalPreviewText] = useState(previewText);

  // Sync with props when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLocalSubject(subject);
      setLocalPreviewText(previewText);
    }
  }, [isOpen, subject, previewText]);

  const handleSave = useCallback(() => {
    onSave(localSubject, localPreviewText);
    onClose();
  }, [localSubject, localPreviewText, onSave, onClose]);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Email Details</DialogTitle>
          <DialogDescription>
            Set the subject line and preview text for your email template.
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
