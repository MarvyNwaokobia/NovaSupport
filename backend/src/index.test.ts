import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { app } from "./app.js";
import { prisma } from "./db.js";

const baseUsername = "stellar-dev";
const seedEmail = "builder@novasupport.dev";
const walletAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

let baseUrl = "";
let profileId = "";
let server: ReturnType<typeof app.listen>;

async function seedProfile() {
  const user = await prisma.user.upsert({
    where: { email: seedEmail },
    update: {},
    create: {
      email: seedEmail
    }
  });

  const profile = await prisma.profile.upsert({
    where: { username: baseUsername },
    update: {},
    create: {
      username: baseUsername,
      displayName: "Stellar Dev Collective",
      bio: "Shipping guides, tools, and experiments that help more builders work on Stellar.",
      walletAddress,
      ownerId: user.id
    }
  });

  await prisma.acceptedAsset.deleteMany({
    where: {
      profileId: profile.id
    }
  });

  await prisma.acceptedAsset.createMany({
    data: [
      {
        code: "XLM",
        profileId: profile.id
      },
      {
        code: "USDC",
        issuer: "GA5ZSEJYB37Y5WZL56FWSOZ5LX5K7Q4SOX7YH3Y2AWJZQURQW6Z5YB2M",
        profileId: profile.id
      }
    ],
    skipDuplicates: true
  });

  profileId = profile.id;
}

