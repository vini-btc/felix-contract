export const range = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, k) => k + start);

export function getContractAddress(): string {
  return `${simnet.getAccounts().get("deployer")!}.felix-ticket`;
}

export const felixPrincipalAddress = "STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6";
