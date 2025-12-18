import {
  type Change,
  ChangeResourceRecordSetsCommand,
  ListHostedZonesByNameCommand,
  ListResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";

/**
 * Get existing TXT records for a domain
 * Returns all TXT record values and identifies which one is SPF
 */
async function getExistingTXTRecords(
  client: Route53Client,
  hostedZoneId: string,
  domain: string
): Promise<{ allValues: string[]; spfValue: string | null; ttl: number }> {
  try {
    const response = await client.send(
      new ListResourceRecordSetsCommand({
        HostedZoneId: hostedZoneId,
        StartRecordName: domain,
        StartRecordType: "TXT",
        MaxItems: 100,
      })
    );

    // Find TXT records for the exact domain
    const txtRecordSet = response.ResourceRecordSets?.find(
      (rs) =>
        rs.Type === "TXT" &&
        (rs.Name === domain || rs.Name === `${domain}.`)
    );

    if (!txtRecordSet || !txtRecordSet.ResourceRecords) {
      return { allValues: [], spfValue: null, ttl: 1800 };
    }

    const allValues: string[] = [];
    let spfValue: string | null = null;

    for (const record of txtRecordSet.ResourceRecords) {
      const value = record.Value || "";
      allValues.push(value);

      // Check if this is the SPF record (strip quotes for comparison)
      const unquoted = value.replace(/^"|"$/g, "");
      if (unquoted.startsWith("v=spf1")) {
        spfValue = unquoted;
      }
    }

    return {
      allValues,
      spfValue,
      ttl: txtRecordSet.TTL || 1800,
    };
  } catch (_error) {
    return { allValues: [], spfValue: null, ttl: 1800 };
  }
}

/**
 * Merge amazonses.com include into an existing SPF record
 * If the record already includes amazonses.com, returns unchanged
 */
function mergeSPFRecord(existingSPF: string): string {
  const sesInclude = "include:amazonses.com";

  // Already includes SES
  if (existingSPF.includes(sesInclude)) {
    return existingSPF;
  }

  // Find the position before the "all" mechanism to insert our include
  // SPF format: v=spf1 [mechanisms...] [qualifier]all
  const allMatch = existingSPF.match(/\s([~+?-]?all)$/);

  if (allMatch) {
    // Insert before the "all" mechanism
    const beforeAll = existingSPF.slice(0, allMatch.index);
    const allPart = allMatch[1];
    return `${beforeAll} ${sesInclude} ${allPart}`;
  }

  // No "all" mechanism found, append to end
  return `${existingSPF} ${sesInclude}`;
}

/**
 * Find Route53 hosted zone for a domain
 */
export async function findHostedZone(
  domain: string,
  region: string
): Promise<{ id: string; name: string } | null> {
  const client = new Route53Client({ region });

  try {
    const response = await client.send(
      new ListHostedZonesByNameCommand({
        DNSName: domain,
        MaxItems: 1,
      })
    );

    const zone = response.HostedZones?.[0];
    if (zone && zone.Name === `${domain}.` && zone.Id) {
      return {
        id: zone.Id.replace("/hostedzone/", ""),
        name: zone.Name,
      };
    }

    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * Create DNS records in Route53
 */
export async function createDNSRecords(
  hostedZoneId: string,
  domain: string,
  dkimTokens: string[],
  region: string,
  customTrackingDomain?: string,
  mailFromDomain?: string
): Promise<void> {
  const client = new Route53Client({ region });

  const changes: Change[] = [];

  // DKIM CNAME records
  for (const token of dkimTokens) {
    changes.push({
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: `${token}._domainkey.${domain}`,
        Type: "CNAME",
        TTL: 1800,
        ResourceRecords: [{ Value: `${token}.dkim.amazonses.com` }],
      },
    });
  }

  // SPF TXT record - check for existing records and merge while preserving others
  const existingTXT = await getExistingTXTRecords(client, hostedZoneId, domain);

  // Build the new TXT record values, preserving all non-SPF records
  const newTXTValues: string[] = [];

  if (existingTXT.spfValue) {
    // Merge our include into the existing SPF record
    const mergedSPF = mergeSPFRecord(existingTXT.spfValue);
    newTXTValues.push(`"${mergedSPF}"`);

    // Add all other TXT values (non-SPF)
    for (const value of existingTXT.allValues) {
      const unquoted = value.replace(/^"|"$/g, "");
      if (!unquoted.startsWith("v=spf1")) {
        newTXTValues.push(value);
      }
    }
  } else if (existingTXT.allValues.length > 0) {
    // No SPF exists, add new SPF and keep all existing values
    newTXTValues.push('"v=spf1 include:amazonses.com ~all"');
    newTXTValues.push(...existingTXT.allValues);
  } else {
    // No TXT records exist, create new SPF
    newTXTValues.push('"v=spf1 include:amazonses.com ~all"');
  }

  changes.push({
    Action: "UPSERT",
    ResourceRecordSet: {
      Name: domain,
      Type: "TXT",
      TTL: existingTXT.ttl,
      ResourceRecords: newTXTValues.map((v) => ({ Value: v })),
    },
  });

  // DMARC TXT record
  // Use MAIL FROM domain for rua if configured, otherwise use main domain
  const dmarcRuaDomain = mailFromDomain || domain;
  changes.push({
    Action: "UPSERT",
    ResourceRecordSet: {
      Name: `_dmarc.${domain}`,
      Type: "TXT",
      TTL: 1800,
      ResourceRecords: [
        { Value: `"v=DMARC1; p=quarantine; rua=mailto:postmaster@${dmarcRuaDomain}"` },
      ],
    },
  });

  // Custom tracking domain CNAME (if provided)
  // This allows SES to rewrite links for open/click tracking using your custom domain
  if (customTrackingDomain) {
    changes.push({
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: customTrackingDomain,
        Type: "CNAME",
        TTL: 1800,
        ResourceRecords: [{ Value: `r.${region}.awstrack.me` }],
      },
    });
  }

  // MAIL FROM domain records (if provided)
  // These records enable DMARC alignment by using a custom subdomain for the envelope sender
  if (mailFromDomain) {
    // MX record pointing to SES feedback server
    changes.push({
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: mailFromDomain,
        Type: "MX",
        TTL: 1800,
        ResourceRecords: [
          { Value: `10 feedback-smtp.${region}.amazonses.com` },
        ],
      },
    });

    // SPF record for MAIL FROM domain
    changes.push({
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: mailFromDomain,
        Type: "TXT",
        TTL: 1800,
        ResourceRecords: [{ Value: '"v=spf1 include:amazonses.com ~all"' }],
      },
    });
  }

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: changes,
      },
    })
  );
}

