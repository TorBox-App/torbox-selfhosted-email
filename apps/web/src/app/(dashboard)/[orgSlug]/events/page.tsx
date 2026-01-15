import { auth } from "@wraps/auth";
import { redirect } from "next/navigation";
import { getEventNames, listEvents } from "@/actions/events";
import { getOrganizationWithMembership } from "@/lib/organization";
import { EventsTable } from "./components/events-table";

type EventsPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    eventName?: string;
    contactEmail?: string;
    dateFrom?: string;
    dateTo?: string;
    datePreset?: string;
  }>;
};

export default async function EventsPage({
  params,
  searchParams,
}: EventsPageProps) {
  const { orgSlug } = await params;
  const {
    page = "1",
    pageSize = "50",
    search,
    eventName,
    contactEmail,
    dateFrom,
    dateTo,
    datePreset,
  } = await searchParams;

  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session?.user) {
    redirect("/auth");
  }

  const orgWithMembership = await getOrganizationWithMembership(
    orgSlug,
    session.user.id
  );

  if (!orgWithMembership) {
    redirect("/");
  }

  // Parse date filters
  const parsedDateFrom = dateFrom ? new Date(dateFrom) : undefined;
  const parsedDateTo = dateTo ? new Date(dateTo) : undefined;

  // Fetch events and event names in parallel
  const [eventsResult, eventNamesResult] = await Promise.all([
    listEvents(orgWithMembership.id, {
      page: Number.parseInt(page, 10),
      pageSize: Number.parseInt(pageSize, 10),
      search,
      eventName,
      contactEmail,
      dateFrom: parsedDateFrom,
      dateTo: parsedDateTo,
    }),
    getEventNames(orgWithMembership.id),
  ]);

  const events = eventsResult.success ? eventsResult.events : [];
  const total = eventsResult.success ? eventsResult.total : 0;
  const eventNames = eventNamesResult.success
    ? eventNamesResult.eventNames
    : [];

  return (
    <>
      {/* Page Title and Description */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-2xl tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            Track custom events from your application
          </p>
        </div>
      </div>

      {/* Events Table */}
      <div className="@container/main px-4 lg:px-6">
        <EventsTable
          datePreset={datePreset}
          eventNames={eventNames}
          events={events}
          organizationId={orgWithMembership.id}
          orgSlug={orgSlug}
          page={Number.parseInt(page, 10)}
          pageSize={Number.parseInt(pageSize, 10)}
          total={total}
        />
      </div>
    </>
  );
}
