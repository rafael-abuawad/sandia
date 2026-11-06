import { STELLAR_NETWORK_PASSPHRASE } from "@/lib/stellar/constants";

/**
 * External Stellar wallets for payers, through Stellar Wallets Kit (Freighter, LOBSTR, xBull, and
 * others). Loaded on demand, because the kit is large and touches `window`.
 */
async function loadKit() {
  const [{ StellarWalletsKit }, { defaultModules }] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit/sdk"),
    import("@creit.tech/stellar-wallets-kit/modules/utils"),
  ]);
  return { StellarWalletsKit, defaultModules };
}

let initialized = false;

async function kit() {
  const { StellarWalletsKit, defaultModules } = await loadKit();
  if (!initialized) {
    StellarWalletsKit.init({ modules: defaultModules() });
    initialized = true;
  }
  return StellarWalletsKit;
}

/** Opens the wallet picker and returns the chosen account. */
export async function connectPayerWallet(): Promise<string> {
  const instance = await kit();
  const { address } = await instance.authModal();
  return address;
}

export async function disconnectPayerWallet(): Promise<void> {
  const instance = await kit();
  await instance.disconnect();
}

export async function signWithPayerWallet(xdr: string, address: string): Promise<string> {
  const instance = await kit();
  const { signedTxXdr } = await instance.signTransaction(xdr, {
    address,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}
