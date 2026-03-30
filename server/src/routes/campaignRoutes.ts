import { Router } from "express";
import {
  createCampaign,
  getAllCampaigns,
  getCompletedCampaigns,
  getCampaignById,
  getCampaignThrottleStatus,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  searchCampaigns,
} from "../controllers/campaignControllers";

const router = Router();

router.get("/search", searchCampaigns);
router.post("/", createCampaign);
router.get("/", getAllCampaigns);
router.get("/complete", getCompletedCampaigns);
router.get("/:id", getCampaignById);
router.get("/:id/throttle-status", getCampaignThrottleStatus);
router.patch("/:id/pause", pauseCampaign);
router.patch("/:id/resume", resumeCampaign);
router.patch("/:id/cancel", cancelCampaign);

export default router;
