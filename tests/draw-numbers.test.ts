import { describe, expect, it } from "vitest";
import {
  boolCV,
  noneCV,
  principalCV,
  someCV,
  stringAsciiCV,
  uintCV,
} from "@stacks/transactions";

const accounts = simnet.getAccounts();
const creator = accounts.get("deployer")!;
const contractName = `felix-ticket`;
const zeroLeadingContractName = `zero-leading`;
const startBlock = 10;
const endBlock = 50;

describe("draw numbers", () => {
  it("should only allow drawing the numbers of an active lottery", async () => {
    const drawer = accounts.get("wallet_7")!;
    const { result: result1 } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    expect(result1).toBeErr(uintCV(502));

    simnet.callPublicFn(contractName, "fund", [], creator);
    const { result: result2 } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    expect(result2).toBeErr(uintCV(502));

    simnet.mineEmptyBlocks(startBlock);
    const { result: startResult } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      creator
    );
    expect(startResult).toBeOk(boolCV(true));
    const { result: result3 } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    expect(result3).toBeErr(uintCV(301));

    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    const { result } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    // The vrf-seed is deterministic in tests, so we can expect the same result for the same block-height
    // Since the coded difficulty is 5 we expect the result to be 1
    expect(result).toBeOk(uintCV(86916));
  });

  it("should always use the vrf-seed from the set lottery end block", async () => {
    const drawer = accounts.get("wallet_7")!;

    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    const { result: startResult } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      creator
    );
    expect(startResult).toBeOk(boolCV(true));
    simnet.mineEmptyBlocks(500);
    const { result } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    // In this case there were a lot more blocks mined after the lottery end, but since the lottery end block determines
    // where the seed is coming from we still get the same result as in the previous test.
    expect(result).toBeOk(uintCV(86916));
  });

  it("should finish the lottery after drawing the numbers and the numbers should be available when there are no winners available", async () => {
    const drawer = accounts.get("wallet_7")!;
    const player = accounts.get("wallet_3")!;
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(player), uintCV(12345)],
      player
    );
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    const { result } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    expect(result).toBeOk(uintCV(86916));

    const { result: result2 } = simnet.callReadOnlyFn(
      contractName,
      "get-status",
      [],
      drawer
    );
    expect(result2).toBeOk(stringAsciiCV("finished"));

    const { result: result3 } = simnet.callReadOnlyFn(
      contractName,
      "get-drawn-number",
      [],
      drawer
    );
    expect(result3).toBeSome(uintCV(86916));

    const { result: result4 } = simnet.callReadOnlyFn(
      contractName,
      "get-winner-ticket-id",
      [],
      drawer
    );
    expect(result4).toBeOk(noneCV());
  });

  it("should finish the lottery after drawing the numbers and the numbers and the winner should be available when it was won", async () => {
    const drawer = accounts.get("wallet_7")!;
    const player = accounts.get("wallet_3")!;
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(player), uintCV(12345)],
      player
    );
    const { result: winnerResult } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(player), uintCV(86916)],
      player
    );
    expect(winnerResult).toBeOk(uintCV(2));
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    const { result } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    expect(result).toBeOk(uintCV(86916));

    const { result: result2 } = simnet.callReadOnlyFn(
      contractName,
      "get-status",
      [],
      drawer
    );
    expect(result2).toBeOk(stringAsciiCV("won"));

    const { result: result3 } = simnet.callReadOnlyFn(
      contractName,
      "get-drawn-number",
      [],
      drawer
    );
    expect(result3).toBeSome(uintCV(86916));

    const { result: result4 } = simnet.callReadOnlyFn(
      contractName,
      "get-winner-ticket-id",
      [],
      drawer
    );
    expect(result4).toBeOk(someCV(uintCV(2)));
  });

  it("should correctly draw the lottery even when drawn number is zero leading", async () => {
    const drawer = accounts.get("wallet_7")!;
    const player = accounts.get("wallet_3")!;
    simnet.callPublicFn(zeroLeadingContractName, "fund", [], creator);
    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(zeroLeadingContractName, "start", [], creator);
    simnet.callPublicFn(
      zeroLeadingContractName,
      "buy-ticket",
      [principalCV(player), uintCV(456)],
      player
    );
    const { result: winnerResult } = simnet.callPublicFn(
      zeroLeadingContractName,
      "buy-ticket",
      [principalCV(player), uintCV(32)],
      player
    );
    expect(winnerResult).toBeOk(uintCV(2));

    simnet.mineEmptyBlocks(250);
    const { result } = simnet.callPublicFn(
      zeroLeadingContractName,
      "draw-numbers",
      [],
      drawer
    );

    // We get a 2 numbers drawn, even though the "Zero Leading" Lottery has a difficulty of 3
    expect(result).toBeOk(uintCV(32));

    const { result: result2 } = simnet.callReadOnlyFn(
      zeroLeadingContractName,
      "get-status",
      [],
      drawer
    );
    expect(result2).toBeOk(stringAsciiCV("won"));

    const { result: result3 } = simnet.callReadOnlyFn(
      zeroLeadingContractName,
      "get-drawn-number",
      [],
      drawer
    );
    expect(result3).toBeSome(uintCV(32));

    const { result: result4 } = simnet.callReadOnlyFn(
      zeroLeadingContractName,
      "get-winner-ticket-id",
      [],
      drawer
    );
    expect(result4).toBeOk(someCV(uintCV(2)));
  });
});
