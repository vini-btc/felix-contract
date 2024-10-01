import { describe, expect, it } from "vitest";
import { trueCV, uintCV } from "@stacks/transactions";
import {
  GenerateContractArgs,
  generateLotteryContract,
} from "../contract-helper";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const funder = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;
const felixRandomContract = `${deployer}.felix-meta-v2`;
const defaultContractArgs: GenerateContractArgs = {
  name: "test",
  felix,
  felixRandomContract,
  fee: BigInt(20),
  availableTickets: 5,
  ticketPrice: BigInt(10),
  difficulty: 5,
  startBlock: 100,
  startBlockBuffer: 0,
  endBlock: 200,
  token: "STX",
  slots: 10,
  slotSize: BigInt(1_000),
};
const contractName = `felix-${defaultContractArgs.name}`;

describe("start", () => {
  it("should not allow contracts to call", async () => {
    const exploiter = accounts.get("wallet_7")!;
    const proxyContractName = "felix-proxy";
    const proxyContract = `(define-public (proxy-start) (contract-call? '${deployer}.${contractName} start))`;
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.deployContract(proxyContractName, proxyContract, null, exploiter);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    const { result } = simnet.callPublicFn(
      `${exploiter}.${proxyContractName}`,
      "proxy-start",
      [],
      exploiter
    );
    expect(result).toBeErr(uintCV(2001));
  });

  it("can only be started from its defined start block", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlock();
    const { result: startBeforeStartBlock } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      funder
    );
    expect(startBeforeStartBlock).toBeErr(uintCV(500));
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
    const { result: startAfterStartBlock } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      funder
    );
    expect(startAfterStartBlock).toBeOk(trueCV());
  });

  it("can only be started if it was already funded", async () => {
    const contract = await generateLotteryContract({
      ...defaultContractArgs,
      startBlockBuffer: 0,
    });
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    const { result: startBeforeFunding } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      funder
    );
    expect(startBeforeFunding).toBeErr(uintCV(501));
  });

  it("can only be started if it was in funding before", async () => {
    const contract = await generateLotteryContract({
      ...defaultContractArgs,
      startBlockBuffer: 0,
    });
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);
    const { result } = simnet.callPublicFn(contractName, "start", [], funder);
    expect(result).toBeErr(uintCV(502));

    // Test cancelled contract
    const secondContractArgs = {
      ...defaultContractArgs,
      name: "test2",
      endBlock: simnet.blockHeight + 10 + 50,
      startBlock: simnet.blockHeight + 10,
      startBlockBuffer: 0,
    };
    const secondContract = await generateLotteryContract(secondContractArgs);
    const secondContractName = `felix-test2`;
    simnet.deployContract(secondContractName, secondContract, null, deployer);
    simnet.callPublicFn(secondContractName, "fund", [], funder);
    simnet.callPublicFn(secondContractName, "cancel", [], felix);
    simnet.mineEmptyBlocks(secondContractArgs.startBlock - simnet.blockHeight);
    const { result: cancelledLotteryResult } = simnet.callPublicFn(
      secondContractName,
      "start",
      [],
      funder
    );
    expect(cancelledLotteryResult).toBeErr(uintCV(502));
  });

  it("can only be started if the end block is a block in the future", async () => {
    const contract = await generateLotteryContract({
      ...defaultContractArgs,
      startBlock: 50,
      endBlock: 100,
    });
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(100 - simnet.blockHeight + 1);
    const { result } = simnet.callPublicFn(contractName, "start", [], funder);

    expect(result).toBeErr(uintCV(300));
  });
});
