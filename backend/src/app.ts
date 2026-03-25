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
      return sendError(res, 404, "Profile not found");
    }

    res.json(profile);
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
      return sendError(res, 404, "Profile not found");
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
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const supportRecord = await prisma.supportTransaction.create({
      data: parsed.data
    });

    res.status(201).json(supportRecord);
  });

  return app;
}

export const app = createApp();
