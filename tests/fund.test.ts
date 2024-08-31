import { describe, expect, it } from "vitest";
import { boolCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const contractName = `felix-ticket`;
const startBlock = 10;
const endBlock = 50;
const slotSize = 1000;

const creator = accounts.get("deployer")!;
const funder = accounts.get("wallet_1")!;
const funder2 = accounts.get("wallet_2")!;
const funder3 = accounts.get("wallet_3")!;
const funder4 = accounts.get("wallet_4")!;

describe("fund", () => {
  it("a contract can only be funded if it is not started", async () => {
    const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
    expect(result).toBeOk(boolCV(true));

    simnet.mineEmptyBlocks(startBlock);

    simnet.callPublicFn(contractName, "start", [], funder);
    const { result: secondFundRequest } = simnet.callPublicFn(
      contractName,
      "fund",
      [],
      funder2
    );
    expect(secondFundRequest).toBeErr(uintCV(502));
  });

  it("a contract can only be funded if it is not ended", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.mineEmptyBlocks(endBlock - startBlock - 1);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);

    const { result: fundRequestAfterEnd } = simnet.callPublicFn(
      contractName,
      "fund",
      [],
      funder2
    );
    expect(fundRequestAfterEnd).toBeErr(uintCV(502));
  });

  it("a contract can only be funded if there are still slots available", async () => {
    const { result: firstFundResult } = simnet.callPublicFn(
      contractName,
      "fund",
      [],
      funder
    );
    expect(firstFundResult).toBeOk(boolCV(true));
    const { result: secondFundResult } = simnet.callPublicFn(
      contractName,
      "fund",
      [],
      funder2
    );
    expect(secondFundResult).toBeOk(boolCV(true));
    const { result: thirdFundResult } = simnet.callPublicFn(
      contractName,
      "fund",
      [],
      funder3
    );
    expect(thirdFundResult).toBeOk(boolCV(true));
    const { result: fourthFunderResult } = simnet.callPublicFn(
      contractName,
      "fund",
      [],
      funder4
    );
    expect(fourthFunderResult).toBeErr(uintCV(503));
  });

  it("a contract can only be funded if the funder is not a funder already", async () => {
    const { result: firstFundResult } = simnet.callPublicFn(
      contractName,
      "fund",
      [],
      funder
    );
    expect(firstFundResult).toBeOk(boolCV(true));
    const { result: secondFundResult } = simnet.callPublicFn(
      contractName,
      "fund",
      [],
      funder
    );
    expect(secondFundResult).toBeErr(uintCV(504));
  });

  it("a contract should transfer the slot size from the funder to itself when funding", async () => {
    const { events } = simnet.callPublicFn(contractName, "fund", [], funder);
    const transfer = events[0];

    expect(transfer.event).toBe("stx_transfer_event");
    expect(transfer.data.amount).toBe(slotSize.toString());
    expect(transfer.data.sender).toBe(funder);
    expect(transfer.data.recipient).toBe(`${creator}.${contractName}`);
  });

  it("the contract prize pool should be updated with every fund", async () => {
    const { result: prizePoolBefore } = simnet.callReadOnlyFn(
      contractName,
      "get-prize-pool",
      [],
      funder
    );
    expect(prizePoolBefore).toBeOk(uintCV(0));
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.callPublicFn(contractName, "fund", [], funder2);
    simnet.callPublicFn(contractName, "fund", [], funder3);
    const { result: prizePoolAfter } = simnet.callReadOnlyFn(
      contractName,
      "get-prize-pool",
      [],
      funder
    );
    expect(prizePoolAfter).toBeOk(uintCV(slotSize * 3));
  });
});
