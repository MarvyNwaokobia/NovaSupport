import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileCard } from "@/components/profile-card";
import { SupportPanel } from "@/components/support-panel";
import { API_BASE_URL } from "@/lib/config";

type PageProps = {
  params: {
    username: string;
  };
};

type Profile = {
  username: string;
  displayName: string;
  bio: string;
  walletAddress: string;
  acceptedAssets: Array<{ code: string; issuer?: string | null }>;
};

type SupportTx = {
  txHash: string;
  amount: string;
  assetCode: string;
  message?: string | null;
  createdAt: string;
  senderAddress: string;
};

async function getProfile(username: string): Promise<Profile> {
  const res = await fetch(`${API_BASE_URL}/profiles/${username}`, {
    next: { revalidate: 60 }
  });

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    throw new Error("Failed to fetch profile");
  }

  return res.json();
}

async function getTransactions(username: string, limit = 10): Promise<SupportTx[]> {
  const res = await fetch(
    `${API_BASE_URL}/profiles/${username}/transactions?limit=${limit}`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) return [];

  const body = await res.json();
  return body.transactions ?? [];
}

export default async function ProfilePage({ params }: PageProps) {
  const [profile, transactions] = await Promise.all([
    getProfile(params.username),
    getTransactions(params.username, 10),
  ]);

  return (
    <AppShell>
      <div className="space-y-8">
        <ProfileCard
          username={profile.username}
          displayName={profile.displayName}
          bio={profile.bio}
          walletAddress={profile.walletAddress}
          acceptedAssets={profile.acceptedAssets}
        />
        <SupportPanel walletAddress={profile.walletAddress} />

        {/* Support History Section */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold text-white">Support History</h2>
          {transactions.length === 0 ? (
            <p className="mt-3 text-sm text-sky/70">No support transactions yet. Be the first!</p>
          ) : (
            <div className="mt-4 space-y-3">
              {transactions.map((tx) => (
                <div key={tx.txHash} className="flex items-center justify-between gap-4 rounded-lg border border-white/6 p-3">
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium">{tx.amount} {tx.assetCode}</div>
                    {tx.message && (
                      <div className="text-xs text-sky/60 mt-1">
                        &quot;{tx.message}&quot;
                      </div>
                    )}
                    <div className="text-[11px] text-steel/60 mt-1">{new Date(tx.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="shrink-0">
                    <a
                      className="text-xs text-mint underline"
                      href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-8)}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

