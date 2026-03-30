import api from "./axios";
import type {
  CreateSenderPayload,
  CreateCampaignPayload,
  SenderResponse,
  Campaign,
  CampaignDetail,
  EmailJob,
  User,
  UploadedAttachment,
  EmailTemplate,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  SequenceResponse,
} from "@/types";

// ─── Auth ───

export const loginWithGoogle = async (idToken: string) => {
  const res = await api.post("/auth/google", { idToken });
  return res.data;
};

export const refreshAccessToken = async () => {
  const res = await api.post("/auth/refresh");
  return res.data;
};

export const logout = async (): Promise<void> => {
  await api.post("/auth/logout");
};

// ─── Users ───

export const getUser = async (): Promise<User> => {
  const res = await api.get("/users");
  return res.data;
};

// ─── Senders ───

export const getSenders = async (): Promise<SenderResponse[]> => {
  const res = await api.get("/senders");
  return res.data;
};

// FIX: Was sending empty POST — now accepts CreateSenderPayload
export const createSender = async (
  data: CreateSenderPayload
): Promise<SenderResponse> => {
  const res = await api.post("/senders", data);
  return res.data;
};

// Verify an existing unverified sender by adding SMTP credentials
export const verifySender = async (
  senderId: string,
  data: { name?: string; appPassword: string; skipWarmup?: boolean }
): Promise<SenderResponse> => {
  const res = await api.patch(`/senders/${senderId}/verify`, data);
  return res.data;
};

// Get sender detail with throttle information
export const getSenderById = async (senderId: string): Promise<SenderResponse & {
  currentHourlyCount: number;
  currentDailyCount: number;
  effectiveDailyLimit: number;
  warmupStatus: string;
  cooldownState: { status: string; expiresAt: string | null };
}> => {
  const res = await api.get(`/senders/${senderId}`);
  return res.data;
};

// ─── Campaigns ───

export const createCampaign = async (
  data: CreateCampaignPayload
): Promise<{ campaignId: string; message: string }> => {
  const res = await api.post("/campaigns", data);
  return res.data;
};

// ─── Emails ───

export const toggleEmailStar = async (emailId: string): Promise<EmailJob> => {
  const res = await api.patch(`/emails/${emailId}/star`);
  return res.data;
};

// ─── Attachments ───

// WHY FormData: The upload endpoint expects multipart/form-data, not JSON.
// Axios automatically sets the Content-Type header to multipart/form-data
// when the body is a FormData instance.
export const uploadAttachments = async (
  files: File[],
): Promise<UploadedAttachment[]> => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await api.post("/attachments/upload", formData);
  return res.data;
};

export const deleteAttachment = async (url: string): Promise<void> => {
  await api.delete("/attachments/delete", { data: { url } });
};


// ─── Templates ───

export const getTemplates = async (): Promise<EmailTemplate[]> => {
  const res = await api.get("/templates");
  return res.data;
};

export const createTemplate = async (
  data: CreateTemplatePayload
): Promise<EmailTemplate> => {
  const res = await api.post("/templates", data);
  return res.data;
};

export const updateTemplate = async (
  id: string,
  data: UpdateTemplatePayload
): Promise<EmailTemplate> => {
  const res = await api.put(`/templates/${id}`, data);
  return res.data;
};

export const deleteTemplate = async (id: string): Promise<void> => {
  await api.delete(`/templates/${id}`);
};


// ─── Campaign Controls ───

export const getCampaignById = async (id: string): Promise<CampaignDetail> => {
  const res = await api.get(`/campaigns/${id}`);
  return res.data;
};

export const pauseCampaign = async (id: string): Promise<Campaign> => {
  const res = await api.patch(`/campaigns/${id}/pause`);
  return res.data;
};

export const resumeCampaign = async (id: string): Promise<Campaign> => {
  const res = await api.patch(`/campaigns/${id}/resume`);
  return res.data;
};

export const cancelCampaign = async (id: string): Promise<Campaign> => {
  const res = await api.patch(`/campaigns/${id}/cancel`);
  return res.data;
};

// Throttle status — per-sender rate limit data for a campaign
export const getCampaignThrottleStatus = async (id: string): Promise<{
  campaignId: string;
  senders: {
    senderId: string;
    email: string;
    name: string | null;
    currentHourlyCount: number;
    currentDailyCount: number;
    effectiveLimits: { perMinute: number; perHour: number; perDay: number };
    warmupStatus: string;
    cooldownState: { status: string; expiresAt: string | null };
  }[];
}> => {
  const res = await api.get(`/campaigns/${id}/throttle-status`);
  return res.data;
};


// ─── Sequences ───

export const getSequence = async (campaignId: string): Promise<SequenceResponse> => {
  const res = await api.get(`/campaigns/${campaignId}/sequence`);
  return res.data;
};

export const pauseRecipientSequence = async (campaignId: string, recipientId: string): Promise<void> => {
  await api.patch(`/campaigns/${campaignId}/sequence/recipients/${recipientId}/pause`);
};

export const resumeRecipientSequence = async (campaignId: string, recipientId: string): Promise<void> => {
  await api.patch(`/campaigns/${campaignId}/sequence/recipients/${recipientId}/resume`);
};

export const stopRecipientSequence = async (campaignId: string, recipientId: string): Promise<void> => {
  await api.patch(`/campaigns/${campaignId}/sequence/recipients/${recipientId}/stop`);
};

export const pauseAllSequence = async (campaignId: string): Promise<void> => {
  await api.patch(`/campaigns/${campaignId}/sequence/pause`);
};

export const resumeAllSequence = async (campaignId: string): Promise<void> => {
  await api.patch(`/campaigns/${campaignId}/sequence/resume`);
};

export const stopAllSequence = async (campaignId: string): Promise<void> => {
  await api.patch(`/campaigns/${campaignId}/sequence/stop`);
};

export const toggleReplied = async (emailId: string): Promise<EmailJob> => {
  const res = await api.patch(`/emails/${emailId}/replied`);
  return res.data;
};


// ─── Tracking ───

import type { TrackingMetrics, TrackingEmailDetail, TrackingLinkDetail } from "@/types";

export const getTrackingMetrics = async (campaignId: string): Promise<TrackingMetrics> => {
  const res = await api.get(`/api/tracking/campaigns/${campaignId}`);
  return res.data;
};

export const getTrackingEmails = async (campaignId: string): Promise<{ emails: TrackingEmailDetail[] }> => {
  const res = await api.get(`/api/tracking/campaigns/${campaignId}/emails`);
  return res.data;
};

export const getTrackingLinks = async (campaignId: string): Promise<{ links: TrackingLinkDetail[] }> => {
  const res = await api.get(`/api/tracking/campaigns/${campaignId}/links`);
  return res.data;
};


// ─── Search ───

export const searchEmails = async (params: Record<string, string>): Promise<{ results: any[]; total: number; filters: Record<string, string> }> => {
  const qs = new URLSearchParams(params).toString();
  const res = await api.get(`/emails/search?${qs}`);
  return res.data;
};

export const searchCampaigns = async (params: Record<string, string>): Promise<{ results: any[]; total: number; filters: Record<string, string> }> => {
  const qs = new URLSearchParams(params).toString();
  const res = await api.get(`/campaigns/search?${qs}`);
  return res.data;
};
