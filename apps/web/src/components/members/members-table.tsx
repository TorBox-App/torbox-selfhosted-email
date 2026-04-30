"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@wraps/ui/components/ui/alert-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@wraps/ui/components/ui/avatar";
import { Badge } from "@wraps/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wraps/ui/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wraps/ui/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import {
  CreditCard,
  Eye,
  Megaphone,
  MoreVertical,
  Shield,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import type { MemberWithUser } from "@/actions/members";
import { removeMember } from "@/actions/members";
import { Button } from "@/components/ui/button";
import { ChangeRoleDialog } from "./change-role-dialog";

type MembersTableProps = {
  members: MemberWithUser[];
  organizationId: string;
  organizationSlug: string;
  userRole: string;
  onMemberUpdated: () => void;
};

export function MembersTable({
  members,
  organizationId,
  organizationSlug,
  userRole,
  onMemberUpdated,
}: MembersTableProps) {
  const [selectedMember, setSelectedMember] = useState<MemberWithUser | null>(
    null
  );
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<MemberWithUser | null>(
    null
  );

  const canManageMembers = userRole === "owner" || userRole === "admin";

  const roleConfig: Record<
    string,
    { icon: React.ReactNode; variant: "default" | "secondary" | "outline" }
  > = {
    owner: { icon: <Shield className="mr-1 h-3 w-3" />, variant: "default" },
    admin: { icon: <UserCog className="mr-1 h-3 w-3" />, variant: "secondary" },
    member: { icon: <Users className="mr-1 h-3 w-3" />, variant: "outline" },
    marketing: {
      icon: <Megaphone className="mr-1 h-3 w-3" />,
      variant: "outline",
    },
    "read-only": { icon: <Eye className="mr-1 h-3 w-3" />, variant: "outline" },
    billing: {
      icon: <CreditCard className="mr-1 h-3 w-3" />,
      variant: "outline",
    },
  };

  const getRoleLabel = (role: string) =>
    role === "read-only"
      ? "Read Only"
      : role.charAt(0).toUpperCase() + role.slice(1);

  const handleRemoveMember = async () => {
    if (!memberToRemove) {
      return;
    }

    setRemovingMemberId(memberToRemove.id);
    const result = await removeMember(memberToRemove.id, organizationId);

    if (result.success) {
      toast.success("Member removed successfully");
      onMemberUpdated();
    } else {
      toast.error(result.error);
    }

    setRemovingMemberId(null);
    setMemberToRemove(null);
  };

  const handleChangeRole = (member: MemberWithUser) => {
    setSelectedMember(member);
    setIsRoleDialogOpen(true);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {canManageMembers && <TableHead className="w-[50px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      alt={member.user.name}
                      src={member.user.image || undefined}
                    />
                    <AvatarFallback className="text-xs">
                      {getInitials(member.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">
                      {member.user.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {member.user.email}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  className="flex w-fit items-center"
                  variant={
                    (roleConfig[member.role] ?? roleConfig.member).variant
                  }
                >
                  {(roleConfig[member.role] ?? roleConfig.member).icon}
                  {getRoleLabel(member.role)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(member.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
              {canManageMembers && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="h-8 w-8" size="icon" variant="ghost">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(userRole === "owner" ||
                        (userRole === "admin" && member.role !== "owner")) && (
                        <DropdownMenuItem
                          onClick={() => handleChangeRole(member)}
                        >
                          <UserCog className="mr-2 h-4 w-4" />
                          Change Role
                        </DropdownMenuItem>
                      )}
                      {(userRole === "owner" ||
                        (userRole === "admin" && member.role !== "owner")) && (
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={removingMemberId === member.id}
                          onClick={() => setMemberToRemove(member)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Remove Member
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
          {members.length === 0 && (
            <TableRow>
              <TableCell
                className="text-center text-muted-foreground"
                colSpan={canManageMembers ? 4 : 3}
              >
                No members found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {selectedMember && (
        <ChangeRoleDialog
          isOpen={isRoleDialogOpen}
          member={selectedMember}
          onOpenChange={setIsRoleDialogOpen}
          onRoleChanged={onMemberUpdated}
          organizationId={organizationId}
          userRole={userRole}
        />
      )}

      <AlertDialog
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        open={!!memberToRemove}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {memberToRemove?.user.name} from the
              organization. They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              variant="destructive"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