/**
 * Delete DNS records from Route53 that were created for SES
 */
export async function deleteDNSRecords(
  hostedZoneId: string,
  domain: string,
  dkimTokens: string[],
  region: string,
  customTrackingDomain?: string,
  mailFromDomain?: string
): Promise<void> {
  const client = new Route53Client({ region });

  // First, we need to get the current record values to delete them
  // Route53 DELETE requires exact match of the record
  const response = await client.send(
    new ListResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      MaxItems: 500,
    })
  );

  const recordSets = response.ResourceRecordSets || [];
  const changes: Change[] = [];

  // Helper to find and add deletion for a record
  const addDeletionIfExists = (name: string, type: string) => {
    // Route53 names end with a dot
    const normalizedName = name.endsWith(".") ? name : `${name}.`;
    const record = recordSets.find(
      (rs) => rs.Name === normalizedName && rs.Type === type
    );
    if (record && record.ResourceRecords) {
      changes.push({
        Action: "DELETE",
        ResourceRecordSet: record,
      });
    }
  };

  // DKIM CNAME records
  for (const token of dkimTokens) {
    addDeletionIfExists(`${token}._domainkey.${domain}`, "CNAME");
  }

  // DMARC record
  addDeletionIfExists(`_dmarc.${domain}`, "TXT");

  // Custom tracking domain CNAME
  if (customTrackingDomain) {
    addDeletionIfExists(customTrackingDomain, "CNAME");
  }

  // MAIL FROM domain records
  if (mailFromDomain) {
    addDeletionIfExists(mailFromDomain, "MX");
    addDeletionIfExists(mailFromDomain, "TXT");
  }

  // Note: We don't delete the main domain SPF record as it might contain
  // other providers' includes. Users should manually remove amazonses.com
  // from their SPF if needed.

  if (changes.length === 0) {
    return; // Nothing to delete
  }

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: changes,
      },
    })
  );
}
