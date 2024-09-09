import { describe, expect, it } from "vitest";
import { principalCV, trueCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const funder = accounts.get("wallet_1")!;
const winner = accounts.get("wallet_2")!;
const notWinner = accounts.get("wallet_3")!;
const contractName = `felix-ticket`;
const startBlock = 10;
const endBlock = 50;

describe("claim-prize", () => {
  it('should only be possible to claim the prize of a "won" lottery', async () => {
    const { result: fund } = simnet.callPublicFn(
      contractName,
      "fund",
      [],
      funder
    );
    expect(fund).toBeOk(trueCV());

    const { result: claimOnFunding } = simnet.callPublicFn(
      contractName,
      "claim-prize",
      [uintCV(1)],
      winner
    );
    expect(claimOnFunding).toBeErr(uintCV(502));

    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);

    const { result: start } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      funder
    );
    expect(start).toBeOk(trueCV());

    const { result: claimOnStart } = simnet.callPublicFn(
      contractName,
      "claim-prize",
      [uintCV(1)],
      winner
    );
    expect(claimOnStart).toBeErr(uintCV(502));

    const { result: buyTicket } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(winner), uintCV(86916)],
      winner
    );
    expect(buyTicket).toBeOk(uintCV(1));

    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);

    const { result: draw } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      funder
    );
    expect(draw).toBeOk(uintCV(86916));

    const { result: claimOnDraw, events } = simnet.callPublicFn(
      contractName,
      "claim-prize",
      [uintCV(1)],
      winner
    );
    expect(claimOnDraw).toBeOk(trueCV());
    // Prize sent to claimer
    expect(events[0]).toMatchInlineSnapshot(`
      {
        "data": {
          "amount": "1000",
          "memo": "",
          "recipient": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
          "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket",
        },
        "event": "stx_transfer_event",
      }
    `);
    // Ticket NFT burned
    expect(events[1]).toMatchInlineSnapshot(`
      {
        "data": {
          "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket::felix-draft-000",
          "raw_value": "0x0100000000000000000000000000000001",
          "sender": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
          "value": {
            "type": 1,
            "value": 1n,
          },
        },
        "event": "nft_burn_event",
      }
    `);
  });

  it("should only allow the prize to be claimed once", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(winner), uintCV(86916)],
      winner
    );
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);
    const { result: claim } = simnet.callPublicFn(
      contractName,
      "claim-prize",
      [uintCV(1)],
      winner
    );
    expect(claim).toBeOk(trueCV());

    const { result: secondClaim } = simnet.callPublicFn(
      contractName,
      "claim-prize",
      [uintCV(1)],
      winner
    );
    // Err 102: Ticket does not exist (since it was burned);
    expect(secondClaim).toBeErr(uintCV(102));
  });

  it("should only allow the winning ticket owner to claim the prize", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(winner), uintCV(86916)],
      winner
    );
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(notWinner), uintCV(25907)],
      notWinner
    );
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);
    const { result: notWinnerClaim } = simnet.callPublicFn(
      contractName,
      "claim-prize",
      [uintCV(1)],
      notWinner
    );
    expect(notWinnerClaim).toBeErr(uintCV(101));

    const { result: notWinnerClaimOwnTicket } = simnet.callPublicFn(
      contractName,
      "claim-prize",
      [uintCV(2)],
      notWinner
    );
    expect(notWinnerClaimOwnTicket).toBeErr(uintCV(901));

    const { result: winnerClaim } = simnet.callPublicFn(
      contractName,
      "claim-prize",
      [uintCV(1)],
      winner
    );
    expect(winnerClaim).toBeOk(trueCV());
  });

  it("should transfer the prize to the ticket owner", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.callPublicFn(contractName, "claim-prize", [uintCV(1)], winner);
    simnet.mineEmptyBlocks(startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);

    const { result: buyTicket } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(winner), uintCV(86916)],
      winner
    );
    expect(buyTicket).toBeOk(uintCV(1));

    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);

    const { result: claimOnDraw, events } = simnet.callPublicFn(
      contractName,
      "claim-prize",
      [uintCV(1)],
      winner
    );
    expect(claimOnDraw).toBeOk(trueCV());
    // Prize sent to claimer
    expect(events[0]).toMatchInlineSnapshot(`
      {
        "data": {
          "amount": "1000",
          "memo": "",
          "recipient": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
          "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket",
        },
        "event": "stx_transfer_event",
      }
    `);
    // Ticket NFT burned
    expect(events[1]).toMatchInlineSnapshot(`
      {
        "data": {
          "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket::felix-draft-000",
          "raw_value": "0x0100000000000000000000000000000001",
          "sender": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
          "value": {
            "type": 1,
            "value": 1n,
          },
        },
        "event": "nft_burn_event",
      }
    `);
  });
});
