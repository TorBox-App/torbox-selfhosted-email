"use client";

import { useQuery } from "@tanstack/react-query";

export type SMSAnalyticsOverview = {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalQueued: number;
  deliveryRate: number;
  failureRate: number;
};

export type PhoneNumberInfo = {
  phoneNumber: string;
  phoneNumberArn: string;
  numberType: string;
  status: string;
  capabilities: string[];
  twoWayEnabled: boolean;
  selfManagedOptOutsEnabled: boolean;
  isoCountryCode: string;
  messageType: string;
  monthlyLeasingPrice: string;
};

export type RegistrationInfo = {
  registrationArn: string;
  registrationId: string;
  registrationType: string;
  registrationStatus: string;
  approvedVersionNumber?: number;
  latestDeniedVersionNumber?: number;
  additionalAttributes?: Record<string, string>;
  createdTimestamp: string;
};

export type SpendLimitInfo = {
  name: string;
  enforcedLimit: number;
  maxLimit: number;
  overridden: boolean;
};

export type SMSStatus = {
  phoneNumbers: PhoneNumberInfo[];
  registrations: RegistrationInfo[];
  spendLimits: SpendLimitInfo[];
  hasSMSInfrastructure: boolean;
};

export function useSMSAnalyticsOverview(orgSlug: string, days = 30) {
  return useQuery<SMSAnalyticsOverview>({
    queryKey: ["analytics", "sms", "overview", orgSlug, days],
    queryFn: async () => {
      const response = await fetch(
        `/api/${orgSlug}/analytics/sms/overview?days=${days}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch SMS analytics overview");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSMSStatus(orgSlug: string) {
  return useQuery<SMSStatus>({
    queryKey: ["analytics", "sms", "status", orgSlug],
    queryFn: async () => {
      const response = await fetch(`/api/${orgSlug}/analytics/sms/status`);
      if (!response.ok) {
        throw new Error("Failed to fetch SMS status");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export type SMSVolumeDataPoint = {
  date: string;
  timestamp: number;
  sent: number;
  delivered: number;
  failed: number;
};

export function useSMSVolumeData(orgSlug: string, days = 90) {
  return useQuery<SMSVolumeDataPoint[]>({
    queryKey: ["analytics", "sms", "volume", orgSlug, days],
    queryFn: async () => {
      const response = await fetch(
        `/api/${orgSlug}/analytics/sms/volume?days=${days}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch SMS volume data");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type SMSRecentActivity = {
  id: string;
  destinationNumber: string;
  eventType: string;
  eventStatus: string;
  timestamp: number;
  segments?: number;
  priceInUsd?: number;
};

export function useSMSRecentActivity(orgSlug: string, limit = 20) {
  return useQuery<SMSRecentActivity[]>({
    queryKey: ["analytics", "sms", "recent-activity", orgSlug, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/${orgSlug}/analytics/sms/recent-activity?limit=${limit}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch SMS recent activity");
      }
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
