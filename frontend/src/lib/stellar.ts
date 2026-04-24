import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder
} from "@stellar/stellar-sdk";

import { HORIZON_URL, STELLAR_NETWORK, NETWORK_PASSPHRASE } from "./config";
import { CONTRACT_ID } from "./config";
import { contractClient } from "./contract-client";

export const stellarConfig = {
  horizonUrl: HORIZON_URL,
  stellarNetwork: STELLAR_NETWORK,
  networkPassphrase: NETWORK_PASSPHRASE
};


export const horizonServer = new Horizon.Server(stellarConfig.horizonUrl);

export function isValidStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address);
}

export function getNetworkLabel(): string {
  return stellarConfig.stellarNetwork === "PUBLIC" ? "Mainnet" : "Testnet";
}

export function getDefaultNetworkPassphrase(): string {
  return stellarConfig.stellarNetwork === "PUBLIC"
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

type SupportIntentInput = {
  sourceAccount: string;
  destination: string;
  amount: string;
  memo?: string;
  assetCode?: string;
  assetIssuer?: string;
  sequence?: string;
};

export async function buildSupportIntent({
  sourceAccount,
  destination,
  amount,
  memo,
  assetCode,
  assetIssuer,
  sequence
}: SupportIntentInput) {
  // Prefer Soroban contract invocation when a contract ID is configured.
  if (CONTRACT_ID) {
    try {
      const contractXdr = await contractClient.buildSupportTransaction({
        sourceAccount,
        destination,
        amount,
        memo,
        assetCode,
        assetIssuer,
        sequence,
      });

      if (contractXdr) return contractXdr;
    } catch (err) {
      // If contract client/build fails, fall back to a native payment transaction.
      // Keep the error local and continue with the payment flow.
      // eslint-disable-next-line no-console
      console.warn("contract build failed, falling back to payment intent:", err);
    }
  }
  const account = sequence
    ? {
        accountId: () => sourceAccount,
        sequenceNumber: () => sequence,
        incrementSequenceNumber: () => undefined
      }
    : await horizonServer.loadAccount(sourceAccount);

  const asset =
    assetCode && assetIssuer
      ? new Asset(assetCode, assetIssuer)
      : Asset.native();

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: stellarConfig.networkPassphrase
  })
    .addOperation(
      Operation.payment({
        destination,
        asset,
        amount
      })
    )
    .setTimeout(30);

  if (memo) {
    transaction.addMemo(Memo.text(memo));
  }

  return transaction.build().toXDR();
}

export type PathPaymentIntentInput = {
  sourceAccount: string;
  sourceAsset: Asset;
  sourceAmount: string;
  destAsset: Asset;
  destAddress: string;
  slippageTolerance?: number; // default 0.02
  memo?: string;
};

export async function buildPathPaymentIntent({
  sourceAccount,
  sourceAsset,
  sourceAmount,
  destAsset,
  destAddress,
  slippageTolerance = 0.02,
  memo
}: PathPaymentIntentInput) {
  const paths = await horizonServer.strictSendPaths(sourceAsset, sourceAmount, [destAsset]).call();

  if (paths.records.length === 0) {
    throw new Error(`No DEX path found from ${sourceAsset.getCode()} to ${destAsset.getCode()}`);
  }

  const bestPath = paths.records[0];
  const estimatedDestAmount = bestPath.destination_amount;
  const destMin = (parseFloat(estimatedDestAmount) * (1 - slippageTolerance)).toFixed(7);

  const account = await horizonServer.loadAccount(sourceAccount);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: stellarConfig.networkPassphrase
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: sourceAsset,
        sendAmount: sourceAmount,
        destination: destAddress,
        destAsset: destAsset,
        destMin: destMin,
        path: bestPath.path.map((p: any) => 
          p.asset_type === 'native' ? Asset.native() : new Asset(p.asset_code, p.asset_issuer)
        )
      })
    )
    .setTimeout(30);

  if (memo) {
    transaction.addMemo(Memo.text(memo));
  }

  return transaction.build().toXDR();
}
