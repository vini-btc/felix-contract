import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("Felix meta", () => {
  it("returns the tenure height", () => {
    const { result } = simnet.callReadOnlyFn(
      "felix-meta",
      "tenure-height",
      [],
      address1
    );
    expect(result).toBeUint(simnet.blockHeight);
    simnet.mineEmptyBlocks(10);
    const { result: newResult } = simnet.callReadOnlyFn(
      "felix-meta",
      "tenure-height",
      [],
      address1
    );
    expect(newResult).toBeUint(simnet.blockHeight);
  });
});
