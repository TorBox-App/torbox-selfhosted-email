/**
 * Variable Mappings Tests
 *
 * Tests for applyVariableMappings — resolves user-configured variable
 * mappings (static values or contact field references) into SES
 * replacement data entries.
 */

import { describe, expect, it } from "vitest";
import type { VariableMapping } from "../workers/variable-mappings";
import { applyVariableMappings } from "../workers/variable-mappings";

describe("applyVariableMappings", () => {
  it("returns original data unchanged when mappings is empty", () => {
    const existingData: Record<string, string> = {
      firstName: "John",
      email: "john@example.com",
    };
    const contact = {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      company: null,
      jobTitle: null,
      properties: {},
    };

    const result = applyVariableMappings(existingData, [], contact);

    expect(result).toEqual(existingData);
  });

  it("returns original data unchanged when mappings is undefined", () => {
    const existingData: Record<string, string> = {
      firstName: "John",
    };
    const contact = {
      firstName: "John",
      lastName: null,
      email: "john@example.com",
      company: null,
      jobTitle: null,
      properties: {},
    };

    const result = applyVariableMappings(existingData, undefined, contact);

    expect(result).toEqual(existingData);
  });

  it("resolves static source mappings into replacement data", () => {
    const existingData: Record<string, string> = {
      firstName: "John",
    };
    const mappings: VariableMapping[] = [
      {
        variableName: "dashboardUrl",
        source: { type: "static", value: "https://app.example.com/dashboard" },
      },
      {
        variableName: "promoCode",
        source: { type: "static", value: "WELCOME20" },
      },
    ];
    const contact = {
      firstName: "John",
      lastName: null,
      email: "john@example.com",
      company: null,
      jobTitle: null,
      properties: {},
    };

    const result = applyVariableMappings(existingData, mappings, contact);

    expect(result.dashboardUrl).toBe("https://app.example.com/dashboard");
    expect(result.promoCode).toBe("WELCOME20");
    expect(result.firstName).toBe("John");
  });

  it("resolves contact field source mappings into replacement data", () => {
    const existingData: Record<string, string> = {};
    const mappings: VariableMapping[] = [
      {
        variableName: "recipientName",
        source: { type: "contact", field: "firstName" },
      },
      {
        variableName: "recipientCompany",
        source: { type: "contact", field: "company" },
      },
    ];
    const contact = {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      company: "Acme Corp",
      jobTitle: "CTO",
      properties: {},
    };

    const result = applyVariableMappings(existingData, mappings, contact);

    expect(result.recipientName).toBe("Jane");
    expect(result.recipientCompany).toBe("Acme Corp");
  });

  it("falls back to empty string when contact field is null", () => {
    const existingData: Record<string, string> = {};
    const mappings: VariableMapping[] = [
      {
        variableName: "recipientCompany",
        source: { type: "contact", field: "company" },
      },
    ];
    const contact = {
      firstName: "Bob",
      lastName: null,
      email: "bob@example.com",
      company: null,
      jobTitle: null,
      properties: {},
    };

    const result = applyVariableMappings(existingData, mappings, contact);

    expect(result.recipientCompany).toBe("");
  });

  it("resolves contact properties fields", () => {
    const existingData: Record<string, string> = {};
    const mappings: VariableMapping[] = [
      {
        variableName: "plan",
        source: { type: "contact", field: "properties.plan" },
      },
    ];
    const contact = {
      firstName: null,
      lastName: null,
      email: "test@example.com",
      company: null,
      jobTitle: null,
      properties: { plan: "enterprise" },
    };

    const result = applyVariableMappings(existingData, mappings, contact);

    expect(result.plan).toBe("enterprise");
  });

  it("integrates with batch-sender replacement data pattern", () => {
    // Simulate the standard replacement data the batch-sender builds
    const standardData: Record<string, string> = {
      email: "john@example.com",
      contactEmail: "john@example.com",
      firstName: "John",
      contactFirstName: "John",
      organizationName: "Acme Corp",
      unsubscribeUrl: "https://api.wraps.dev/unsubscribe/token",
      preferencesUrl: "https://app.wraps.dev/preferences/token",
    };

    // Mappings that a user configured in the VariableMapper UI
    const mappings: VariableMapping[] = [
      {
        variableName: "dashboardUrl",
        source: { type: "static", value: "https://app.example.com/dash" },
      },
      {
        variableName: "userRole",
        source: { type: "contact", field: "jobTitle" },
      },
      {
        variableName: "tier",
        source: { type: "contact", field: "properties.pricingTier" },
      },
    ];

    const contact = {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      company: "Acme Corp",
      jobTitle: "Engineer",
      properties: { pricingTier: "pro" },
    };

    const result = applyVariableMappings(standardData, mappings, contact);

    // Standard data preserved
    expect(result.email).toBe("john@example.com");
    expect(result.organizationName).toBe("Acme Corp");
    expect(result.unsubscribeUrl).toBe(
      "https://api.wraps.dev/unsubscribe/token"
    );

    // Custom mappings applied
    expect(result.dashboardUrl).toBe("https://app.example.com/dash");
    expect(result.userRole).toBe("Engineer");
    expect(result.tier).toBe("pro");
  });
});
