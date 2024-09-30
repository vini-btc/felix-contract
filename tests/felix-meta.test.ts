import { uintCV } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("Felix meta", () => {
  it("returns the tenure height", () => {
    const { result } = simnet.callReadOnlyFn(
      "felix-meta-v2",
      "tenure-height",
      [],
      address1
    );
    expect(result).toBeUint(simnet.blockHeight);
    simnet.mineEmptyBlocks(10);
    const { result: newResult } = simnet.callReadOnlyFn(
      "felix-meta-v2",
      "tenure-height",
      [],
      address1
    );
    expect(newResult).toBeUint(simnet.blockHeight);
  });

  it("returns a random number", () => {
    simnet.mineEmptyBlocks(20);
    const { result } = simnet.callReadOnlyFn(
      "felix-meta-v2",
      "get-rnd",
      [uintCV(10)],
      address1
    );
    expect(result).toBeOk(
      uintCV(BigInt("231992787495051191161002758720271105674"))
    );
  });
});
