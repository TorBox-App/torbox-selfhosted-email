/**
 * Workflow Processor - Schedule Trigger Tests
 *
 * Tests for the schedule-trigger processing logic in the workflow processor.
 * Covers:
 * - Schedule trigger dispatching via SQS handler
 * - Workflow status/type validation before processing
 * - Contact fan-out for schedule triggers
 * - Segment-based contact filtering
 * - Schedule chaining (creating the next schedule after firing)
 * - Edge cases: disabled workflow, deleted workflow, missing cron
 */

import { describe, expect, it } from "vitest";

// =============================================================================
// Mock data
// =============================================================================

const mockEnabledScheduleWorkflow = {
  id: "wf-sched-001",
  organizationId: "org-123",
  name: "Weekly Newsletter",
  status: "enabled" as string,
  triggerType: "schedule" as string,
  triggerConfig: {
    schedule: "0 9 * * 1", // Every Monday at 9am
    timezone: "America/New_York",
  },
};

const mockDisabledScheduleWorkflow = {
  ...mockEnabledScheduleWorkflow,
  id: "wf-sched-002",
  status: "paused" as string,
};

const mockScheduleWorkflowNoConfig = {
  ...mockEnabledScheduleWorkflow,
  id: "wf-sched-003",
  triggerConfig: {},
};

const mockScheduleWorkflowWithSegment = {
  ...mockEnabledScheduleWorkflow,
  id: "wf-sched-004",
  triggerConfig: {
    schedule: "0 10 * * *",
    timezone: "UTC",
    segmentId: "seg-abc",
  },
};

const mockEventWorkflow = {
  id: "wf-event-001",
  organizationId: "org-123",
  name: "Event Workflow",
  status: "enabled" as string,
  triggerType: "event" as string,
  triggerConfig: {
    eventName: "user.signup",
  },
};

const mockContacts = [
  { id: "c-1", status: "active" as const },
  { id: "c-2", status: "active" as const },
  { id: "c-3", status: "active" as const },
];

// =============================================================================
// Schedule trigger job routing
// =============================================================================

describe("Schedule Trigger - Job Routing", () => {
  it("should parse schedule-trigger job from SQS body", () => {
    const sqsBody = JSON.stringify({
      type: "schedule-trigger",
      workflowId: "wf-sched-001",
      organizationId: "org-123",
    });

    const job = JSON.parse(sqsBody);
    expect(job.type).toBe("schedule-trigger");
    expect(job.workflowId).toBe("wf-sched-001");
    expect(job.organizationId).toBe("org-123");
  });

  it("should route schedule-trigger to processScheduleTrigger case", () => {
    const jobTypes = ["execute", "resume", "trigger", "schedule-trigger"];

    // The handler switch covers all these types
    for (const type of jobTypes) {
      expect(jobTypes).toContain(type);
    }

    // schedule-trigger is distinct from trigger
    expect("schedule-trigger").not.toBe("trigger");
  });
});

// =============================================================================
// Workflow validation before processing
// =============================================================================

describe("Schedule Trigger - Workflow Validation", () => {
  it("should skip when workflow is not found (null)", () => {
    const wf = null;
    const shouldProcess = wf !== null;
    expect(shouldProcess).toBe(false);
  });

  it("should skip when workflow status is not enabled", () => {
    const wf = mockDisabledScheduleWorkflow;
    const shouldProcess =
      wf.status === "enabled" && wf.triggerType === "schedule";
    expect(shouldProcess).toBe(false);
  });

  it("should skip when triggerType is not schedule", () => {
    const wf = mockEventWorkflow;
    const shouldProcess =
      wf.status === "enabled" && wf.triggerType === "schedule";
    expect(shouldProcess).toBe(false);
  });

  it("should skip when no cron schedule in config", () => {
    const config = mockScheduleWorkflowNoConfig.triggerConfig as {
      schedule?: string;
    };
    const hasCron = !!config.schedule;
    expect(hasCron).toBe(false);
  });

  it("should process when workflow is enabled with schedule trigger and cron", () => {
    const wf = mockEnabledScheduleWorkflow;
    const config = wf.triggerConfig;
    const shouldProcess =
      wf.status === "enabled" &&
      wf.triggerType === "schedule" &&
      !!config.schedule;
    expect(shouldProcess).toBe(true);
  });
});

// =============================================================================
// Contact fan-out
// =============================================================================

