import { auth } from "@wraps/auth";
import { awsAccount, db, segment, template, topic } from "@wraps/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getWorkflow } from "@/actions/workflows";
import { WorkflowBuilder } from "@/components/workflow-builder/workflow-builder";
import { getOrganizationWithMembership } from "@/lib/organization";

type WorkflowBuilderPageProps = {
  params: Promise<{
    orgSlug: string;
    workflowId: string;
  }>;
};

export default async function WorkflowBuilderPage({
  params,
}: WorkflowBuilderPageProps) {
  const { orgSlug, workflowId } = await params;

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

  // Fetch workflow
  const workflowResult = await getWorkflow(workflowId, orgWithMembership.id);

  if (!workflowResult.success) {
    redirect(`/${orgSlug}/automations`);
  }

  // Fetch templates for the properties panel
  const templates = await db.query.template.findMany({
    where: eq(template.organizationId, orgWithMembership.id),
    columns: {
      id: true,
      name: true,
      subject: true,
      status: true,
    },
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });

  // Fetch AWS accounts
  const awsAccounts = await db.query.awsAccount.findMany({
    where: eq(awsAccount.organizationId, orgWithMembership.id),
    columns: {
      id: true,
      name: true,
      region: true,
    },
  });

  // Fetch topics for workflow triggers and topic actions
  const topics = await db.query.topic.findMany({
    where: eq(topic.organizationId, orgWithMembership.id),
    columns: {
      id: true,
      name: true,
    },
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  // Fetch segments for workflow triggers
  const segments = await db.query.segment.findMany({
    where: eq(segment.organizationId, orgWithMembership.id),
    columns: {
      id: true,
      name: true,
    },
    orderBy: (s, { asc }) => [asc(s.name)],
  });

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col">
      <WorkflowBuilder
        workflow={workflowResult.workflow}
        organizationId={orgWithMembership.id}
        orgSlug={orgSlug}
        templates={templates}
        topics={topics}
        segments={segments}
        awsAccounts={awsAccounts}
        userRole={orgWithMembership.userRole}
      />
    </div>
  );
}
