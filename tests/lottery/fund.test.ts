import { describe, expect, it } from "vitest";
import { boolCV, uintCV } from "@stacks/transactions";
import {
  GenerateContractArgs,
  generateLotteryContract,
} from "../contract-helper";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const funder = accounts.get("wallet_2")!;
const funder2 = accounts.get("wallet_3")!;
const funder3 = accounts.get("wallet_4")!;
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
  endBlock: 200,
  token: "STX",
  slots: 10,
  slotSize: BigInt(1_000),
  startBlockBuffer: 0,
};
const contractName = `felix-${defaultContractArgs.name}`;

describe("fund", () => {
  it("should not allow contracts to call", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    const exploiter = accounts.get("wallet_7")!;
    const proxyContractName = "felix-proxy";
    const proxyContract = `(define-public (proxy-fund) (contract-call? '${deployer}.${contractName} fund))`;
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.deployContract(proxyContractName, proxyContract, null, exploiter);
    const { result } = simnet.callPublicFn(
      `${exploiter}.${proxyContractName}`,
      "proxy-fund",
      [],
      exploiter
    );

    expect(result).toBeErr(uintCV(2001));
  });

  it("a contract can only be funded if it is not started", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);

    const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
    expect(result).toBeOk(boolCV(true));

    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);

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
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);

    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.mineEmptyBlocks(
      defaultContractArgs.endBlock - defaultContractArgs.startBlock - 1
    );
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
    const contract = await generateLotteryContract({
      ...defaultContractArgs,
      slots: 2,
    });
    simnet.deployContract(contractName, contract, null, deployer);
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
    expect(thirdFundResult).toBeErr(uintCV(503));
  });

  it("a contract can only be funded if the funder is not a funder already", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
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
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    const { events } = simnet.callPublicFn(contractName, "fund", [], funder);
    const transfer = events[0];

    expect(transfer.event).toBe("stx_transfer_event");
    expect(transfer.data.amount).toBe(defaultContractArgs.slotSize.toString());
    expect(transfer.data.sender).toBe(funder);
    expect(transfer.data.recipient).toBe(`${deployer}.${contractName}`);
  });

  it("the contract prize pool should be updated with every fund", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
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
    expect(prizePoolAfter).toBeOk(
      uintCV(Number(defaultContractArgs.slotSize * BigInt(3)))
    );
  });

  it("the contract can only be funded if the start block is in the future", async () => {
    const contract = await generateLotteryContract({
      ...defaultContractArgs,
      startBlock: 10,
      endBlock: 20,
    });
    simnet.deployContract(contractName, contract, null, deployer);
    if (simnet.blockHeight < 10) {
      simnet.mineEmptyBlocks(10 - simnet.blockHeight);
    }
    const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
    expect(result).toBeErr(uintCV(505));
  });
});