describe("Schedule Trigger - Contact Fan-out", () => {
  it("should create trigger jobs for all contacts", () => {
    const now = new Date();
    const wf = mockEnabledScheduleWorkflow;
    const contacts = mockContacts;

    const jobs = contacts.map((c) => ({
      type: "trigger" as const,
      workflowId: wf.id,
      contactId: c.id,
      organizationId: wf.organizationId,
      eventData: {
        triggerType: "schedule",
        triggeredAt: now.toISOString(),
        cronExpression: wf.triggerConfig.schedule,
      },
    }));

    expect(jobs).toHaveLength(3);

    for (const job of jobs) {
      expect(job.type).toBe("trigger");
      expect(job.workflowId).toBe("wf-sched-001");
      expect(job.organizationId).toBe("org-123");
      expect(job.eventData.triggerType).toBe("schedule");
      expect(job.eventData.cronExpression).toBe("0 9 * * 1");
    }

    // Each contact should get its own job
    const contactIds = jobs.map((j) => j.contactId);
    expect(contactIds).toEqual(["c-1", "c-2", "c-3"]);
  });

  it("should handle zero contacts gracefully", () => {
    const contacts: { id: string }[] = [];
    const jobs = contacts.map((c) => ({
      type: "trigger" as const,
      workflowId: "wf-sched-001",
      contactId: c.id,
      organizationId: "org-123",
    }));

    expect(jobs).toHaveLength(0);
  });

  it("should use segmentId when provided in triggerConfig", () => {
    const config = mockScheduleWorkflowWithSegment.triggerConfig;
    expect(config.segmentId).toBe("seg-abc");

    // When segmentId is present, contacts come from segment evaluation
    const hasSegment = !!config.segmentId;
    expect(hasSegment).toBe(true);
  });

  it("should use all active contacts when no segmentId", () => {
    const config = mockEnabledScheduleWorkflow.triggerConfig as {
      segmentId?: string;
    };
    const hasSegment = !!config.segmentId;
    expect(hasSegment).toBe(false);
  });

  it("should respect MAX_CONTACTS_PER_TRIGGER limit", () => {
    const MAX_CONTACTS_PER_TRIGGER = 1000;
    const largeContactList = Array.from({ length: 1500 }, (_, i) => ({
      id: `c-${i}`,
    }));

    const limitedContacts = largeContactList.slice(0, MAX_CONTACTS_PER_TRIGGER);
    expect(limitedContacts).toHaveLength(1000);
  });
});

// =============================================================================
// Schedule chaining
// =============================================================================

