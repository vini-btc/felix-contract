import { describe, expect, it } from "vitest";
import { principalCV, trueCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();

const funder = accounts.get("wallet_1")!;
const ticketBuyer = accounts.get("wallet_2")!;
const winner = accounts.get("wallet_3")!;
const secondFunder = accounts.get("wallet_4")!;
const thirdFunder = accounts.get("wallet_5")!;
const notAFunder = accounts.get("wallet_6")!;
const contractName = `felix-ticket`;
const startBlock = 10;
const endBlock = 50;

describe("claim-funds", () => {
  it("should be possible for a lottery funder to claim their fund plus their part on the lottery sell after a lottery is finished", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    // Buy 5 tickets
    [...Array(5).keys()].forEach((i) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(12300 + Number(i))],
        ticketBuyer
      );
    });
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);

    const { result, events } = simnet.callPublicFn(
      contractName,
      "claim-funds",
      [],
      funder
    );
    expect(result).toBeOk(trueCV());
    // Receive transfer of fund = 1_000 + 5 * 97 = 1_100
    expect(events).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "amount": "1485",
            "memo": "",
            "recipient": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
            "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket",
          },
          "event": "stx_transfer_event",
        },
      ]
    `);
  });

  it("should be possible for a lottery funder to claim their their part on the lottery after a lottery is won", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    // Buy 4 tickets
    [...Array(4).keys()].forEach((i) => {
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
      [principalCV(ticketBuyer), uintCV(86916)],
      winner
    );
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
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
            "amount": "485",
            "memo": "",
            "recipient": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
            "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket",
          },
          "event": "stx_transfer_event",
        },
      ]
    `);
  });

  it("should be possible for multiple funders to get their correct part of the lottery pool after the lottery is finished", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.callPublicFn(contractName, "fund", [], secondFunder);
    simnet.callPublicFn(contractName, "fund", [], thirdFunder);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    [...Array(5).keys()].forEach((i) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(i)],
        ticketBuyer
      );
    });
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);

    const { result, events } = simnet.callPublicFn(
      contractName,
      "claim-funds",
      [],
      funder
    );
    expect(result).toBeOk(trueCV());
    expect(events).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "amount": "1161",
            "memo": "",
            "recipient": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
            "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket",
          },
          "event": "stx_transfer_event",
        },
      ]
    `);

    const { result: secondFunderResult, events: secondFunderEvents } =
      simnet.callPublicFn(contractName, "claim-funds", [], secondFunder);
    expect(secondFunderResult).toBeOk(trueCV());
    expect(secondFunderEvents).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "amount": "1161",
            "memo": "",
            "recipient": "ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND",
            "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket",
          },
          "event": "stx_transfer_event",
        },
      ]
    `);

    const { result: thirdFunderResult, events: thirdFunderEvents } =
      simnet.callPublicFn(contractName, "claim-funds", [], thirdFunder);
    expect(thirdFunderResult).toBeOk(trueCV());
    expect(thirdFunderEvents).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "amount": "1161",
            "memo": "",
            "recipient": "ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB",
            "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket",
          },
          "event": "stx_transfer_event",
        },
      ]
    `);
  });

  it("should only be possible to claim funds if you are a funder", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    [...Array(5).keys()].forEach((i) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(i)],
        ticketBuyer
      );
    });
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
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
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    [...Array(5).keys()].forEach((i) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(i)],
        ticketBuyer
      );
    });
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
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
