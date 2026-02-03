/**
 * Vercel DNS provider for CLI
 */

import type {
  DNSCreationResult,
  DNSProviderClient,
  EmailDNSRecordData,
} from "./types.js";

const VERCEL_API_BASE = "https://api.vercel.com";

type VercelRecord = {
  id: string;
  slug: string;
  name: string;
  type: string;
  value: string;
  ttl: number;
  mxPriority?: number;
};

type VercelRecordsResponse = {
  records: VercelRecord[];
};

type VercelErrorResponse = {
  error?: {
    code: string;
    message: string;
  };
};

/**
 * Vercel DNS provider client
 */
export class VercelDNSClient implements DNSProviderClient {
  private readonly domain: string;
  private readonly apiToken: string;
  private readonly teamId?: string;

  constructor(domain: string, apiToken: string, teamId?: string) {
    this.domain = domain;
    this.apiToken = apiToken;
    this.teamId = teamId;
  }

  private get teamParam(): string {
    return this.teamId ? `&teamId=${this.teamId}` : "";
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: unknown
  ): Promise<T & VercelErrorResponse> {
    const url = `${VERCEL_API_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}${this.teamParam.slice(1)}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return response.json() as Promise<T & VercelErrorResponse>;
  }

  private async createRecord(
    name: string,
    type: string,
    value: string,
    mxPriority?: number
  ): Promise<boolean> {
    // For Vercel, the name should be relative to the domain
    // e.g., for "token._domainkey.example.com", name should be "token._domainkey"
    // Root domain should be "@"
    const relativeName =
      name === this.domain ? "@" : name.replace(`.${this.domain}`, "");

    const body: Record<string, unknown> = {
      name: relativeName,
      type,
      value,
      ttl: 1800,
    };

    if (mxPriority !== undefined) {
      body.mxPriority = mxPriority;
    }

    const result = await this.request<VercelRecord>(
      `/v2/domains/${this.domain}/records`,
      "POST",
      body
    );

    return !result.error;
  }

  private async findRecord(
    name: string,
    type: string
  ): Promise<VercelRecord | null> {
    const result = await this.request<VercelRecordsResponse>(
      `/v4/domains/${this.domain}/records`
    );

    if (result.error || !result.records) {
      return null;
    }

    // Vercel stores relative names, so we need to match accordingly
    // Root domain should be "@"
    const relativeName =
      name === this.domain ? "@" : name.replace(`.${this.domain}`, "");

    return (
      result.records.find(
        (r) => (r.name === relativeName || r.name === name) && r.type === type
      ) || null
    );
  }

  private async deleteRecord(recordId: string): Promise<boolean> {
    const result = await this.request<{ id: string }>(
      `/v2/domains/${this.domain}/records/${recordId}`,
      "DELETE"
    );
    return !result.error;
  }

  /**
   * Create arbitrary DNS records from a list
   */
  async createRecords(
    records: Array<{
      name: string;
      type: string;
      value: string;
      priority?: number;
    }>
  ): Promise<DNSCreationResult> {
    const errors: string[] = [];
    let recordsCreated = 0;

    for (const record of records) {
      const success = await this.createRecord(
        record.name,
        record.type,
        record.value,
        record.priority
      );
      if (success) {
        recordsCreated++;
      } else {
        errors.push(`Failed to create ${record.type} record: ${record.name}`);
      }
    }

    return {
      success: errors.length === 0,
      recordsCreated,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async createEmailRecords(
    data: EmailDNSRecordData
  ): Promise<DNSCreationResult> {
    const { domain, dkimTokens, mailFromDomain, region } = data;
    const errors: string[] = [];
    let recordsCreated = 0;

    try {
      // DKIM CNAME records (3 records)
      for (const token of dkimTokens) {
        const name = `${token}._domainkey.${domain}`;
        const success = await this.createRecord(
          name,
          "CNAME",
          `${token}.dkim.amazonses.com`
        );
        if (success) {
          recordsCreated++;
        } else {
          errors.push(`Failed to create DKIM record: ${name}`);
        }
      }

      // SPF TXT record for the domain
      const spfSuccess = await this.createRecord(
        domain,
        "TXT",
        "v=spf1 include:amazonses.com ~all"
      );
      if (spfSuccess) {
        recordsCreated++;
      } else {
        errors.push(`Failed to create SPF record for ${domain}`);
      }

      // DMARC TXT record
      const dmarcSuccess = await this.createRecord(
        `_dmarc.${domain}`,
        "TXT",
        `v=DMARC1; p=quarantine; rua=mailto:postmaster@${mailFromDomain || domain}`
      );
      if (dmarcSuccess) {
        recordsCreated++;
      } else {
        errors.push(`Failed to create DMARC record for ${domain}`);
      }

      // MAIL FROM domain records (if configured)
      if (mailFromDomain) {
        // MX record for bounce handling
        const mxSuccess = await this.createRecord(
          mailFromDomain,
          "MX",
          `feedback-smtp.${region}.amazonses.com`,
          10
        );
        if (mxSuccess) {
          recordsCreated++;
        } else {
          errors.push(`Failed to create MX record for ${mailFromDomain}`);
        }

        // SPF TXT record for MAIL FROM subdomain
        const mailFromSpfSuccess = await this.createRecord(
          mailFromDomain,
          "TXT",
          "v=spf1 include:amazonses.com ~all"
        );
        if (mailFromSpfSuccess) {
          recordsCreated++;
        } else {
          errors.push(`Failed to create SPF record for ${mailFromDomain}`);
        }
      }

      return {
        success: errors.length === 0,
        recordsCreated,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        recordsCreated,
        errors: [
          ...errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      };
    }
  }

  async deleteEmailRecords(
    data: EmailDNSRecordData
  ): Promise<DNSCreationResult> {
    const { domain, dkimTokens, mailFromDomain } = data;
    const errors: string[] = [];
    let recordsCreated = 0;

    try {
      // Delete DKIM CNAME records
      for (const token of dkimTokens) {
        const name = `${token}._domainkey.${domain}`;
        const record = await this.findRecord(name, "CNAME");
        if (record) {
          const success = await this.deleteRecord(record.id);
          if (success) {
            recordsCreated++;
          } else {
            errors.push(`Failed to delete DKIM record: ${name}`);
          }
        }
      }

      // Delete DMARC record
      const dmarcRecord = await this.findRecord(`_dmarc.${domain}`, "TXT");
      if (dmarcRecord) {
        const success = await this.deleteRecord(dmarcRecord.id);
        if (success) {
          recordsCreated++;
        } else {
          errors.push("Failed to delete DMARC record");
        }
      }

      // Delete MAIL FROM domain records
      if (mailFromDomain) {
        const mxRecord = await this.findRecord(mailFromDomain, "MX");
        if (mxRecord) {
          const success = await this.deleteRecord(mxRecord.id);
          if (success) {
            recordsCreated++;
          } else {
            errors.push(`Failed to delete MX record for ${mailFromDomain}`);
          }
        }

        const spfRecord = await this.findRecord(mailFromDomain, "TXT");
        if (spfRecord) {
          const success = await this.deleteRecord(spfRecord.id);
          if (success) {
            recordsCreated++;
          } else {
            errors.push(`Failed to delete SPF record for ${mailFromDomain}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        recordsCreated,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        recordsCreated,
        errors: [
          ...errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      };
    }
  }

  async verifyRecords(data: EmailDNSRecordData): Promise<{
    verified: boolean;
    missing: string[];
    incorrect: string[];
  }> {
    const { domain, dkimTokens, mailFromDomain, region } = data;
    const missing: string[] = [];
    const incorrect: string[] = [];

    // Check DKIM records
    for (const token of dkimTokens) {
      const name = `${token}._domainkey.${domain}`;
      const expectedValue = `${token}.dkim.amazonses.com`;
      const record = await this.findRecord(name, "CNAME");

      if (!record) {
        missing.push(`DKIM: ${name}`);
      } else if (record.value !== expectedValue) {
        incorrect.push(`DKIM: ${name} (expected ${expectedValue})`);
      }
    }

    // Check SPF record
    const spfRecord = await this.findRecord(domain, "TXT");
    if (!spfRecord) {
      missing.push(`SPF: ${domain}`);
    } else if (!spfRecord.value.includes("include:amazonses.com")) {
      incorrect.push(`SPF: ${domain} (missing amazonses.com include)`);
    }

    // Check DMARC record
    const dmarcRecord = await this.findRecord(`_dmarc.${domain}`, "TXT");
    if (!dmarcRecord) {
      missing.push(`DMARC: _dmarc.${domain}`);
    }

    // Check MAIL FROM records
    if (mailFromDomain) {
      const mxRecord = await this.findRecord(mailFromDomain, "MX");
      if (!mxRecord) {
        missing.push(`MX: ${mailFromDomain}`);
      } else if (
        !mxRecord.value.includes(`feedback-smtp.${region}.amazonses.com`)
      ) {
        incorrect.push(`MX: ${mailFromDomain}`);
      }

      const mailFromSpf = await this.findRecord(mailFromDomain, "TXT");
      if (!mailFromSpf) {
        missing.push(`SPF: ${mailFromDomain}`);
      }
    }

    return {
      verified: missing.length === 0 && incorrect.length === 0,
      missing,
      incorrect,
    };
  }
}
