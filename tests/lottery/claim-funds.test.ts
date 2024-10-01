import { describe, expect, it } from "vitest";
import { principalCV, trueCV, uintCV } from "@stacks/transactions";
import {
  GenerateContractArgs,
  generateLotteryContract,
} from "../contract-helper";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const funder = accounts.get("wallet_1")!;
const ticketBuyer = accounts.get("wallet_2")!;
const winner = accounts.get("wallet_3")!;
const secondFunder = accounts.get("wallet_4")!;
const thirdFunder = accounts.get("wallet_5")!;
const notAFunder = accounts.get("wallet_6")!;
const deployer = accounts.get("deployer")!;
const felixRandomContract = `${deployer}.felix-meta-v2`;
const defaultContractArgs: GenerateContractArgs = {
  name: "test",
  felix,
  felixRandomContract,
  fee: BigInt(20),
  availableTickets: 100,
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

describe("claim-funds", () => {
  it("should not allow contracts to call", async () => {
    const exploiter = accounts.get("wallet_7")!;
    const proxyContractName = "felix-proxy";
    const proxyContract = `(define-public (proxy-claim-funds) (contract-call? '${deployer}.${contractName} claim-funds))`;
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.deployContract(proxyContractName, proxyContract, null, exploiter);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12300)],
      ticketBuyer
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);
    const { result } = simnet.callPublicFn(
      `${exploiter}.${proxyContractName}`,
      "proxy-claim-funds",
      [],
      exploiter
    );
    expect(result).toBeErr(uintCV(2001));
  });

  it("should be possible for a lottery funder to claim their fund plus their part on the lottery sell after a lottery is finished", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    // Buy 10 tickets
    [...Array(10).keys()].forEach((i) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(12300 + Number(i))],
        ticketBuyer
      );
    });
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);

    const { result, events } = simnet.callPublicFn(
      contractName,
      "claim-funds",
      [],
      funder
    );
    expect(result).toBeOk(trueCV());
    // Receive transfer of fund = 1_000 + 10 * 10 = 1_100
    expect(events).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "amount": "1100",
            "memo": "",
            "recipient": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
            "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test",
          },
          "event": "stx_transfer_event",
        },
      ]
    `);
  });

  it("should be possible for a lottery funder to claim their their part on the lottery after a lottery is won", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    // Buy 10 tickets
    [...Array(10).keys()].forEach((i) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(i)],
        ticketBuyer
      );
    });
    // Buy winning ticket
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(64807)],
      winner
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);

    const { result, events } = simnet.callPublicFn(
      contractName,
      "claim-funds",
      [],
      funder
    );
    expect(result).toBeOk(trueCV());
    // Receive transfer of 11 * 10 = 110
    expect(events).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "amount": "110",
            "memo": "",
            "recipient": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
            "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test",
          },
          "event": "stx_transfer_event",
        },
      ]
    `);
  });

  it("should be possible for multiple funders to get their correct part of the lottery pool after the lottery is finished", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.callPublicFn(contractName, "fund", [], secondFunder);
    simnet.callPublicFn(contractName, "fund", [], thirdFunder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    // Buy 100 tickets
    [...Array(50).keys()].forEach((i) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(i)],
        ticketBuyer
      );
    });
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);

    const { result, events } = simnet.callPublicFn(
      contractName,
      "claim-funds",
      [],
      funder
    );
    expect(result).toBeOk(trueCV());
    // Receive transfer of 1_000 + (50 * 10) / 3 = 1_166
    expect(events).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "amount": "1166",
            "memo": "",
            "recipient": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
            "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test",
          },
          "event": "stx_transfer_event",
        },
      ]
    `);
  });

  it("should only be possible to claim funds if you are a funder", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    // Buy 100 tickets
    [...Array(50).keys()].forEach((i) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(i)],
        ticketBuyer
      );
    });
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);
    simnet.callPublicFn(contractName, "claim-funds", [], funder);
    const { result } = simnet.callPublicFn(
      contractName,
      "claim-funds",
      [],
      funder
    );
    expect(result).toBeErr(uintCV(1000));
  });

  it("should only be possible to claim your funds once", async () => {
    const contract = await generateLotteryContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    // Buy 100 tickets
    [...Array(50).keys()].forEach((i) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(i)],
        ticketBuyer
      );
    });
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);
    const { result } = simnet.callPublicFn(
      contractName,
      "claim-funds",
      [],
      notAFunder
    );
    expect(result).toBeErr(uintCV(1001));
  });
});
