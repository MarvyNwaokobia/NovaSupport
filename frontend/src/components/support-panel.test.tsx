import { useEffect } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SupportPanel } from '@/components/support-panel';
import { signTransaction } from '@stellar/freighter-api';
import { buildSupportIntent, horizonServer } from '@/lib/stellar';

// Mock @stellar/freighter-api
vi.mock('@stellar/freighter-api', () => ({
  getAddress: vi.fn(),
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk', () => ({
  TransactionBuilder: {
    fromXDR: vi.fn(() => ({ mocked: true })),
  },
}));

// Mock @/lib/config
vi.mock('@/lib/config', () => ({
  HORIZON_URL: 'https://horizon-testnet.stellar.org',
  API_BASE_URL: 'http://localhost:4000',
  STELLAR_NETWORK: 'TESTNET',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  CONTRACT_ID: '',
  SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
}));

vi.mock('@/lib/stellar', () => ({
  buildSupportIntent: vi.fn(),
  getNetworkLabel: vi.fn(() => 'Testnet'),
  horizonServer: {
    submitTransaction: vi.fn(),
    loadAccount: vi.fn().mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '100.0000000' }],
    }),
  },
  stellarConfig: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    stellarNetwork: 'TESTNET',
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
}));

// Mock WalletConnect to simulate connected state
vi.mock('./wallet-connect', () => ({
  WalletConnect: ({ onConnect }: { onConnect?: (address: string) => void }) => {
    useEffect(() => {
      onConnect?.('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    }, [onConnect]);

    return <div data-testid="wallet-connect-mock">WalletConnect Mock</div>;
  },
}));

describe('SupportPanel', () => {
  const mockProps = {
    walletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    acceptedAssets: [{ code: 'XLM' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits a signed transaction and shows the transaction hash', async () => {
    vi.mocked(buildSupportIntent).mockResolvedValue('unsigned-xdr');
    vi.mocked(signTransaction).mockResolvedValue({
      signedTxXdr: 'signed-xdr',
      signerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    vi.mocked(horizonServer.submitTransaction).mockResolvedValue({
      hash: '1234567890abcdef1234567890abcdef',
    } as never);

    render(<SupportPanel {...mockProps} />);

    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Support' }));

    await waitFor(() => {
      expect(screen.getByText(/Transaction submitted:/)).toBeInTheDocument();
    });

    expect(screen.getByText('12345678...90abcdef')).toBeInTheDocument();
  });

  it('shows a readable Horizon error message', async () => {
    vi.mocked(buildSupportIntent).mockResolvedValue('unsigned-xdr');
    vi.mocked(signTransaction).mockResolvedValue({
      signedTxXdr: 'signed-xdr',
      signerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    vi.mocked(horizonServer.submitTransaction).mockRejectedValue({
      response: {
        data: {
          extras: {
            result_codes: {
              transaction: 'tx_too_late',
            },
          },
        },
      },
    });

    render(<SupportPanel {...mockProps} />);

    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Support' }));

    await waitFor(() => {
      expect(screen.getByText('Transaction expired')).toBeInTheDocument();
    });
  });

  it('renders network info when connected', () => {
    render(<SupportPanel {...mockProps} />);
    
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Horizon')).toBeInTheDocument();
    expect(screen.getByText('Recipient')).toBeInTheDocument();
  });

  it('renders recipient address when connected', () => {
    render(<SupportPanel {...mockProps} />);
    
    expect(screen.getByText(mockProps.walletAddress)).toBeInTheDocument();
  });
});
