function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Check frontend/.env.example.`
    );
  }
  return value;
}

export const HORIZON_URL = requireEnv("NEXT_PUBLIC_HORIZON_URL");
export const API_BASE_URL = requireEnv("NEXT_PUBLIC_API_BASE_URL");

export const STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
  "Test SDF Network ; September 2015";

