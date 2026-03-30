import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * POST /api/templates — Create a new email template for the authenticated user.
 */
export const createTemplate = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, subject, body } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ message: "Template name is required" });
      return;
    }

    if (!subject || typeof subject !== "string") {
      res.status(400).json({ message: "Missing required fields: subject" });
      return;
    }

    if (!body || typeof body !== "string") {
      res.status(400).json({ message: "Missing required fields: body" });
      return;
    }

    const template = await prisma.emailTemplate.create({
      data: {
        userId: req.user!.id,
        name: name.trim(),
        subject,
        body,
      },
    });

    res.status(201).json(template);
  } catch (error: any) {
    // Prisma unique constraint violation
    if (error?.code === "P2002") {
      res
        .status(409)
        .json({ message: "A template with this name already exists" });
      return;
    }
    res.status(500).json({ message: "Error processing template request" });
  }
};


/**
 * GET /api/templates — List all templates for the authenticated user,
 * ordered by most recently updated first.
 */
export const getTemplates = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: "desc" },
    });

    res.status(200).json(templates);
  } catch (error: any) {
    res.status(500).json({ message: "Error processing template request" });
  }
};

/**
 * PUT /api/templates/:id — Update an existing template.
 * Validates ownership (403) and existence (404).
 */
export const updateTemplate = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, subject, body } = req.body;

    const existing = await prisma.emailTemplate.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ message: "Template not found" });
      return;
    }

    if (existing.userId !== req.user!.id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      res.status(400).json({ message: "Template name is required" });
      return;
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(subject !== undefined && { subject }),
        ...(body !== undefined && { body }),
      },
    });

    res.status(200).json(template);
  } catch (error: any) {
    if (error?.code === "P2002") {
      res
        .status(409)
        .json({ message: "A template with this name already exists" });
      return;
    }
    res.status(500).json({ message: "Error processing template request" });
  }
};

/**
 * DELETE /api/templates/:id — Delete a template.
 * Validates existence (404) and ownership (403).
 */
export const deleteTemplate = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.emailTemplate.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ message: "Template not found" });
      return;
    }

    if (existing.userId !== req.user!.id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    await prisma.emailTemplate.delete({ where: { id } });

    res.status(200).json({ message: "Template deleted" });
  } catch (error: any) {
    res.status(500).json({ message: "Error processing template request" });
  }
};
