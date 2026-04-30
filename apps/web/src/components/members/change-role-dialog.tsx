"use client";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wraps/ui/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import type { MemberWithUser } from "@/actions/members";
import { updateMemberRole } from "@/actions/members";
import { Button } from "@/components/ui/button";
import { PRESET_ROLES } from "@/lib/preset-roles";

type ChangeRoleDialogProps = {
  member: MemberWithUser;
  organizationId: string;
  userRole: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleChanged: () => void;
};

export function ChangeRoleDialog({
  member,
  organizationId,
  userRole,
  isOpen,
  onOpenChange,
  onRoleChanged,
}: ChangeRoleDialogProps) {
  const [newRole, setNewRole] = useState<string>(member.role);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSubmit = async () => {
    if (newRole === member.role) {
      toast.error("Please select a different role");
      return;
    }

    setIsUpdating(true);
    const result = await updateMemberRole(member.id, newRole, organizationId);

    if (result.success) {
      toast.success("Member role updated successfully");
      onRoleChanged();
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }

    setIsUpdating(false);
  };

  const builtInRoles =
    userRole === "owner" ? ["owner", "admin", "member"] : ["admin", "member"];
  const availableRoles = [...builtInRoles, ...PRESET_ROLES.map((r) => r.name)];

  return (
    <Dialog onOpenChange={onOpenChange} open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Member Role</DialogTitle>
          <DialogDescription>
            Update the role for {member.user.name} ({member.user.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select onValueChange={setNewRole} value={newRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => {
                  const preset = PRESET_ROLES.find((r) => r.name === role);
                  const label = preset
                    ? preset.label
                    : role.charAt(0).toUpperCase() + role.slice(1);
                  return (
                    <SelectItem key={role} value={role}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {newRole === "owner" &&
                "Owners have full control over the organization"}
              {newRole === "admin" &&
                "Admins can manage members and settings but cannot delete the organization"}
              {newRole === "member" &&
                "Members have read-only access to the organization"}
              {PRESET_ROLES.find((r) => r.name === newRole)?.description}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={isUpdating}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={isUpdating} onClick={handleSubmit}>
            {isUpdating ? "Updating..." : "Update Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