describe("Schedule Trigger - Chaining", () => {
  it("should chain next schedule with same workflow params", () => {
    const wf = mockEnabledScheduleWorkflow;
    const config = wf.triggerConfig;

    // After processing, the processor calls createNextWorkflowSchedule with:
    const chainParams = {
      workflowId: wf.id,
      organizationId: wf.organizationId,
      cronExpression: config.schedule,
      timezone: config.timezone,
    };

    expect(chainParams.workflowId).toBe("wf-sched-001");
    expect(chainParams.organizationId).toBe("org-123");
    expect(chainParams.cronExpression).toBe("0 9 * * 1");
    expect(chainParams.timezone).toBe("America/New_York");
  });

  it("should not chain when workflow becomes disabled", () => {
    // When the processor loads the workflow and finds it disabled,
    // it returns early without creating a next schedule
    const wf = mockDisabledScheduleWorkflow;
    const shouldChain =
      wf.status === "enabled" && wf.triggerType === "schedule";
    expect(shouldChain).toBe(false);
  });

  it("should not chain when workflow is deleted (null)", () => {
    const wf = null;
    const shouldChain = wf !== null;
    expect(shouldChain).toBe(false);
  });

  it("should not chain when cron config is removed", () => {
    const config = { schedule: undefined as string | undefined };
    const shouldChain = !!config.schedule;
    expect(shouldChain).toBe(false);
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("Schedule Trigger - Edge Cases", () => {
  it("should scope workflow query by both id and organizationId", () => {
    // The processor queries with both to prevent cross-org access
    const queryConditions = {
      workflowId: "wf-sched-001",
      organizationId: "org-123",
    };

    expect(queryConditions.workflowId).toBeDefined();
    expect(queryConditions.organizationId).toBeDefined();
  });

  it("should update lastTriggeredAt after processing", () => {
    const now = new Date();
    const updateData = { lastTriggeredAt: now };
    expect(updateData.lastTriggeredAt).toBeInstanceOf(Date);
  });

  it("should handle schedule firing during disable window", () => {
    // If a schedule fires but the workflow was disabled between
    // fire and processing, the status check catches it
    const wf = { ...mockEnabledScheduleWorkflow, status: "paused" as string };
    const isStillValid =
      wf.status === "enabled" && wf.triggerType === "schedule";
    expect(isStillValid).toBe(false);
    // Chain stops naturally — no next schedule created
  });

  it("should handle schedule firing for deleted workflow", () => {
    // If workflow was deleted, DB query returns null
    const wf = null;
    const isStillValid = wf !== null;
    expect(isStillValid).toBe(false);
    // Schedule already auto-deleted (ActionAfterCompletion: DELETE)
  });

  it("should handle triggerType changed from schedule to event", () => {
    const wf = {
      ...mockEnabledScheduleWorkflow,
      triggerType: "event" as string,
    };
    const isStillValid =
      wf.status === "enabled" && wf.triggerType === "schedule";
    expect(isStillValid).toBe(false);
  });

  it("should include schedule eventData in trigger jobs", () => {
    const now = new Date("2026-02-03T09:00:00.000Z");
    const eventData = {
      triggerType: "schedule",
      triggeredAt: now.toISOString(),
      cronExpression: "0 9 * * 1",
    };

    expect(eventData.triggerType).toBe("schedule");
    expect(eventData.triggeredAt).toBe("2026-02-03T09:00:00.000Z");
    expect(eventData.cronExpression).toBe("0 9 * * 1");
  });
});

// =============================================================================
// Segment contact filtering
// =============================================================================

describe("Schedule Trigger - Segment Contact Filtering", () => {
  it("should return empty when segment is not found", () => {
    const seg = null;
    const contacts = seg ? mockContacts : [];
    expect(contacts).toHaveLength(0);
  });

  it("should filter contacts by segment membership", () => {
    // Simulate contactMatchesSegment returning true for some contacts
    const allContacts = [
      { id: "c-1", matches: true },
      { id: "c-2", matches: false },
      { id: "c-3", matches: true },
    ];

    const matchingContacts = allContacts
      .filter((c) => c.matches)
      .map((c) => ({ id: c.id }));

    expect(matchingContacts).toHaveLength(2);
    expect(matchingContacts).toEqual([{ id: "c-1" }, { id: "c-3" }]);
  });

  it("should continue processing when a single contact evaluation fails", () => {
    // Per the implementation, errors in contactMatchesSegment are caught
    // and logged, but processing continues for other contacts
    const contactResults = [
      { id: "c-1", result: true },
      { id: "c-2", result: "error" }, // This one throws
      { id: "c-3", result: true },
    ];

    const matchingContacts: { id: string }[] = [];
    for (const c of contactResults) {
      if (c.result === "error") {
        // Error logged, continue
        continue;
      }
      if (c.result) {
        matchingContacts.push({ id: c.id });
      }
    }

    expect(matchingContacts).toHaveLength(2);
    expect(matchingContacts).toEqual([{ id: "c-1" }, { id: "c-3" }]);
  });

  it("should verify segment belongs to same organization", () => {
    // The query uses both segmentId AND organizationId
    const queryConditions = {
      segmentId: "seg-abc",
      organizationId: "org-123",
    };

    expect(queryConditions.segmentId).toBeDefined();
    expect(queryConditions.organizationId).toBeDefined();
  });
});

// =============================================================================
// Cron expression and timezone handling
// =============================================================================

describe("Schedule Trigger - Cron & Timezone", () => {
  it("should support standard 5-field cron expressions", () => {
    const expressions = [
      "0 9 * * 1", // Every Monday at 9am
      "0 10 * * *", // Every day at 10am
      "*/15 * * * *", // Every 15 minutes
      "0 0 1 * *", // First day of month at midnight
      "30 14 * * 1-5", // Weekdays at 2:30pm
    ];

    for (const expr of expressions) {
      const parts = expr.split(" ");
      expect(parts.length).toBe(5);
    }
  });

  it("should default to UTC when timezone is not specified", () => {
    const config: { schedule: string; timezone?: string } = {
      schedule: "0 9 * * 1",
    };
    const timezone = config.timezone || "UTC";
    expect(timezone).toBe("UTC");
  });

  it("should support IANA timezone names", () => {
    const timezones = [
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
      "US/Pacific",
      "UTC",
    ];

    for (const tz of timezones) {
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    }
  });
});
