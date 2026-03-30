import { Router } from "express";
import {
  getCampaignTrackingMetrics,
  getCampaignTrackingEmails,
  getCampaignTrackingLinks,
} from "../controllers/trackingMetricsControllers";

const router = Router();

router.get("/campaigns/:campaignId", getCampaignTrackingMetrics);
router.get("/campaigns/:campaignId/emails", getCampaignTrackingEmails);
router.get("/campaigns/:campaignId/links", getCampaignTrackingLinks);

export default router;
