const ADDRESS = /^0x[a-f0-9]{40}$/;

/** Stable Convex subject for a Kernel. Not a bare address. */
export function kernelAuthSubject(address: string): string {
  return `kd:${address.toLowerCase()}`;
}

export function sandiaLinkMessage(nonce: string): string {
  return `Sandia link\n${nonce}`;
}

export function isKernelAuthSubject(subject: string, address: string): boolean {
  return ADDRESS.test(address.toLowerCase()) && subject === kernelAuthSubject(address);
}
