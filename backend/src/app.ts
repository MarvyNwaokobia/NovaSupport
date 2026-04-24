import cors from "cors";
import express, { Response } from "express";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
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
    walletAddress: z.string().startsWith("G").length(56),
    ownerId: z.string().min(1),
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

    const { username, displayName, bio, walletAddress, ownerId, acceptedAssets } = parsed.data;

    try {
      const profile = await prisma.profile.create({
        data: {
          username,
          displayName,
          bio,
          walletAddress,
          ownerId,
          acceptedAssets: { create: acceptedAssets },
        },
        include: { acceptedAssets: true },
      });
      return res.status(201).json(profile);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return sendError(res, 409, "Username already taken", "USERNAME_TAKEN");
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

  // Issue #229 — return 409 DUPLICATE_TX for duplicate txHash
  app.post("/support-transactions", async (req, res) => {
    const parsed = supportPayloadSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const supportRecord = await prisma.supportTransaction.create({
        data: parsed.data
      });
      res.status(201).json(supportRecord);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return sendError(res, 409, "Transaction already recorded", "DUPLICATE_TX");
      }
      return sendError(res, 500, "Internal server error");
    }
  });

  // Issue #204 — GET /profiles (explore page, paginated + sortable + asset filter)
  app.get("/profiles", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const sort = (req.query.sort as string) || "newest";
    const asset = req.query.asset as string | undefined;

    const assetFilter = asset
      ? { acceptedAssets: { some: { code: asset } } }
      : {};

    let orderBy: Prisma.ProfileOrderByWithRelationInput;
    if (sort === "most_supported") {
      orderBy = { supportTransactions: { _count: "desc" } };
    } else if (sort === "most_transactions") {
      orderBy = { supportTransactions: { _count: "desc" } };
    } else {
      orderBy = { createdAt: "desc" };
    }

    const [profiles, total] = await Promise.all([
      prisma.profile.findMany({
        where: assetFilter,
        take: limit,
        skip: offset,
        orderBy,
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          createdAt: true,
          acceptedAssets: { select: { code: true, issuer: true } },
        },
      }),
      prisma.profile.count({ where: assetFilter }),
    ]);

    res.json({ profiles, total, limit, offset });
  });

  // Issue #220 — Webhook CRUD endpoints
  const webhookCreateSchema = z.object({
    url: z.string().url().startsWith("https://"),
  });

  // Helper: resolve profile and verify owner
  async function resolveProfileOwner(
    username: string,
    ownerId: string,
    res: Response,
  ) {
    const profile = await prisma.profile.findUnique({ where: { username } });
    if (!profile) {
      sendError(res, 404, "Profile not found");
      return null;
    }
    if (profile.ownerId !== ownerId) {
      sendError(res, 403, "Forbidden");
      return null;
    }
    return profile;
  }

  app.post("/profiles/:username/webhooks", async (req, res) => {
    const ownerId = req.headers["x-owner-id"] as string;
    if (!ownerId) return sendError(res, 401, "Unauthorized");

    const parsed = webhookCreateSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Invalid URL — must be a valid HTTPS URL");

    const profile = await resolveProfileOwner(req.params.username, ownerId, res);
    if (!profile) return;

    const secret = randomBytes(32).toString("hex");
    const webhook = await prisma.webhook.create({
      data: { url: parsed.data.url, secret, profileId: profile.id },
    });

    return res.status(201).json({ id: webhook.id, url: webhook.url, secret });
  });

  app.get("/profiles/:username/webhooks", async (req, res) => {
    const ownerId = req.headers["x-owner-id"] as string;
    if (!ownerId) return sendError(res, 401, "Unauthorized");

    const profile = await resolveProfileOwner(req.params.username, ownerId, res);
    if (!profile) return;

    const webhooks = await prisma.webhook.findMany({
      where: { profileId: profile.id },
      select: { id: true, url: true, active: true, createdAt: true },
    });

    return res.json(webhooks);
  });

  app.delete("/profiles/:username/webhooks/:id", async (req, res) => {
    const ownerId = req.headers["x-owner-id"] as string;
    if (!ownerId) return sendError(res, 401, "Unauthorized");

    const profile = await resolveProfileOwner(req.params.username, ownerId, res);
    if (!profile) return;

    const webhook = await prisma.webhook.findFirst({
      where: { id: req.params.id, profileId: profile.id },
    });
    if (!webhook) return sendError(res, 404, "Webhook not found");

    await prisma.webhook.delete({ where: { id: webhook.id } });
    return res.status(204).send();
  });

  return app;
}

export const app = createApp();
