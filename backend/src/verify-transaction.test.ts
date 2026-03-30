import assert from "node:assert/strict";
import { Horizon } from "@stellar/stellar-sdk";

const horizonUrl = "https://horizon-testnet.stellar.org";
const server = new Horizon.Server(horizonUrl);

async function runTests() {
  console.log("Running Transaction Verification tests...");

  // Valid successful transaction on Testnet
  const validHash = "687258079685320c270c5e933454378f8c6eb534e79ec3795c73c33324f9db21";
  try {
    const tx = await server.transactions().transaction(validHash).call();
    assert.strictEqual(tx.successful, true, "Known valid transaction should be successful");
    console.log("✅ Valid transaction check passed");
  } catch (e: any) {
    console.error("❌ Valid transaction check failed:", e.message);
  }

  // Invalid hash
  const invalidHash = "0000000000000000000000000000000000000000000000000000000000000000";
  try {
    await server.transactions().transaction(invalidHash).call();
    assert.fail("Should have thrown 404 for invalid hash");
  } catch (e: any) {
    if (e.response && e.response.status === 404) {
      console.log("✅ Invalid transaction check passed (404)");
    } else {
      console.error("❌ Invalid transaction check failed with unexpected error:", e.message);
    }
  }
}

runTests().catch(console.error);
