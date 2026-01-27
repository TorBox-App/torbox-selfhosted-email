import { describe, expect, it } from "vitest";
import type { WrapsSMSConfig } from "../../../types/index.js";
import {
  calculateSMSCosts,
  formatCost,
  getSMSCostSummary,
} from "../costs.js";

describe("SMS Cost Calculation", () => {
  describe("calculateSMSCosts", () => {
    it("should calculate minimal configuration costs (simulator)", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "simulator",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 100);

      expect(costs.phoneNumber).toBeDefined();
      expect(costs.phoneNumber?.monthly).toBe(1.0); // $1/month for simulator
      expect(costs.total.perMessage).toBe(0); // Free messages for simulator
    });

    it("should calculate toll-free number costs", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 1000);

      expect(costs.phoneNumber).toBeDefined();
      expect(costs.phoneNumber?.monthly).toBe(2.0); // $2/month for toll-free
      expect(costs.total.perMessage).toBeGreaterThan(0);
      // Message cost: 1000 * ($0.0075 + $0.003 carrier fee) = $10.50
      expect(costs.total.monthly).toBeGreaterThan(10);
    });

    it("should calculate 10DLC number costs", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "10dlc",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 1000);

      expect(costs.phoneNumber).toBeDefined();
      expect(costs.phoneNumber?.monthly).toBe(2.0); // $2/month for 10DLC
      expect(costs.phoneNumber?.description).toContain("10DLC");
    });

    it("should calculate short-code number costs", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "short-code",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 1000);

      expect(costs.phoneNumber).toBeDefined();
      expect(costs.phoneNumber?.monthly).toBe(995.0); // $995/month for short code
      expect(costs.phoneNumber?.description).toContain("short code");
      // Short codes have lower per-message cost ($0.0055)
      expect(costs.total.perMessage).toBeLessThan(0.01);
    });

    it("should not include phone number cost when not configured", () => {
      const config: WrapsSMSConfig = {
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 1000);

      expect(costs.phoneNumber).toBeUndefined();
    });

    it("should calculate event tracking costs", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        eventTracking: {
          enabled: true,
          eventBridge: true,
          events: ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT"],
        },
      };

      const costs = calculateSMSCosts(config, 10_000);

      expect(costs.eventTracking).toBeDefined();
      expect(costs.eventTracking?.monthly).toBeGreaterThanOrEqual(0);
      expect(costs.eventTracking?.description).toContain("4 event types");
      expect(costs.eventTracking?.description).toContain("EventBridge");
    });

    it("should calculate event tracking costs with default event types", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        eventTracking: {
          enabled: true,
          eventBridge: true,
        },
      };

      const costs = calculateSMSCosts(config, 10_000);

      expect(costs.eventTracking).toBeDefined();
      expect(costs.eventTracking?.description).toContain("4 event types");
    });

    it("should not include event tracking costs when disabled", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        eventTracking: {
          enabled: false,
        },
      };

      const costs = calculateSMSCosts(config, 10_000);

      expect(costs.eventTracking).toBeUndefined();
    });

    it("should calculate DynamoDB history costs", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        eventTracking: {
          enabled: true,
          dynamoDBHistory: true,
          archiveRetention: "90days",
        },
      };

      const costs = calculateSMSCosts(config, 10_000);

      expect(costs.dynamoDBHistory).toBeDefined();
      expect(costs.dynamoDBHistory?.monthly).toBeGreaterThan(0);
      expect(costs.dynamoDBHistory?.description).toContain("90days");
    });

    it("should calculate tracking costs", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        tracking: {
          enabled: true,
        },
      };

      const costs = calculateSMSCosts(config, 1000);

      expect(costs.tracking).toBeDefined();
      expect(costs.tracking?.monthly).toBe(0); // Included in AWS pricing
      expect(costs.tracking?.description).toContain("included");
    });

    it("should handle zero message volume", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 0);

      // Should only have fixed costs (phone number)
      expect(costs.phoneNumber?.monthly).toBe(2.0);
      expect(costs.total.monthly).toBe(2.0);
    });

    it("should scale message costs linearly", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
      };

      const costs1k = calculateSMSCosts(config, 1000);
      const costs10k = calculateSMSCosts(config, 10_000);

      // 10k should cost roughly 10x more in message costs
      // Phone number is fixed at $2, so we compare message portion only
      const messageCost1k = costs1k.total.monthly - 2.0;
      const messageCost10k = costs10k.total.monthly - 2.0;

      expect(messageCost10k).toBeCloseTo(messageCost1k * 10, 1);
    });

    it("should handle high volumes without overflow", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        eventTracking: {
          enabled: true,
          eventBridge: true,
          dynamoDBHistory: true,
          archiveRetention: "1year",
        },
      };

      const costs = calculateSMSCosts(config, 10_000_000); // 10 million messages

      expect(Number.isFinite(costs.total.monthly)).toBe(true);
      expect(costs.total.monthly).toBeGreaterThan(0);
    });

    it("should calculate combined costs for full setup", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        tracking: {
          enabled: true,
        },
        eventTracking: {
          enabled: true,
          eventBridge: true,
          dynamoDBHistory: true,
          archiveRetention: "90days",
        },
      };

      const costs = calculateSMSCosts(config, 10_000);

      expect(costs.phoneNumber).toBeDefined();
      expect(costs.tracking).toBeDefined();
      expect(costs.eventTracking).toBeDefined();
      expect(costs.dynamoDBHistory).toBeDefined();

      // Total should be sum of all components
      const expectedTotal =
        (costs.phoneNumber?.monthly || 0) +
        (costs.tracking?.monthly || 0) +
        (costs.eventTracking?.monthly || 0) +
        (costs.dynamoDBHistory?.monthly || 0) +
        costs.total.perMessage * 10_000;

      expect(costs.total.monthly).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe("Storage Cost Calculations", () => {
    it("should increase storage costs with longer retention periods", () => {
      const config3months: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        eventTracking: {
          enabled: true,
          dynamoDBHistory: true,
          archiveRetention: "3months",
        },
      };

      const config1year: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        eventTracking: {
          enabled: true,
          dynamoDBHistory: true,
          archiveRetention: "1year",
        },
      };

      // Use higher volume to see cost differences
      const costs3months = calculateSMSCosts(config3months, 100_000);
      const costs1year = calculateSMSCosts(config1year, 100_000);

      expect(costs3months.dynamoDBHistory).toBeDefined();
      expect(costs1year.dynamoDBHistory).toBeDefined();
      expect(costs3months.dynamoDBHistory?.monthly).toBeLessThanOrEqual(
        costs1year.dynamoDBHistory?.monthly || 0
      );
    });
  });

  describe("formatCost", () => {
    it("should format zero cost as Free", () => {
      expect(formatCost(0)).toBe("Free");
    });

    it("should format very small costs", () => {
      expect(formatCost(0.001)).toBe("< $0.01");
      expect(formatCost(0.005)).toBe("< $0.01");
      expect(formatCost(0.009)).toBe("< $0.01");
    });

    it("should format costs with 2 decimal places and /mo suffix", () => {
      expect(formatCost(0.01)).toBe("~$0.01/mo");
      expect(formatCost(1.0)).toBe("~$1.00/mo");
      expect(formatCost(24.95)).toBe("~$24.95/mo");
      expect(formatCost(995.0)).toBe("~$995.00/mo");
    });

    it("should round to 2 decimal places", () => {
      expect(formatCost(1.234)).toBe("~$1.23/mo");
      expect(formatCost(1.235)).toBe("~$1.24/mo");
    });
  });

  describe("getSMSCostSummary", () => {
    it("should generate summary for minimal config", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "simulator",
        sendingEnabled: true,
      };

      const summary = getSMSCostSummary(config, 100);

      expect(summary).toContain("100 messages/month");
      expect(summary).toContain("Simulator");
    });

    it("should include phone number info in summary", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
      };

      const summary = getSMSCostSummary(config, 1000);

      expect(summary).toContain("1,000 messages/month");
      expect(summary).toContain("Toll-free");
      expect(summary).toContain("$2.00/mo");
    });

    it("should include message costs in summary", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
      };

      const summary = getSMSCostSummary(config, 1000);

      expect(summary).toContain("Message costs");
      expect(summary).toContain("/1k messages");
    });

    it("should include all enabled features in summary", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        tracking: {
          enabled: true,
        },
        eventTracking: {
          enabled: true,
          eventBridge: true,
          dynamoDBHistory: true,
          archiveRetention: "90days",
        },
      };

      const summary = getSMSCostSummary(config, 10_000);

      expect(summary).toContain("Delivery tracking");
      expect(summary).toContain("Event processing");
      expect(summary).toContain("Message history");
    });

    it("should format numbers with thousands separators", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
      };

      const summary = getSMSCostSummary(config, 1_000_000);

      expect(summary).toContain("1,000,000 messages/month");
    });

    it("should not include disabled features in summary", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        tracking: {
          enabled: false,
        },
        eventTracking: {
          enabled: false,
        },
      };

      const summary = getSMSCostSummary(config, 1000);

      expect(summary).not.toContain("Delivery tracking");
      expect(summary).not.toContain("Event processing");
    });
  });

  describe("Phone Number Types", () => {
    it("should have correct description for simulator", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "simulator",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 100);

      expect(costs.phoneNumber?.description).toContain("testing only");
      expect(costs.phoneNumber?.description).toContain("100 msg/day");
    });

    it("should have correct description for toll-free", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 100);

      expect(costs.phoneNumber?.description).toContain("Toll-free");
      expect(costs.phoneNumber?.description).toContain("3 MPS");
    });

    it("should have correct description for 10DLC", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "10dlc",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 100);

      expect(costs.phoneNumber?.description).toContain("10DLC");
      expect(costs.phoneNumber?.description).toContain("75 MPS");
    });

    it("should have correct description for short-code", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "short-code",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 100);

      expect(costs.phoneNumber?.description).toContain("short code");
      expect(costs.phoneNumber?.description).toContain("100+ MPS");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty config object", () => {
      const config: WrapsSMSConfig = {} as WrapsSMSConfig;

      expect(() => calculateSMSCosts(config, 1000)).not.toThrow();
    });

    it("should handle config with undefined fields", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: undefined as any,
        sendingEnabled: undefined,
        tracking: undefined,
        eventTracking: undefined,
      };

      expect(() => calculateSMSCosts(config, 1000)).not.toThrow();
    });

    it("should handle negative message volume", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, -1000);

      // Should treat negative as minimal/no message cost
      expect(costs.total.monthly).toBeLessThanOrEqual(2.0);
    });

    it("should handle very large message volumes without overflow", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "short-code",
        sendingEnabled: true,
        eventTracking: {
          enabled: true,
          eventBridge: true,
          dynamoDBHistory: true,
          archiveRetention: "1year",
        },
      };

      const costs = calculateSMSCosts(config, 100_000_000); // 100 million

      expect(Number.isFinite(costs.total.monthly)).toBe(true);
      expect(costs.total.monthly).toBeGreaterThan(0);
    });
  });

  describe("Realistic Scenarios", () => {
    it("should calculate development/testing setup costs", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "simulator",
        sendingEnabled: true,
      };

      const costs = calculateSMSCosts(config, 50); // Small test volume

      // Should be minimal - just simulator rental
      expect(costs.total.monthly).toBe(1.0);
    });

    it("should calculate startup setup costs (~$15-25/mo)", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "toll-free",
        sendingEnabled: true,
        tracking: {
          enabled: true,
        },
      };

      const costs = calculateSMSCosts(config, 1000); // 1k messages

      // ~$2 phone + ~$10.50 messages
      expect(costs.total.monthly).toBeGreaterThan(10);
      expect(costs.total.monthly).toBeLessThan(20);
    });

    it("should calculate high-volume setup costs", () => {
      const config: WrapsSMSConfig = {
        phoneNumberType: "short-code",
        sendingEnabled: true,
        tracking: {
          enabled: true,
        },
        eventTracking: {
          enabled: true,
          eventBridge: true,
          dynamoDBHistory: true,
          archiveRetention: "1year",
        },
      };

      const costs = calculateSMSCosts(config, 1_000_000); // 1M messages

      // $995 short code + significant message costs
      expect(costs.total.monthly).toBeGreaterThan(1000);
    });
  });
});
