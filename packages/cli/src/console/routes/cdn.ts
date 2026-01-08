import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { loadConnectionMetadata } from "../../utils/shared/metadata.js";
import type { ServerConfig } from "../server.js";

export function createCdnRouter(config: ServerConfig): Router {
  const router = createRouter();

  /**
   * Get storage settings
   */
  router.get("/settings", async (_req: Request, res: Response) => {
    try {
      // Load metadata to get storage configuration
      const metadata = await loadConnectionMetadata(
        config.accountId || "",
        config.region
      );

      if (!metadata?.services.cdn) {
        return res.status(404).json({
          error: "No CDN infrastructure found for this account and region",
        });
      }

      const cdnService = metadata.services.cdn;
      const cdnConfig = cdnService.config;

      // Get storage info from metadata
      const settings = {
        bucketName:
          config.cdnBucketName || `wraps-cdn-${config.accountId}`,
        bucketArn: `arn:aws:s3:::${config.cdnBucketName || `wraps-cdn-${config.accountId}`}`,
        region: config.region,
        roleArn: config.cdnRoleArn || config.roleArn,
        cdn: {
          enabled: cdnConfig.cdn?.enabled ?? false,
          distributionId: config.cdnDistributionId,
          distributionDomain: config.cdnDistributionDomain,
          customDomain: cdnConfig.cdn?.customDomain,
          status: config.cdnDistributionId ? "Deployed" : undefined,
        },
        certificate: cdnConfig.cdn?.customDomain
          ? {
              arn: config.cdnCertificateArn,
              status: config.cdnCertificateArn
                ? "ISSUED"
                : "PENDING_VALIDATION",
            }
          : undefined,
        versioning: cdnConfig.versioning ?? false,
        retention: cdnConfig.retention,
      };

      res.json(settings);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[CDN] Error fetching settings:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Get storage files (list objects from S3)
   */
  router.get("/files", async (_req: Request, res: Response) => {
    try {
      // Load metadata to check if storage is configured
      const metadata = await loadConnectionMetadata(
        config.accountId || "",
        config.region
      );

      if (!metadata?.services.cdn) {
        return res.status(404).json({
          error: "No CDN infrastructure found for this account and region",
        });
      }

      const bucketName =
        config.cdnBucketName || `wraps-cdn-${config.accountId}`;

      // List objects from S3
      const { S3Client, ListObjectsV2Command, GetObjectTaggingCommand } =
        await import("@aws-sdk/client-s3");
      const { assumeRole } = await import("../../utils/shared/assume-role.js");

      const credentials =
        config.cdnRoleArn || config.roleArn
          ? await assumeRole(
              config.cdnRoleArn || config.roleArn!,
              config.region
            )
          : undefined;
      const s3Client = new S3Client({ region: config.region, credentials });

      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: 100,
        })
      );

      // Build CDN URL for files
      const cdnUrl = config.cdnDistributionDomain
        ? `https://${metadata.services.cdn.config.cdn?.customDomain || config.cdnDistributionDomain}`
        : null;

      // Infer content type from file extension
      const getContentType = (key: string): string | undefined => {
        const ext = key.split(".").pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          // Images
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
          avif: "image/avif",
          svg: "image/svg+xml",
          ico: "image/x-icon",
          bmp: "image/bmp",
          // Documents
          pdf: "application/pdf",
          doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          // Text
          txt: "text/plain",
          html: "text/html",
          css: "text/css",
          js: "text/javascript",
          json: "application/json",
        };
        return ext ? mimeTypes[ext] : undefined;
      };

      // Fetch files with tags in parallel
      const files = await Promise.all(
        (response.Contents || []).map(async (obj) => {
          const key = obj.Key || "";

          // Fetch tags for this object
          let tags: Array<{ key: string; value: string }> = [];
          let starred = false;

          try {
            const tagsResponse = await s3Client.send(
              new GetObjectTaggingCommand({
                Bucket: bucketName,
                Key: key,
              })
            );
            tags = (tagsResponse.TagSet || []).map((t) => ({
              key: t.Key || "",
              value: t.Value || "",
            }));
            starred = tags.some(
              (t) => t.key === "starred" && t.value === "true"
            );
          } catch {
            // Tags not available or error - continue without tags
          }

          return {
            key,
            size: obj.Size || 0,
            lastModified: obj.LastModified?.toISOString() || "",
            contentType: getContentType(key),
            url: cdnUrl ? `${cdnUrl}/${key}` : `s3://${bucketName}/${key}`,
            tags,
            starred,
          };
        })
      );

      // Calculate total size
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      res.json({
        bucketName,
        region: config.region,
        cdnDomain: config.cdnDistributionDomain,
        customDomain: metadata.services.cdn.config.cdn?.customDomain,
        files,
        totalSize,
        fileCount: files.length,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[CDN] Error fetching files:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Get storage metrics
   */
  router.get("/metrics", async (req: Request, res: Response) => {
    try {
      const { range } = req.query;
      const daysBack = range === "90d" ? 90 : range === "30d" ? 30 : 7;

      // Load metadata to check if storage is configured
      const metadata = await loadConnectionMetadata(
        config.accountId || "",
        config.region
      );

      if (!metadata?.services.cdn) {
        return res.status(404).json({
          error: "No CDN infrastructure found for this account and region",
        });
      }

      const bucketName =
        config.cdnBucketName || `wraps-cdn-${config.accountId}`;

      // Get CloudWatch metrics for the bucket
      const { CloudWatchClient, GetMetricStatisticsCommand } = await import(
        "@aws-sdk/client-cloudwatch"
      );
      const { assumeRole } = await import("../../utils/shared/assume-role.js");

      const credentials =
        config.cdnRoleArn || config.roleArn
          ? await assumeRole(
              config.cdnRoleArn || config.roleArn!,
              config.region
            )
          : undefined;
      const cloudWatchClient = new CloudWatchClient({
        region: config.region,
        credentials,
      });

      const endTime = new Date();

      // Get bucket size metrics (S3 metrics are reported daily, so we look at last 24 hours)
      let bucketSizeBytes = 0;
      let numberOfObjects = 0;

      try {
        const sizeResponse = await cloudWatchClient.send(
          new GetMetricStatisticsCommand({
            Namespace: "AWS/S3",
            MetricName: "BucketSizeBytes",
            Dimensions: [
              { Name: "BucketName", Value: bucketName },
              { Name: "StorageType", Value: "StandardStorage" },
            ],
            StartTime: new Date(endTime.getTime() - 24 * 60 * 60 * 1000),
            EndTime: endTime,
            Period: 86_400,
            Statistics: ["Average"],
          })
        );
        bucketSizeBytes = sizeResponse.Datapoints?.[0]?.Average || 0;

        const objectsResponse = await cloudWatchClient.send(
          new GetMetricStatisticsCommand({
            Namespace: "AWS/S3",
            MetricName: "NumberOfObjects",
            Dimensions: [
              { Name: "BucketName", Value: bucketName },
              { Name: "StorageType", Value: "AllStorageTypes" },
            ],
            StartTime: new Date(endTime.getTime() - 24 * 60 * 60 * 1000),
            EndTime: endTime,
            Period: 86_400,
            Statistics: ["Average"],
          })
        );
        numberOfObjects = objectsResponse.Datapoints?.[0]?.Average || 0;
      } catch (err) {
        console.log("[CDN] CloudWatch metrics not available yet");
      }

      // Generate sample data for charts (CloudWatch S3 metrics are daily)
      const usage = [];
      const bandwidth = [];
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date(endTime.getTime() - i * 24 * 60 * 60 * 1000);
        usage.push({
          date: date.toISOString().split("T")[0],
          size: bucketSizeBytes,
          files: Math.round(numberOfObjects),
        });
        bandwidth.push({
          date: date.toISOString().split("T")[0],
          bytes: 0,
          requests: 0,
        });
      }

      res.json({
        summary: {
          totalSize: bucketSizeBytes,
          fileCount: Math.round(numberOfObjects),
          bandwidth: {
            today: 0,
            thisMonth: 0,
          },
          requests: {
            today: 0,
            thisMonth: 0,
          },
        },
        usage,
        bandwidth,
        topFiles: [],
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[CDN] Error fetching metrics:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Generate presigned URL for file upload
   */
  router.post("/upload-url", async (req: Request, res: Response) => {
    try {
      const { filename, contentType } = req.body;

      if (!filename) {
        return res.status(400).json({ error: "Filename is required" });
      }

      // Load metadata to check if storage is configured
      const metadata = await loadConnectionMetadata(
        config.accountId || "",
        config.region
      );

      if (!metadata?.services.cdn) {
        return res.status(404).json({
          error: "No CDN infrastructure found for this account and region",
        });
      }

      const bucketName =
        config.cdnBucketName || `wraps-cdn-${config.accountId}`;

      // Generate presigned PUT URL
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const { assumeRole } = await import("../../utils/shared/assume-role.js");

      const credentials =
        config.cdnRoleArn || config.roleArn
          ? await assumeRole(
              config.cdnRoleArn || config.roleArn!,
              config.region
            )
          : undefined;
      const s3Client = new S3Client({ region: config.region, credentials });

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        ContentType: contentType || "application/octet-stream",
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      // Build CDN URL for the file
      const cdnUrl = metadata.services.cdn.config.cdn?.customDomain
        ? `https://${metadata.services.cdn.config.cdn.customDomain}/${filename}`
        : config.cdnDistributionDomain
          ? `https://${config.cdnDistributionDomain}/${filename}`
          : `s3://${bucketName}/${filename}`;

      res.json({
        uploadUrl,
        cdnUrl,
        bucket: bucketName,
        key: filename,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[CDN] Error generating upload URL:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Toggle star status on a file (uses S3 object tagging)
   */
  router.patch("/files/:key(*)/star", async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { starred } = req.body;

      if (!key) {
        return res.status(400).json({ error: "File key is required" });
      }

      if (typeof starred !== "boolean") {
        return res.status(400).json({ error: "starred must be a boolean" });
      }

      // Load metadata to check if storage is configured
      const metadata = await loadConnectionMetadata(
        config.accountId || "",
        config.region
      );

      if (!metadata?.services.cdn) {
        return res.status(404).json({
          error: "No CDN infrastructure found for this account and region",
        });
      }

      const bucketName =
        config.cdnBucketName || `wraps-cdn-${config.accountId}`;

      const { S3Client, GetObjectTaggingCommand, PutObjectTaggingCommand } =
        await import("@aws-sdk/client-s3");
      const { assumeRole } = await import("../../utils/shared/assume-role.js");

      const credentials =
        config.cdnRoleArn || config.roleArn
          ? await assumeRole(
              config.cdnRoleArn || config.roleArn!,
              config.region
            )
          : undefined;
      const s3Client = new S3Client({ region: config.region, credentials });

      // Get existing tags
      let existingTags: Array<{ Key: string; Value: string }> = [];
      try {
        const tagsResponse = await s3Client.send(
          new GetObjectTaggingCommand({
            Bucket: bucketName,
            Key: key,
          })
        );
        existingTags = (tagsResponse.TagSet || []).map((t) => ({
          Key: t.Key || "",
          Value: t.Value || "",
        }));
      } catch {
        // No existing tags - that's fine
      }

      // Update tags: remove old starred tag, add new one if starred
      const updatedTags = existingTags.filter((t) => t.Key !== "starred");
      if (starred) {
        updatedTags.push({ Key: "starred", Value: "true" });
      }

      // Save updated tags
      await s3Client.send(
        new PutObjectTaggingCommand({
          Bucket: bucketName,
          Key: key,
          Tagging: { TagSet: updatedTags },
        })
      );

      res.json({ success: true, key, starred });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[CDN] Error toggling star:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Delete a file from S3
   */
  router.delete("/files/:key(*)", async (req: Request, res: Response) => {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(400).json({ error: "File key is required" });
      }

      // Load metadata to check if storage is configured
      const metadata = await loadConnectionMetadata(
        config.accountId || "",
        config.region
      );

      if (!metadata?.services.cdn) {
        return res.status(404).json({
          error: "No CDN infrastructure found for this account and region",
        });
      }

      const bucketName =
        config.cdnBucketName || `wraps-cdn-${config.accountId}`;

      const { S3Client, DeleteObjectCommand } = await import(
        "@aws-sdk/client-s3"
      );
      const { assumeRole } = await import("../../utils/shared/assume-role.js");

      const credentials =
        config.cdnRoleArn || config.roleArn
          ? await assumeRole(
              config.cdnRoleArn || config.roleArn!,
              config.region
            )
          : undefined;
      const s3Client = new S3Client({ region: config.region, credentials });

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );

      res.json({ success: true, key });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[CDN] Error deleting file:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  /**
   * Rename a file in S3 (copy + delete)
   */
  router.post("/files/rename", async (req: Request, res: Response) => {
    try {
      const { oldKey, newKey } = req.body;

      if (!(oldKey && newKey)) {
        return res
          .status(400)
          .json({ error: "oldKey and newKey are required" });
      }

      if (oldKey === newKey) {
        return res.status(400).json({ error: "New name must be different" });
      }

      // Load metadata to check if storage is configured
      const metadata = await loadConnectionMetadata(
        config.accountId || "",
        config.region
      );

      if (!metadata?.services.cdn) {
        return res.status(404).json({
          error: "No CDN infrastructure found for this account and region",
        });
      }

      const bucketName =
        config.cdnBucketName || `wraps-cdn-${config.accountId}`;

      const { S3Client, CopyObjectCommand, DeleteObjectCommand } = await import(
        "@aws-sdk/client-s3"
      );
      const { assumeRole } = await import("../../utils/shared/assume-role.js");

      const credentials =
        config.cdnRoleArn || config.roleArn
          ? await assumeRole(
              config.cdnRoleArn || config.roleArn!,
              config.region
            )
          : undefined;
      const s3Client = new S3Client({ region: config.region, credentials });

      // Copy to new key
      await s3Client.send(
        new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: `${bucketName}/${oldKey}`,
          Key: newKey,
        })
      );

      // Delete old key
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: oldKey,
        })
      );

      // Build new CDN URL
      const cdnUrl = metadata.services.cdn.config.cdn?.customDomain
        ? `https://${metadata.services.cdn.config.cdn.customDomain}/${newKey}`
        : config.cdnDistributionDomain
          ? `https://${config.cdnDistributionDomain}/${newKey}`
          : `s3://${bucketName}/${newKey}`;

      res.json({ success: true, oldKey, newKey, cdnUrl });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[CDN] Error renaming file:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  return router;
}
