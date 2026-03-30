"use client";

import { useState } from "react";
import { getNetworkLabel, stellarConfig } from "@/lib/stellar";
import { WalletConnect } from "./wallet-connect";

type Asset = {
  code: string;
  issuer?: string | null;
};

type SupportPanelProps = {
  walletAddress: string;
  acceptedAssets: Asset[];
};

export function SupportPanel({ walletAddress, acceptedAssets }: SupportPanelProps) {
  const [visitorAddress, setVisitorAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const networkLabel = getNetworkLabel();

  const selectedAsset = acceptedAssets[0];
  const amountNum = parseFloat(amount);
  const isValidAmount = amountNum > 0;
  const showError = amount !== "" && !isValidAmount;

  if (!visitorAddress) {
    return (
      <section className="rounded-[2rem] border border-gold/25 bg-gold/10 p-7 text-center">
        <div className="mb-4">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            {networkLabel}
          </span>
        </div>
        <p className="mb-4 text-sm text-sky/85">
          Connect your Freighter wallet to support this creator.
        </p>
        <WalletConnect onConnect={setVisitorAddress} />
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-gold/25 bg-gold/10 p-7">
      <div className="mb-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          {networkLabel}
        </span>
      </div>
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Support intent</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Ready for a real Stellar flow</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-sky/85">
        This MVP intentionally stops at wallet connection and transaction preparation.
        The next implementation step is to build and sign a {networkLabel} payment to the
        recipient address below, then store the resulting hash through the backend.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-ink/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-sky/70">Network</p>
          <p className="mt-2 font-semibold text-white">{getNetworkLabel()}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-ink/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-sky/70">Horizon</p>
          <p className="mt-2 break-all text-sm text-white">{stellarConfig.horizonUrl}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-ink/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-sky/70">Recipient</p>
          <p className="mt-2 break-all text-sm text-white">{walletAddress}</p>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mt-6">
        <label className="text-xs uppercase tracking-[0.2em] text-sky/70 block mb-2">
          Amount
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0.0000001"
            step="0.0000001"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-sky/50 focus:border-mint/50 focus:outline-none"
          />
          <div className="flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-sky/80 min-w-[80px] justify-center">
            <span className="font-semibold text-white">{selectedAsset?.code || "XLM"}</span>
          </div>
        </div>
        {showError && (
          <p className="mt-2 text-xs text-red-400">
            Please enter a positive amount
          </p>
        )}
      </div>

      {/* Send Support Button */}
      <button
        type="button"
        disabled={!isValidAmount}
        className="mt-6 w-full rounded-full bg-mint px-5 py-3 text-sm font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-mint"
      >
        Send Support
      </button>
    </section>
  );
}
