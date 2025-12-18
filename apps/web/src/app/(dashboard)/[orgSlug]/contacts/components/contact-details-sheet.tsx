"use client";

import { Edit, Mail, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CONTACT_STATUS_COLORS,
  CONTACT_STATUS_LABELS,
  type ContactWithMeta,
} from "@/lib/contacts";

type ContactDetailsSheetProps = {
  contact: ContactWithMeta | null;
  onClose: () => void;
  onEdit: () => void;
  open: boolean;
  userRole: "owner" | "admin" | "member";
};

export function ContactDetailsSheet({
  contact,
  onClose,
  onEdit,
  open,
  userRole,
}: ContactDetailsSheetProps) {
  if (!contact) return null;

  const canEdit = userRole === "owner" || userRole === "admin";
  const subscribedTopics =
    contact.topics?.filter((t) => t.status === "subscribed") || [];

  // Calculate engagement rates
  const openRate =
    contact.emailsSent > 0
      ? ((contact.emailsOpened / contact.emailsSent) * 100).toFixed(1)
      : "0";
  const clickRate =
    contact.emailsSent > 0
      ? ((contact.emailsClicked / contact.emailsSent) * 100).toFixed(1)
      : "0";

  return (
    <Sheet onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact Details
          </SheetTitle>
          <SheetDescription>{contact.email}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status and Actions */}
          <div className="flex items-center justify-between">
            <Badge
              className={CONTACT_STATUS_COLORS[contact.status]}
              variant="secondary"
            >
              {CONTACT_STATUS_LABELS[contact.status]}
            </Badge>
            {canEdit && (
              <Button onClick={onEdit} size="sm" variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>

          <Separator />

          {/* Engagement Stats */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 font-medium text-sm">
              <TrendingUp className="h-4 w-4" />
              Engagement
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-3 text-center">
                <div className="font-bold text-2xl">{contact.emailsSent}</div>
                <div className="text-muted-foreground text-xs">Emails Sent</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="font-bold text-2xl">{contact.emailsOpened}</div>
                <div className="text-muted-foreground text-xs">
                  Opens ({openRate}%)
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="font-bold text-2xl">{contact.emailsClicked}</div>
                <div className="text-muted-foreground text-xs">
                  Clicks ({clickRate}%)
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Subscribed Topics */}
          <div>
            <h3 className="mb-3 font-medium text-sm">Subscribed Topics</h3>
            {subscribedTopics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subscribedTopics.map((t) => (
                  <Badge key={t.topicId} variant="outline">
                    {t.topicName}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No topic subscriptions
              </p>
            )}
          </div>

          <Separator />

          {/* Properties */}
          {Object.keys(contact.properties).length > 0 && (
            <>
              <div>
                <h3 className="mb-3 font-medium text-sm">Custom Properties</h3>
                <div className="space-y-2">
                  {Object.entries(contact.properties).map(([key, value]) => (
                    <div
                      className="flex items-center justify-between rounded-lg border p-2"
                      key={key}
                    >
                      <span className="font-medium text-muted-foreground text-sm">
                        {key}
                      </span>
                      <span className="text-sm">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Activity Timeline */}
          <div>
            <h3 className="mb-3 font-medium text-sm">Activity</h3>
            <div className="space-y-2 text-sm">
              {contact.lastEmailClickedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last clicked</span>
                  <span>
                    {new Date(contact.lastEmailClickedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {contact.lastEmailOpenedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last opened</span>
                  <span>
                    {new Date(contact.lastEmailOpenedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {contact.lastEmailSentAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last email sent</span>
                  <span>
                    {new Date(contact.lastEmailSentAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {contact.lastActivityAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last activity</span>
                  <span>
                    {new Date(contact.lastActivityAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(contact.createdAt).toLocaleDateString()}</span>
              </div>
              {contact.createdBy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created by</span>
                  <span>{contact.createdBy.name || contact.createdBy.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Timestamps */}
          {(contact.unsubscribedAt ||
            contact.bouncedAt ||
            contact.complainedAt) && (
            <>
              <Separator />
              <div>
                <h3 className="mb-3 font-medium text-sm">Status Changes</h3>
                <div className="space-y-2 text-sm">
                  {contact.confirmedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confirmed</span>
                      <span>
                        {new Date(contact.confirmedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {contact.unsubscribedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unsubscribed</span>
                      <span>
                        {new Date(contact.unsubscribedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {contact.bouncedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bounced</span>
                      <span>
                        {new Date(contact.bouncedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {contact.complainedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Complained</span>
                      <span>
                        {new Date(contact.complainedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
