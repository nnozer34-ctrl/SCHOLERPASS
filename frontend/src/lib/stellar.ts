import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  rpc as StellarRpc,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

export const NETWORK = "testnet";
export const RECORD_FEE_XLM =
  import.meta.env.VITE_SCHOLARPASS_RECORD_FEE_XLM ?? "10";
export const SERVICE_FEE_DESTINATION =
  import.meta.env.VITE_SCHOLARPASS_TREASURY_PUBLIC_KEY ?? "";

export const config = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  explorerUrl: "https://stellar.expert/explorer/testnet",
};

export const horizon = new Horizon.Server(config.horizonUrl);
export const rpc = new StellarRpc.Server(config.rpcUrl);

function cleanPublicKey(address: string): string {
  return address.trim().toUpperCase();
}

function normalizeXlmAmount(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Kayıt ücreti geçersiz yapılandırılmış");
  }
  return value.toFixed(7);
}

export function isServiceFeeConfigured() {
  // In testing mode: any non-empty treasury address is accepted
  // For production: implement proper Stellar address validation with StrKey
  if (SERVICE_FEE_DESTINATION && SERVICE_FEE_DESTINATION.trim().length > 0) {
    return true;
  }
  return false;
}

export async function payRecordFee(userAddress: string): Promise<string> {
  const sourceAddress = cleanPublicKey(userAddress);
  const destination = cleanPublicKey(SERVICE_FEE_DESTINATION);
  const amount = normalizeXlmAmount(RECORD_FEE_XLM);

  if (!StrKey.isValidEd25519PublicKey(sourceAddress)) {
    throw new Error("Ödeme için geçerli bir kullanıcı cüzdanı gerekiyor");
  }

  if (!StrKey.isValidEd25519PublicKey(destination)) {
    throw new Error(
      "Tahsilat cüzdanı yapılandırılmadı. VITE_SCHOLARPASS_TREASURY_PUBLIC_KEY eklenmeli."
    );
  }

  if (sourceAddress === destination) {
    throw new Error("Tahsilat cüzdanı kullanıcı cüzdanıyla aynı olamaz");
  }

  const [sourceAccount] = await Promise.all([
    horizon.loadAccount(sourceAddress),
    horizon.loadAccount(destination).catch((err) => {
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        throw new Error("Tahsilat cüzdanı testnet üzerinde fonlanmamış");
      }
      throw err;
    }),
  ]);

  const xlm = sourceAccount.balances.find((balance) => balance.asset_type === "native");
  if (Number(xlm?.balance ?? 0) < Number(RECORD_FEE_XLM)) {
    throw new Error(`Kayıt ücreti için en az ${RECORD_FEE_XLM} XLM gerekiyor`);
  }

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount,
      })
    )
    .addMemo(Memo.text("ScholarPass fee"))
    .setTimeout(180)
    .build();

  const { signedTxXdr, error } = await signTransaction(tx.toXDR(), {
    networkPassphrase: config.networkPassphrase,
    address: sourceAddress,
  });

  if (error) throw new Error(error);

  const signed = TransactionBuilder.fromXDR(signedTxXdr, config.networkPassphrase);
  const response = await horizon.submitTransaction(signed);

  if (!response.hash) {
    throw new Error("Kayıt ücreti transferi doğrulanamadı");
  }

  return response.hash;
}

export async function getAccountInfo(address: string) {
  try {
    const account = await horizon.loadAccount(address);
    const xlmBalance = account.balances.find((b) => b.asset_type === "native");
    return {
      address,
      balance: xlmBalance?.balance ?? "0",
      sequence: account.sequence,
      subentryCount: account.subentry_count,
    };
  } catch (err: unknown) {
    const e = err as { response?: { status: number } };
    if (e?.response?.status === 404) {
      return { address, balance: "0", sequence: "0", subentryCount: 0 };
    }
    throw err;
  }
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function explorerLink(address: string): string {
  return `${config.explorerUrl}/account/${address}`;
}
