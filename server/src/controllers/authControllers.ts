import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../config/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { refreshTokenCookieOptions } from "../config/cookies";

// Resolve Google OAuth client ID from env (trimmed — avoids copy/paste whitespace issues)
function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured on the server");
  }
  return clientId;
}

// google login function

export const googleLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ message: "idToken is required" });
      return;
    }

    const clientId = getGoogleClientId();
    const googleClient = new OAuth2Client(clientId);

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(401).json({ message: "Invalid Google token" });
      return;
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!googleId || !email || !name) {
      res.status(400).json({ message: "Incomplete Google profile" });
      return;
    }

    const user = await prisma.user.upsert({
      where: { googleId },
      update: {
        name,
        avatarUrl: picture,
      },
      create: {
        googleId,
        email,
        name,
        avatarUrl: picture,
        // OAuth-created senders are placeholders — the user must configure
        // SMTP credentials (App Password) before they can send campaigns.
        // isVerified defaults to false via the schema.
        senders: {
          create: {
            email,
            name,
            appPassword: "",
          },
        },
      },
    });
    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
    });

    const refreshToken = signRefreshToken({
      id: user.id,
    });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    console.error("[auth/google] login failed:", message);

    // Google token validation errors — client/config issue, not a server crash
    const isGoogleAuthError =
      message.includes("Token used too late") ||
      message.includes("Wrong recipient") ||
      message.includes("audience") ||
      message.includes("segments in token") ||
      message.includes("No pem found") ||
      error?.name === "GaxiosError";

    if (isGoogleAuthError) {
      res.status(401).json({
        message:
          "Google sign-in could not be verified. Check that GOOGLE_CLIENT_ID matches in server/.env and client/.env, and that http://localhost:3100 is an authorized JavaScript origin in Google Cloud Console.",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      });
      return;
    }

    if (message.includes("GOOGLE_CLIENT_ID is not configured")) {
      res.status(500).json({ message });
      return;
    }

    res.status(500).json({
      message: "Google login failed. Please try again.",
      ...(process.env.NODE_ENV === "development" && { detail: message }),
    });
  }
};

// refresh token function

export const refreshAccessToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ message: "Missing refresh token" });
      return;
    }

    let payload: { id: string };

    try {
      payload = verifyRefreshToken(refreshToken) as { id: string };
    } catch {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!stored || stored.revoked) {
      res.status(401).json({ message: "Token revoked" });
      return;
    }

    // WHY check expiresAt: A token that's revoked=false but past its expiry
    // should still be rejected. Without this check, expired tokens would be
    // accepted indefinitely as long as they weren't explicitly revoked.
    if (stored.expiresAt < new Date()) {
      res.status(401).json({ message: "Refresh token expired" });
      return;
    }

    // 🔁 Rotate refresh token
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revoked: true },
    });

    const newAccessToken = signAccessToken({ id: payload.id });
    const newRefreshToken = signRefreshToken({ id: payload.id });

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: payload.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions);

    res.json({
      accessToken: newAccessToken,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to refresh access token",
    });
  }
};

// logout function
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      });
    }

    res.clearCookie("refreshToken", { path: "/auth/refresh" });
    res.sendStatus(204);
  } catch (error: any) {
    res.status(500).json({
      message: "Logout failed",
    });
  }
};
