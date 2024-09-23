import { describe, expect, it } from "vitest";
import {
  boolCV,
  noneCV,
  principalCV,
  someCV,
  stringAsciiCV,
  uintCV,
} from "@stacks/transactions";
import { GenerateContractArgs, generateContract } from "../contract-helper";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const creator = accounts.get("deployer")!;
const fee = BigInt(20);
const defaultContractArgs: GenerateContractArgs = {
  name: "test",
  creator,
  felix,
  fee,
  availableTickets: 5,
  ticketPrice: BigInt(10),
  difficulty: 5,
  startBlock: 100,
  endBlock: 200,
  token: "STX",
  slots: 10,
  slotSize: BigInt(1_000),
};
const contractName = `felix-${defaultContractArgs.name}`;

describe("draw numbers", () => {
  it("should only allow drawing the numbers of an active lottery", async () => {
    const contract = await generateContract(defaultContractArgs);
    const drawer = accounts.get("wallet_7")!;
    simnet.deployContract(contractName, contract, null, creator);
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

    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
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

    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    const { result } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    // The vrf-seed is deterministic in tests, so we can expect the same result for the same block-height
    // Since the coded difficulty is 5 we expect the result to be 1
    expect(result).toBeOk(uintCV(15032));
  });

  it("should always pick the vrf-seed from the same set tenure height", async () => {
    const contract = await generateContract(defaultContractArgs);
    const drawer = accounts.get("wallet_7")!;

    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    const { result: startResult } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      creator
    );
    expect(startResult).toBeOk(boolCV(true));

    simnet.mineEmptyBlocks(100);
    const { result } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    // The vrf-seed is deterministic in tests, so we can expect the same result for the same block-height
    // Since the coded difficulty is 5 we expect the result to be 1
    expect(result).toBeOk(uintCV(15032));
  });

  it("should finish the lottery after drawing the numbers and the numbers should be available when there are no winners available", async () => {
    const contract = await generateContract(defaultContractArgs);
    const drawer = accounts.get("wallet_7")!;
    const player = accounts.get("wallet_3")!;
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(player), uintCV(12345)],
      player
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    const { result } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    expect(result).toBeOk(uintCV(15032));

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
    expect(result3).toBeSome(uintCV(15032));

    const { result: result4 } = simnet.callReadOnlyFn(
      contractName,
      "get-winner-ticket-id",
      [],
      drawer
    );
    expect(result4).toBeOk(noneCV());
  });

  it("should finish the lottery after drawing the numbers and the numbers and the winner should be available when it was won", async () => {
    const contract = await generateContract(defaultContractArgs);
    const drawer = accounts.get("wallet_7")!;
    const player = accounts.get("wallet_3")!;
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
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
      [principalCV(player), uintCV(15032)],
      player
    );
    expect(winnerResult).toBeOk(uintCV(2));
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    const { result } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    expect(result).toBeOk(uintCV(15032));

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
    expect(result3).toBeSome(uintCV(15032));

    const { result: result4 } = simnet.callReadOnlyFn(
      contractName,
      "get-winner-ticket-id",
      [],
      drawer
    );
    expect(result4).toBeOk(someCV(uintCV(2)));
  });

  it("should correctly draw the lottery even when drawn number is zero leading", async () => {
    const contract = await generateContract({
      ...defaultContractArgs,
      difficulty: 3,
      endBlock: 200,
    });
    const drawer = accounts.get("wallet_7")!;
    const player = accounts.get("wallet_3")!;
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(player), uintCV(456)],
      player
    );
    const { result: winnerResult } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(player), uintCV(32)],
      player
    );
    expect(winnerResult).toBeOk(uintCV(2));

    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    const { result } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      drawer
    );
    expect(result).toBeOk(uintCV(32));

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
    expect(result3).toBeSome(uintCV(32));

    const { result: result4 } = simnet.callReadOnlyFn(
      contractName,
      "get-winner-ticket-id",
      [],
      drawer
    );
    expect(result4).toBeOk(someCV(uintCV(2)));
  });
});
