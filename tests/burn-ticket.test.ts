import { describe, expect, it } from "vitest";
import { principalCV, trueCV, uintCV } from "@stacks/transactions";
import { generateContract, GenerateContractArgs } from "../contract-helper";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const deployer = accounts.get("deployer")!;
const felixRandomContract = `${deployer}.felix-meta-v2`;
const creator = accounts.get("deployer")!;
const ticketBuyer = accounts.get("wallet_2")!;
const ticketBuyer2 = accounts.get("wallet_3")!;
const fee = BigInt(20);
const defaultContractArgs: GenerateContractArgs = {
  name: "test",
  felix,
  felixRandomContract,
  fee,
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

describe("burn tickets", () => {
  it("should not allow contracts to call", async () => {
    const contract = await generateContract(defaultContractArgs);
    const exploiter = accounts.get("wallet_7")!;
    const proxyContractName = "felix-proxy";
    const proxyContract = `(define-public (proxy-burn-ticket (ticket-id uint)) (contract-call? '${creator}.${contractName} burn-ticket ticket-id))`;
    simnet.deployContract(contractName, contract, null, creator);
    simnet.deployContract(proxyContractName, proxyContract, null, exploiter);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(1245)],
      ticketBuyer
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], creator);
    const { result } = simnet.callPublicFn(
      `${exploiter}.${proxyContractName}`,
      "proxy-burn-ticket",
      [uintCV(1)],
      exploiter
    );
    expect(result).toBeErr(uintCV(2001));
  });

  it("should allow a player to burn their tickets if the lottery is finished", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(1245)],
      ticketBuyer
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], creator);
    const { result, events } = simnet.callPublicFn(
      contractName,
      "burn-ticket",
      [uintCV(1)],
      ticketBuyer
    );
    expect(result).toBeOk(trueCV());
    expect(events).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test::felix-test",
            "raw_value": "0x0100000000000000000000000000000001",
            "sender": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
            "value": {
              "type": 1,
              "value": 1n,
            },
          },
          "event": "nft_burn_event",
        },
      ]
    `);
  });

  it("should allow a player to burn their tickets if the lottery is won and the ticket is not the winning ticket", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(1345)],
      ticketBuyer
    );

    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      // This ticket is the winning ticket
      [principalCV(ticketBuyer), uintCV(64807)],
      ticketBuyer2
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], creator);
    const { result, events } = simnet.callPublicFn(
      contractName,
      "burn-ticket",
      [uintCV(1)],
      ticketBuyer
    );
    expect(result).toBeOk(trueCV());
    expect(events).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test::felix-test",
            "raw_value": "0x0100000000000000000000000000000001",
            "sender": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
            "value": {
              "type": 1,
              "value": 1n,
            },
          },
          "event": "nft_burn_event",
        },
      ]
    `);
  });

  it("should not allow a player to burn their tickets if the lottery is active", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(1345)],
      ticketBuyer
    );

    const { result } = simnet.callPublicFn(
      contractName,
      "burn-ticket",
      [uintCV(1)],
      ticketBuyer
    );
    expect(result).toBeErr(uintCV(502));
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], creator);
  });

  it("should not allow a player to burn their tickets if the ticket is the winning one", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(64807)],
      ticketBuyer
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], creator);

    const { result } = simnet.callPublicFn(
      contractName,
      "burn-ticket",
      [uintCV(1)],
      ticketBuyer
    );
    expect(result).toBeErr(uintCV(3000));
  });
});
