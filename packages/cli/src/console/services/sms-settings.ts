import {
  DescribeConfigurationSetsCommand,
  DescribePhoneNumbersCommand,
  PinpointSMSVoiceV2Client,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";

export type PhoneNumberDetails = {
  number: string;
  arn?: string;
  type: string;
  status: string;
  capabilities: string[];
  registrationStatus?: string;
  twoWayEnabled?: boolean;
  selfManagedOptOutsEnabled?: boolean;
  monthlyLeasingPrice?: string;
};

export type ConfigurationSetDetails = {
  name: string;
  sendingEnabled: boolean;
  defaultMessageType?: string;
  defaultSenderId?: string;
  protectConfigurationId?: string;
};

/**
 * Fetch phone number details from AWS End User Messaging
 */
export async function fetchPhoneNumberDetails(
  region: string,
  phoneNumberOrArn: string
): Promise<PhoneNumberDetails | null> {
  const client = new PinpointSMSVoiceV2Client({ region });

  try {
    // Query by phone number or ARN
    const response = await client.send(
      new DescribePhoneNumbersCommand({
        PhoneNumberIds: [phoneNumberOrArn],
      })
    );

    const phoneNumber = response.PhoneNumbers?.[0];
    if (!phoneNumber) {
      return null;
    }

    // Map AWS status to friendly status
    const mapStatus = (status?: string): string => {
      switch (status) {
        case "PENDING":
          return "PENDING";
        case "ACTIVE":
          return "ACTIVE";
        case "ASSOCIATING":
          return "ASSOCIATING";
        case "DISASSOCIATING":
          return "DISASSOCIATING";
        case "DELETED":
          return "DELETED";
        default:
          return status || "UNKNOWN";
      }
    };

    // Map number type
    const mapNumberType = (type?: string): string => {
      switch (type) {
        case "SIMULATOR":
          return "simulator";
        case "TOLL_FREE":
          return "toll-free";
        case "TEN_DLC":
          return "10dlc";
        case "SHORT_CODE":
          return "short-code";
        case "LONG_CODE":
          return "long-code";
        default:
          return type?.toLowerCase() || "unknown";
      }
    };

    // Map capabilities
    const capabilities: string[] = [];
    if (phoneNumber.NumberCapabilities) {
      for (const cap of phoneNumber.NumberCapabilities) {
        if (cap === "SMS") {
          capabilities.push("SMS");
        }
        if (cap === "VOICE") {
          capabilities.push("Voice");
        }
        if (cap === "MMS") {
          capabilities.push("MMS");
        }
      }
    }

    // Get registration status for toll-free numbers
    let registrationStatus: string | undefined;
    if (phoneNumber.NumberType === "TOLL_FREE" && phoneNumber.RegistrationId) {
      registrationStatus = await fetchRegistrationStatus(
        client,
        phoneNumber.RegistrationId
      );
    }

    return {
      number: phoneNumber.PhoneNumber || phoneNumberOrArn,
      arn: phoneNumber.PhoneNumberArn,
      type: mapNumberType(phoneNumber.NumberType),
      status: mapStatus(phoneNumber.Status),
      capabilities,
      registrationStatus,
      twoWayEnabled: phoneNumber.TwoWayEnabled,
      selfManagedOptOutsEnabled: phoneNumber.SelfManagedOptOutsEnabled,
      monthlyLeasingPrice: phoneNumber.MonthlyLeasingPrice,
    };
  } catch (error) {
    console.error("Error fetching phone number details:", error);
    return null;
  }
}

/**
 * Fetch registration status for toll-free verification
 */
async function fetchRegistrationStatus(
  client: PinpointSMSVoiceV2Client,
  registrationId: string
): Promise<string | undefined> {
  try {
    // Use DescribeRegistrations to get the status
    const { DescribeRegistrationsCommand } = await import(
      "@aws-sdk/client-pinpoint-sms-voice-v2"
    );

    const response = await client.send(
      new DescribeRegistrationsCommand({
        RegistrationIds: [registrationId],
      })
    );

    const registration = response.Registrations?.[0];
    if (!registration) {
      return;
    }

    // Map registration status to friendly name
    const statusMap: Record<string, string> = {
      CREATED: "CREATED",
      SUBMITTED: "SUBMITTED",
      REVIEWING: "REVIEWING",
      PROVISIONING: "PROVISIONING",
      COMPLETE: "VERIFIED",
      REQUIRES_UPDATES: "REQUIRES_UPDATES",
      CLOSED: "CLOSED",
      DENIED: "DENIED",
    };

    const status = registration.RegistrationStatus;
    return status ? statusMap[status] || status : "PENDING";
  } catch (error) {
    console.error("Error fetching registration status:", error);
    return "PENDING_VERIFICATION";
  }
}

/**
 * Fetch configuration set details from AWS End User Messaging
 */
export async function fetchConfigurationSetDetails(
  region: string,
  configSetName: string
): Promise<ConfigurationSetDetails | null> {
  const client = new PinpointSMSVoiceV2Client({ region });

  try {
    const response = await client.send(
      new DescribeConfigurationSetsCommand({
        ConfigurationSetNames: [configSetName],
      })
    );

    const configSet = response.ConfigurationSets?.[0];
    if (!configSet) {
      return null;
    }

    return {
      name: configSet.ConfigurationSetName || configSetName,
      // If the config set exists and isn't deleted, sending is enabled
      // There's no explicit "sending enabled" flag - if it exists, it works
      sendingEnabled: true,
      defaultMessageType: configSet.DefaultMessageType,
      defaultSenderId: configSet.DefaultSenderId,
      protectConfigurationId: configSet.ProtectConfigurationId,
    };
  } catch (error) {
    console.error("Error fetching configuration set details:", error);
    return null;
  }
}

/**
 * Fetch all SMS settings in one call
 */
export async function fetchAllSMSSettings(
  region: string,
  phoneNumberOrArn?: string,
  configSetName?: string
): Promise<{
  phoneNumber: PhoneNumberDetails | null;
  configurationSet: ConfigurationSetDetails | null;
}> {
  const [phoneNumber, configurationSet] = await Promise.all([
    phoneNumberOrArn
      ? fetchPhoneNumberDetails(region, phoneNumberOrArn)
      : Promise.resolve(null),
    configSetName
      ? fetchConfigurationSetDetails(region, configSetName)
      : Promise.resolve(null),
  ]);

  return { phoneNumber, configurationSet };
}
