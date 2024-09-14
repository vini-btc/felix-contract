import { describe, expect, it } from "vitest";
import { principalCV, trueCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const ticketBuyer = accounts.get("wallet_1")!;
const ticketBuyer2 = accounts.get("wallet_2")!;
const creator = accounts.get("deployer")!;
const contractName = `felix-ticket`;
const startBlock = 10;
const endBlock = 50;

describe("burn tickets", () => {
  it("should allow a player to burn their tickets if the lottery is finished", async () => {
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(1245)],
      ticketBuyer
    );
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
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
            "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket::felix-draft-000",
            "raw_value": "0x0100000000000000000000000000000001",
            "sender": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
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
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
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
      [principalCV(ticketBuyer), uintCV(86916)],
      ticketBuyer2
    );
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
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
            "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket::felix-draft-000",
            "raw_value": "0x0100000000000000000000000000000001",
            "sender": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
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
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
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
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], creator);
  });

  it("should not allow a player to burn their tickets if the ticket is the winning one", async () => {
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(86916)],
      ticketBuyer
    );
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
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
