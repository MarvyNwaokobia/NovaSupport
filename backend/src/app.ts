import cors from "cors";
import express from "express";
import { z } from "zod";
import { prisma } from "./db.js";

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
