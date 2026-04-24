"use client";

import { useEffect, useState } from "react";

type TransactionResultModalProps = {
  txHash: string | null;
  amount: string;
  assetCode: string;
  recipientDisplayName: string;
  isOpen: boolean;
  onClose: () => void;
};

export function TransactionResultModal({
  txHash,
  amount,
  assetCode,
  recipientDisplayName,
  isOpen,
  onClose,
}: TransactionResultModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !txHash) return null;

  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(explorerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-gold/20 via-ink to-ink p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {/* Success Icon */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-mint/10 text-mint">
            <svg
              className="h-10 w-10 animate-bounce"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h3 className="mb-2 text-2xl font-bold text-white">Support Sent!</h3>
          <p className="mb-8 text-sky/80">
            You successfully sent <span className="font-bold text-white">{amount} {assetCode}</span> to <span className="font-bold text-white">{recipientDisplayName}</span>.
          </p>

          {/* Transaction Info */}
          <div className="mb-8 w-full rounded-2xl border border-white/5 bg-white/5 p-4">
            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-sky/50">Transaction Hash</p>
            <p className="font-mono text-sm text-mint">{truncateHash(txHash)}</p>
            
            <div className="mt-4 flex gap-2">
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                View on Explorer
              </a>
              <button
                onClick={handleCopy}
                className="flex-1 rounded-xl bg-mint px-4 py-2 text-xs font-semibold text-ink transition hover:bg-white"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-full bg-white px-8 py-3 font-bold text-ink transition hover:bg-mint"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
