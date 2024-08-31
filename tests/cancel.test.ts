import { describe, expect, it } from "vitest";
import { stringAsciiCV, trueCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const contractName = `felix-ticket`;
const startBlock = 10;
const funder = accounts.get("wallet_2")!;
const felix = accounts.get("felix")!;

describe("cancel", () => {
  it("can only be cancelled by the lottery admin", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(contractName, "start", [], funder);
    const { result: notAdmin } = simnet.callPublicFn(
      contractName,
      "cancel",
      [],
      funder
    );
    expect(notAdmin).toBeErr(uintCV(2_000));
    const { result: admin } = simnet.callPublicFn(
      contractName,
      "cancel",
      [],
      felix
    );
    expect(admin).toBeOk(trueCV());

    const { result: status } = simnet.callReadOnlyFn(
      contractName,
      "get-status",
      [],
      felix
    );
    expect(status).toBeOk(stringAsciiCV("cancelled"));
  });
});
