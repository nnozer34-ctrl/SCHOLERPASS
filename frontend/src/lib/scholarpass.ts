import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc as StellarRpc,
  scValToNative,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { config, rpc } from "./stellar";

export const SCHOLARPASS_CONTRACT_ID =
  import.meta.env.VITE_SCHOLARPASS_CONTRACT_ID ?? "";

export interface Achievement {
  id: number;
  student: string;
  issuer: string;
  title: string;
  category: string;
  issuerName: string;
  cid: string;
  issuedLedger: number;
}

export interface IssueAchievementInput {
  student: string;
  title: string;
  category: string;
  issuerName: string;
  cid: string;
}

function cleanPublicKey(address: string): string {
  return address.trim().toUpperCase();
}

function addressVal(address: string): xdr.ScVal {
  return Address.fromString(cleanPublicKey(address)).toScVal();
}

async function buildTx(
  userAddress: string,
  method: string,
  args: xdr.ScVal[] = []
) {
  const account = await rpc.getAccount(cleanPublicKey(userAddress));
  const contract = new Contract(SCHOLARPASS_CONTRACT_ID);

  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();
}

function normalizeAchievement(raw: Record<string, unknown>): Achievement {
  return {
    id: Number(raw.id ?? 0),
    student: String(raw.student ?? ""),
    issuer: String(raw.issuer ?? ""),
    title: String(raw.title ?? ""),
    category: String(raw.category ?? ""),
    issuerName: String(raw.issuer_name ?? raw.issuerName ?? ""),
    cid: String(raw.cid ?? ""),
    issuedLedger: Number(raw.issued_ledger ?? raw.issuedLedger ?? 0),
  };
}

export async function getAchievements(
  viewerAddress: string,
  studentAddress: string
): Promise<Achievement[]> {
  const tx = await buildTx(viewerAddress, "get_achievements", [
    addressVal(studentAddress),
  ]);
  const sim = await rpc.simulateTransaction(tx);
  if (StellarRpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.result) return [];

  const native = scValToNative(sim.result.retval);
  if (!Array.isArray(native)) return [];
  return native.map((item) => normalizeAchievement(item));
}

export async function isIssuer(
  viewerAddress: string,
  issuerAddress: string
): Promise<boolean> {
  const tx = await buildTx(viewerAddress, "is_issuer", [
    addressVal(issuerAddress),
  ]);
  const sim = await rpc.simulateTransaction(tx);
  if (StellarRpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.result) return false;
  return Boolean(scValToNative(sim.result.retval));
}

async function submitSignedTransaction(tx: Transaction, signerAddress: string) {
  const sim = await rpc.simulateTransaction(tx);
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error(String(sim.error));
  }

  const assembled = StellarRpc.assembleTransaction(tx, sim).build();
  const { signedTxXdr, error } = await signTransaction(assembled.toXDR(), {
    networkPassphrase: config.networkPassphrase,
    address: cleanPublicKey(signerAddress),
  });
  if (error) throw new Error(error);

  const signed = TransactionBuilder.fromXDR(
    signedTxXdr,
    config.networkPassphrase
  ) as Transaction;

  const response = await rpc.sendTransaction(signed);
  if (response.status === "ERROR") {
    throw new Error("Islem ag tarafindan reddedildi");
  }

  let result = await rpc.getTransaction(response.hash);
  while (result.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await rpc.getTransaction(response.hash);
  }

  if (result.status !== "SUCCESS") throw new Error("Islem basarisiz oldu");
  return result.returnValue;
}

export async function addIssuer(
  adminAddress: string,
  issuerAddress: string
): Promise<void> {
  const tx = await buildTx(adminAddress, "add_issuer", [
    addressVal(issuerAddress),
  ]);

  try {
    await submitSignedTransaction(tx, adminAddress);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (error.toLowerCase().includes("auth")) {
      throw new Error(
        "Issuer yetkisi sadece kontratı başlatan admin cüzdanıyla verilebilir"
      );
    }
    throw err;
  }
}

export async function issueAchievement(
  issuerAddress: string,
  input: IssueAchievementInput
): Promise<number> {
  const issuer = cleanPublicKey(issuerAddress);
  const tx = await buildTx(issuerAddress, "issue", [
    addressVal(issuer),
    addressVal(input.student),
    nativeToScVal(input.title.trim()),
    nativeToScVal(input.category.trim()),
    nativeToScVal(input.issuerName.trim()),
    nativeToScVal(input.cid.trim()),
  ]);
  try {
    const returnValue = await submitSignedTransaction(tx, issuer);
    return Number(scValToNative(returnValue!));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (error.toLowerCase().includes("issuer not authorized")) {
      throw new Error("Bu cüzdan belge mühürleme yetkisine sahip değil");
    }
    throw err;
  }
}
