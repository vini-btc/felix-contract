import { describe, expect, it } from "vitest";
import { trueCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const contractName = `felix-ticket`;
const startBlock = 10;
const endBlock = 50;
const funder = accounts.get("wallet_2")!;
const felix = accounts.get("felix")!;

describe("start", () => {
  it("can only be started from its defined start block", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlock();
    const { result: startBeforeStartBlock } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      funder
    );
    expect(startBeforeStartBlock).toBeErr(uintCV(500));
    simnet.mineEmptyBlocks(startBlock);
    const { result: startAfterStartBlock } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      funder
    );
    expect(startAfterStartBlock).toBeOk(trueCV());
  });

  it("can only be started if it was already funded", async () => {
    simnet.mineEmptyBlocks(startBlock);
    const { result: startBeforeFunding } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      funder
    );
    expect(startBeforeFunding).toBeErr(uintCV(501));
    simnet.callPublicFn(contractName, "fund", [], funder);
    const { result: startAfterFunding } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      funder
    );
    expect(startAfterFunding).toBeOk(trueCV());
  });

  describe("can only be started if it was in funding before", () => {
    it("can't be started if it is finished", async () => {
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBlocks(startBlock);
      simnet.callPublicFn(contractName, "start", [], funder);
      simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
      simnet.callPublicFn(contractName, "draw-numbers", [], funder);
      const { result } = simnet.callPublicFn(contractName, "start", [], funder);
      expect(result).toBeErr(uintCV(502));
    });

    it("can't be started if it is cancelled", async () => {
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBlocks(startBlock);
      simnet.callPublicFn(contractName, "cancel", [], felix);
      const { result } = simnet.callPublicFn(contractName, "start", [], funder);
      expect(result).toBeErr(uintCV(502));
    });
  });
});
