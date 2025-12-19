import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import type { ServerConfig } from "../server.js";
import { fetchSMSById, fetchSMSLogs } from "../services/sms-logs.js";
import {
  fetchSMSMetricsFromDynamoDB,
  fetchSMSSpendLimits,
  fetchSMSSummaryCounts,
} from "../services/sms-metrics.js";
import {
  fetchAllSMSSettings,
  fetchPhoneNumberDetails,
} from "../services/sms-settings.js";

export function createSMSRouter(config: ServerConfig): Router {
  const router = createRouter();

  /**
   * Get SMS logs
   */
  router.get("/", async (req: Request, res: Response) => {
    try {
      console.log("SMS logs request received");
      console.log("Query params:", req.query);
      console.log("Config:", {
        smsTableName: config.smsTableName,
        region: config.region,
        accountId: config.accountId,
      });

      const limit = req.query.limit
        ? Number.parseInt(req.query.limit as string, 10)
        : 100;
      const startTime = req.query.startTime
        ? Number.parseInt(req.query.startTime as string, 10)
        : undefined;
      const endTime = req.query.endTime
        ? Number.parseInt(req.query.endTime as string, 10)
        : undefined;

      if (!config.smsTableName) {
        console.log("No SMS table name configured");
        return res.status(400).json({
          error:
            "SMS tracking not enabled. Deploy SMS infrastructure with event tracking to enable SMS logs.",
        });
      }

      console.log("Fetching SMS logs from DynamoDB...");
      const logs = await fetchSMSLogs({
        region: config.region,
        tableName: config.smsTableName,
        accountId: config.accountId,
        limit,
        startTime,
        endTime,
      });

      console.log(`Found ${logs.length} SMS logs`);
      res.json({ logs });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching SMS logs:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Get SMS metrics
   * IMPORTANT: Must be defined BEFORE /:id route
   */
  router.get("/metrics", async (req: Request, res: Response) => {
    try {
      console.log("SMS metrics request received");

      const { startTime, endTime } = req.query;

      // Default to last 24 hours if no time range provided
      const timeRange = {
        start: startTime
          ? new Date(Number.parseInt(startTime as string, 10))
          : new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: endTime
          ? new Date(Number.parseInt(endTime as string, 10))
          : new Date(),
      };

      // Fetch quota from AWS
      const quota = await fetchSMSSpendLimits(config.region);

      // Fetch metrics from DynamoDB if table is configured
      let metrics = {
        sends: [] as Array<{ timestamp: number; value: number }>,
        deliveries: [] as Array<{ timestamp: number; value: number }>,
        failures: [] as Array<{ timestamp: number; value: number }>,
        optOuts: [] as Array<{ timestamp: number; value: number }>,
      };

      let summary = {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        deliveryRate: 0,
      };

      if (config.smsTableName) {
        [metrics, summary] = await Promise.all([
          fetchSMSMetricsFromDynamoDB(
            config.region,
            config.smsTableName,
            timeRange
          ),
          fetchSMSSummaryCounts(config.region, config.smsTableName, timeRange),
        ]);
      }

      // Fetch real phone number details from AWS
      let phoneNumberInfo;
      if (config.smsPhoneNumber || config.smsPhoneNumberArn) {
        const phoneDetails = await fetchPhoneNumberDetails(
          config.region,
          config.smsPhoneNumberArn || config.smsPhoneNumber!
        );
        if (phoneDetails) {
          phoneNumberInfo = {
            number: phoneDetails.number,
            type: phoneDetails.type,
            status: phoneDetails.status,
            throughput: phoneDetails.type === "simulator" ? "100/day" : "3 MPS",
          };
        }
      }

      const response = {
        metrics,
        summary,
        quota,
        phoneNumber: phoneNumberInfo,
        timestamp: Date.now(),
      };

      res.json(response);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching SMS metrics:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Get SMS settings
   * IMPORTANT: Must be defined BEFORE /:id route
   */
  router.get("/settings", async (_req: Request, res: Response) => {
    try {
      console.log("SMS settings request received");

      // Fetch real data from AWS
      const { phoneNumber: phoneDetails, configurationSet: configSetDetails } =
        await fetchAllSMSSettings(
          config.region,
          config.smsPhoneNumberArn || config.smsPhoneNumber,
          config.smsConfigSetName
        );

      // Build phone number info from real AWS data
      let phoneNumberInfo;
      if (phoneDetails) {
        phoneNumberInfo = {
          number: phoneDetails.number,
          arn: phoneDetails.arn,
          type: phoneDetails.type,
          status: phoneDetails.status,
          capabilities: phoneDetails.capabilities,
          registrationStatus: phoneDetails.registrationStatus,
          monthlyLeasingPrice: phoneDetails.monthlyLeasingPrice,
        };
      } else if (config.smsPhoneNumber) {
        // Fallback if AWS call fails
        phoneNumberInfo = {
          number: config.smsPhoneNumber,
          arn: config.smsPhoneNumberArn,
          type: config.smsPhoneNumberType || "simulator",
          status: "UNKNOWN",
          capabilities: ["SMS"],
        };
      }

      const settings = {
        phoneNumber: phoneNumberInfo,
        configurationSet: configSetDetails
          ? {
              name: configSetDetails.name,
              sendingEnabled: configSetDetails.sendingEnabled,
              defaultMessageType: configSetDetails.defaultMessageType,
              protectConfigurationId: configSetDetails.protectConfigurationId,
            }
          : config.smsConfigSetName
            ? {
                name: config.smsConfigSetName,
                sendingEnabled: true, // Fallback
              }
            : undefined,
        protectConfiguration: config.smsProtectEnabled
          ? {
              enabled: true,
              allowedCountries: config.smsAllowedCountries || ["US"],
              aitFiltering: config.smsAitFiltering,
            }
          : undefined,
        eventTracking: config.smsTableName
          ? {
              enabled: true,
              dynamoDBHistory: true,
              archiveRetention: config.smsArchiveRetention || "90days",
            }
          : {
              enabled: false,
              dynamoDBHistory: false,
            },
        region: config.region,
      };

      res.json(settings);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching SMS settings:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Update SMS sending enabled
   * IMPORTANT: Must be defined BEFORE /:id route
   */
  router.put("/settings/sending", async (_req: Request, res: Response) => {
    try {
      console.log("SMS sending toggle request received");
      // For now, just return success - actual implementation would need SDK calls
      res.json({ success: true });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error updating SMS sending:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Get SMS details by ID
   * IMPORTANT: Must be defined AFTER specific routes like /metrics and /settings
   */
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log("SMS detail request received for ID:", id);

      if (!config.smsTableName) {
        console.log("No SMS table name configured");
        return res.status(400).json({
          error:
            "SMS tracking not enabled. Deploy SMS infrastructure with event tracking to enable SMS logs.",
        });
      }

      console.log("Fetching SMS details from DynamoDB...");
      const sms = await fetchSMSById(id, {
        region: config.region,
        tableName: config.smsTableName,
      });

      if (!sms) {
        console.log("SMS not found for ID:", id);
        return res.status(404).json({ error: "SMS not found" });
      }

      console.log("SMS details found:", sms.messageId);
      res.json(sms);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching SMS details:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  return router;
}
