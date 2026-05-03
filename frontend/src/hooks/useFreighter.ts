import { useEffect, useState } from "react";
import {
  isConnected,
  isAllowed,
  setAllowed,
  getAddress,
  getNetwork,
} from "@stellar/freighter-api";

export type WalletStatus = "idle" | "connecting" | "connected" | "error";

export interface FreighterState {
  status: WalletStatus;
  address: string | null;
  network: string | null;
  error: string | null;
  isInstalled: boolean;
}

const initialState: FreighterState = {
  status: "idle",
  address: null,
  network: null,
  error: null,
  isInstalled: false,
};

let sharedState: FreighterState = initialState;
let installCheckStarted = false;
const listeners = new Set<(state: FreighterState) => void>();

function setSharedState(
  next:
    | FreighterState
    | ((current: FreighterState) => FreighterState)
) {
  sharedState =
    typeof next === "function"
      ? (next as (current: FreighterState) => FreighterState)(sharedState)
      : next;
  listeners.forEach((listener) => listener(sharedState));
}

function subscribe(listener: (state: FreighterState) => void) {
  listeners.add(listener);
  listener(sharedState);
  return () => {
    listeners.delete(listener);
  };
}

async function checkInstalled() {
  try {
    const connResult = await isConnected();
    if (!connResult.isConnected) {
      setSharedState((s) => ({ ...s, isInstalled: false }));
      return;
    }

    setSharedState((s) => ({ ...s, isInstalled: true }));

    const allowedResult = await isAllowed();
    if (!allowedResult.isAllowed) return;

    const addrResult = await getAddress();
    const netResult = await getNetwork();
    if (!addrResult.error && !netResult.error) {
      setSharedState({
        status: "connected",
        address: addrResult.address,
        network: netResult.network,
        error: null,
        isInstalled: true,
      });
    }
  } catch {
    setSharedState((s) => ({
      ...s,
      status: s.status === "connecting" ? "error" : s.status,
      error: s.status === "connecting" ? "Cüzdan durumu okunamadı" : s.error,
    }));
  }
}

async function connect() {
  setSharedState((s) => ({ ...s, status: "connecting", error: null }));

  try {
    const connResult = await isConnected();
    if (!connResult.isConnected) {
      setSharedState((s) => ({
        ...s,
        status: "error",
        error: "Freighter yüklü değil. Tarayıcı eklentisini kurun.",
        isInstalled: false,
      }));
      return;
    }

    await setAllowed();
    const addrResult = await getAddress();
    const netResult = await getNetwork();

    if (addrResult.error) {
      throw new Error("Adres alınamadı");
    }

    setSharedState({
      status: "connected",
      address: addrResult.address,
      network: netResult.network,
      error: null,
      isInstalled: true,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Bağlantı başarısız";
    setSharedState((s) => ({ ...s, status: "error", error: message }));
  }
}

function disconnect() {
  setSharedState((s) => ({
    ...s,
    status: "idle",
    address: null,
    network: null,
    error: null,
  }));
}

export function useFreighter() {
  const [state, setState] = useState<FreighterState>(sharedState);

  useEffect(() => {
    const unsubscribe = subscribe(setState);
    if (!installCheckStarted) {
      installCheckStarted = true;
      void checkInstalled();
    }
    return unsubscribe;
  }, []);

  return { ...state, connect, disconnect };
}
