import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error: any) {
    res.status(500).json({ message: "An error occurred while retrieving user" });
  }
};

export const getUserEmails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const take = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = parseInt(req.query.offset as string) || 0;

    const rows = await prisma.emailJob.findMany({
      where: {
        campaign: {
          userId,
        },
      },
      include: {
        campaign: {
          select: {
            subject: true,
            body: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });

    const emails = rows.map(({ campaign, ...email }) => ({
      email,
      campaign,
    }));

    res.status(200).json(emails);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching emails",
    });
  }
};