async function startServer() {
  await seedProfile();

  server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function stopServer() {
  if (server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  await prisma.supportTransaction.deleteMany({
    where: {
      txHash: {
        startsWith: "ci-test-"
      }
    }
  });

  await prisma.$disconnect();
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function main() {
  await startServer();

  try {
    await runTest("returns health status", async () => {
      const response = await fetch(`${baseUrl}/health`);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ok: true,
        service: "NovaSupport backend",
        network: "Stellar Testnet"
      });
    });

    await runTest("returns a seeded profile with accepted assets", async () => {
      const response = await fetch(`${baseUrl}/profiles/${baseUsername}`);

      assert.equal(response.status, 200);

      const profile = await response.json();
      assert.equal(profile.username, baseUsername);
      assert.equal(profile.walletAddress, walletAddress);
      assert.equal(profile.acceptedAssets.length, 2);
    });

    await runTest("creates a support transaction when the payload is valid", async () => {
      const response = await fetch(`${baseUrl}/support-transactions`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          txHash: `ci-test-${randomUUID()}`,
          amount: "5.0000000",
          assetCode: "XLM",
          recipientAddress: walletAddress,
          profileId,
          message: "Thanks for maintaining NovaSupport."
        })
      });

      assert.equal(response.status, 201);

      const transaction = await response.json();
      assert.equal(transaction.assetCode, "XLM");
      assert.equal(transaction.status, "pending");
      assert.equal(transaction.profileId, profileId);
    });

    await runTest("returns a validation error for incomplete support payloads", async () => {
      const response = await fetch(`${baseUrl}/support-transactions`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          txHash: "bad"
        })
      });

      assert.equal(response.status, 400);

      const body = await response.json();
      assert.ok(body.error.fieldErrors.amount);
      assert.ok(body.error.fieldErrors.assetCode);
      assert.ok(body.error.fieldErrors.recipientAddress);
      assert.ok(body.error.fieldErrors.profileId);
    });

    await runTest("returns paginated transactions for a valid profile", async () => {
      const txHash = `ci-test-${randomUUID()}`;

      await fetch(`${baseUrl}/support-transactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          txHash,
          amount: "10.0000000",
          assetCode: "XLM",
          recipientAddress: walletAddress,
          profileId,
          stellarNetwork: "TESTNET",
          message: "Transaction pagination test"
        })
      });

      const response = await fetch(
        `${baseUrl}/profiles/${baseUsername}/transactions`
      );

      assert.equal(response.status, 200);

      const body = await response.json();
      assert.ok(Array.isArray(body.transactions));
      assert.equal(typeof body.total, "number");
      assert.ok(body.total >= 1);
      assert.equal(body.limit, 20);
      assert.equal(body.offset, 0);
    });

    await runTest("filters transactions by network query param", async () => {
      const response = await fetch(
        `${baseUrl}/profiles/${baseUsername}/transactions?network=TESTNET`
      );

      assert.equal(response.status, 200);

      const body = await response.json();
      assert.ok(Array.isArray(body.transactions));

      for (const tx of body.transactions) {
        assert.equal(tx.stellarNetwork, "TESTNET");
      }
    });

    await runTest("respects limit and offset query params", async () => {
      const response = await fetch(
        `${baseUrl}/profiles/${baseUsername}/transactions?limit=1&offset=0`
      );

      assert.equal(response.status, 200);

      const body = await response.json();
      assert.ok(body.transactions.length <= 1);
      assert.equal(body.limit, 1);
      assert.equal(body.offset, 0);
    });

    await runTest("returns 404 for transactions of unknown profile", async () => {
      const response = await fetch(
        `${baseUrl}/profiles/nonexistent-user/transactions`
      );

      assert.equal(response.status, 404);

      const body = await response.json();
      assert.equal(body.error, "Profile not found");
    });

    // Issue #229 — duplicate txHash returns 409 DUPLICATE_TX
    await runTest("returns 409 DUPLICATE_TX when same txHash submitted twice", async () => {
      const txHash = `ci-test-dup-${randomUUID()}`;
      const payload = {
        txHash,
        amount: "10.0000000",
        assetCode: "XLM",
        status: "completed",
        stellarNetwork: "TESTNET",
        recipientAddress: walletAddress,
        profileId,
      };

      const first = await fetch(`${baseUrl}/support-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      assert.equal(first.status, 201, "first submission should succeed");

      const second = await fetch(`${baseUrl}/support-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      assert.equal(second.status, 409, "second submission should return 409");

      const body = await second.json();
      assert.equal(body.code, "DUPLICATE_TX");
    });

    // Issue #204 — GET /profiles explore endpoint
    await runTest("GET /profiles returns paginated profile list", async () => {
      const response = await fetch(`${baseUrl}/profiles?limit=5&offset=0&sort=newest`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.ok(Array.isArray(body.profiles));
      assert.equal(typeof body.total, "number");
      assert.equal(body.limit, 5);
      assert.equal(body.offset, 0);
    });

    await runTest("GET /profiles?asset=XLM filters by accepted asset", async () => {
      const response = await fetch(`${baseUrl}/profiles?asset=XLM`);
      assert.equal(response.status, 200);
      const body = await response.json();
      for (const profile of body.profiles) {
        const codes = profile.acceptedAssets.map((a: { code: string }) => a.code);
        assert.ok(codes.includes("XLM"), `profile ${profile.username} should accept XLM`);
      }
    });

    // Issue #220 — Webhook CRUD
    await runTest("webhook: create, list, and delete", async () => {
      const user = await prisma.user.findUnique({ where: { email: seedEmail } });
      assert.ok(user, "seed user must exist");
      const headers = {
        "Content-Type": "application/json",
        "x-owner-id": user!.id,
      };

      // Create
      const createRes = await fetch(
        `${baseUrl}/profiles/${baseUsername}/webhooks`,
        { method: "POST", headers, body: JSON.stringify({ url: "https://example.com/hook" }) },
      );
      assert.equal(createRes.status, 201);
      const created = await createRes.json();
      assert.ok(created.id);
      assert.equal(created.url, "https://example.com/hook");
      assert.ok(created.secret, "secret must be present on creation");

      // List — secret must NOT be included
      const listRes = await fetch(`${baseUrl}/profiles/${baseUsername}/webhooks`, { headers });
      assert.equal(listRes.status, 200);
      const list = await listRes.json();
      assert.ok(list.some((w: { id: string }) => w.id === created.id));
      assert.ok(!list.some((w: Record<string, unknown>) => "secret" in w), "secret must not appear in list");

      // Delete
      const deleteRes = await fetch(
        `${baseUrl}/profiles/${baseUsername}/webhooks/${created.id}`,
        { method: "DELETE", headers },
      );
      assert.equal(deleteRes.status, 204);

      // Confirm gone
      const listAfter = await fetch(`${baseUrl}/profiles/${baseUsername}/webhooks`, { headers });
      const listAfterBody = await listAfter.json();
      assert.ok(!listAfterBody.some((w: { id: string }) => w.id === created.id));
    });

    await runTest("webhook: rejects http:// URLs", async () => {
      const user = await prisma.user.findUnique({ where: { email: seedEmail } });
      const res = await fetch(
        `${baseUrl}/profiles/${baseUsername}/webhooks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-owner-id": user!.id },
          body: JSON.stringify({ url: "http://insecure.example.com/hook" }),
        },
      );
      assert.equal(res.status, 400);
    });

    await runTest("webhook: non-owner cannot create", async () => {
      const res = await fetch(
        `${baseUrl}/profiles/${baseUsername}/webhooks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-owner-id": "not-the-owner" },
          body: JSON.stringify({ url: "https://example.com/hook" }),
        },
      );
      assert.equal(res.status, 403);
    });
  } finally {
    await stopServer();
  }
}

main().catch((error) => {
  console.error("Backend tests failed.");
  console.error(error);
  process.exit(1);
});
