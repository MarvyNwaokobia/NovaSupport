import cors from "cors";
import express, { Response } from "express";
import { z } from "zod";
import { prisma } from "./db.js";

function sendError(res: Response, status: number, message: string, code?: string) {
  return res.status(status).json({ error: message, ...(code ? { code } : {}) });
}

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "NovaSupport backend",
      network: "Stellar Testnet"
    });
  });

  app.get("/profiles/:username", async (req, res) => {
    const profile = await prisma.profile.findUnique({
      where: { username: req.params.username },
      include: {
        acceptedAssets: true
      }
    });

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json(profile);
  });

  const createProfileSchema = z.object({
    username: z.string().min(3).max(32).regex(/^[a-z0-9-]+$/),
    displayName: z.string().min(1).max(64),
    bio: z.string().max(280).optional().default(""),
    walletAddress: z.string().regex(/^G[A-Z0-9]{55}$/),
    ownerId: z.string().min(1),
    email: z.string().email().optional(),
    websiteUrl: z.string().url().startsWith("https://").optional(),
    twitterHandle: z.string().max(15).regex(/^[a-zA-Z0-9_]+$/).optional(),
    githubHandle: z.string().max(39).regex(/^[a-zA-Z0-9-]+$/).optional(),
    acceptedAssets: z.array(z.object({
      code: z.string().min(1).max(12),
      issuer: z.string().optional(),
    })).min(1),
  });

  app.post("/profiles", async (req, res) => {
    const parsed = createProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "Invalid request body");
    }

    const { 
      username, 
      displayName, 
      bio, 
      walletAddress, 
      ownerId, 
      acceptedAssets,
      email,
      websiteUrl,
      twitterHandle,
      githubHandle
    } = parsed.data;

    try {
      const profile = await prisma.profile.create({
        data: {
          username,
          displayName,
          bio,
          walletAddress,
          ownerId,
          email,
          websiteUrl,
          twitterHandle,
          githubHandle,
          acceptedAssets: { create: acceptedAssets },
        },
        include: { acceptedAssets: true },
      });
      return res.status(201).json(profile);
    } catch (e: any) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        const field = e.meta?.target?.includes("email") ? "Email" : "Username";
        return sendError(res, 409, `${field} already taken`, `${field.toUpperCase()}_TAKEN`);
      }
      return sendError(res, 500, "Internal server error");
    }
  });

  const supportPayloadSchema = z.object({
    txHash: z.string().min(3),
    amount: z.string().min(1),
    assetCode: z.string().min(1),
    assetIssuer: z.string().optional().nullable(),
    status: z.string().default("pending"),
    message: z.string().max(280).optional().nullable(),
    stellarNetwork: z.string().default("TESTNET"),
    supporterAddress: z.string().optional().nullable(),
    recipientAddress: z.string().min(1),
    profileId: z.string().min(1),
    supporterId: z.string().optional().nullable()
  });

  app.get("/profiles/:username/transactions", async (req, res) => {
    const { username } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const network = req.query.network as string | undefined;

    const profile = await prisma.profile.findUnique({
      where: { username }
    });

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const where = {
      recipientAddress: profile.walletAddress,
      ...(network ? { stellarNetwork: network } : {})
    };

    const [transactions, total] = await Promise.all([
      prisma.supportTransaction.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" }
      }),
      prisma.supportTransaction.count({ where })
    ]);

    res.json({ transactions, total, limit, offset });
  });

  app.post("/support-transactions", async (req, res) => {
    const parsed = supportPayloadSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const supportRecord = await prisma.supportTransaction.create({
      data: parsed.data
    });

    res.status(201).json(supportRecord);
  });

  return app;
}

export const app = createApp();
