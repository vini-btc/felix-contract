import { describe, expect, it } from "vitest";
import { stringAsciiCV, trueCV, uintCV } from "@stacks/transactions";
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
  endBlock: 200,
  token: "STX",
  slots: 10,
  slotSize: BigInt(1_000),
  startBlockBuffer: 0,
};
const contractName = `felix-${defaultContractArgs.name}`;

describe("cancel", () => {
  it("should not allow contracts to call", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    const exploiter = accounts.get("wallet_7")!;
    const proxyContractName = "felix-proxy";
    const proxyContract = `(define-public (proxy-cancel) (contract-call? '${deployer}.${contractName} cancel))`;
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.deployContract(proxyContractName, proxyContract, null, exploiter);
    simnet.callPublicFn(contractName, "fund", [], deployer);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
    simnet.callPublicFn(contractName, "start", [], deployer);
    const { result } = simnet.callPublicFn(
      `${exploiter}.${proxyContractName}`,
      "proxy-cancel",
      [],
      exploiter
    );

    expect(result).toBeErr(uintCV(2001));
  });

  it("can only be cancelled by the lottery admin", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlock();
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
