import { describe, expect, it } from "vitest";
import { principalCV, trueCV, uintCV } from "@stacks/transactions";
import { GenerateContractArgs, generateContract } from "../contract-helper";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const funder = accounts.get("wallet_1")!;
const winner = accounts.get("wallet_2")!;
const notWinner = accounts.get("wallet_3")!;
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

describe("claim-prize", () => {
  it("should not allow contracts to call", async () => {
    const exploiter = accounts.get("wallet_7")!;
    const proxyContractName = "felix-proxy";
    const proxyContract = `(define-public (proxy-claim-prize (ticket-id uint)) (contract-call? '${deployer}.${contractName} claim-prize ticket-id))`;
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.deployContract(proxyContractName, proxyContract, null, exploiter);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(winner), uintCV(64807)],
      winner
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);
    const { result: claim } = simnet.callPublicFn(
      `${exploiter}.${proxyContractName}`,
      "proxy-claim-prize",
      [uintCV(1)],
      exploiter
    );
    expect(claim).toBeErr(uintCV(2001));
  });
  it('should only be possible to claim the prize of a "won" lottery', async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
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

    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);

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
      [principalCV(winner), uintCV(64807)],
      winner
    );
    expect(buyTicket).toBeOk(uintCV(1));

    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);

    const { result: draw } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      funder
    );
    expect(draw).toBeOk(uintCV(64807));

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
          "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test",
        },
        "event": "stx_transfer_event",
      }
    `);
    // Ticket NFT burned
    expect(events[1]).toMatchInlineSnapshot(`
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
      }
    `);
  });

  it("should only allow the prize to be claimed once", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(winner), uintCV(64807)],
      winner
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
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
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(winner), uintCV(64807)],
      winner
    );
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(notWinner), uintCV(25907)],
      notWinner
    );
    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
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
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.callPublicFn(contractName, "claim-prize", [uintCV(1)], winner);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], funder);

    const { result: buyTicket } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(winner), uintCV(64807)],
      winner
    );
    expect(buyTicket).toBeOk(uintCV(1));

    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
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
          "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test",
        },
        "event": "stx_transfer_event",
      }
    `);
    // Ticket NFT burned
    expect(events[1]).toMatchInlineSnapshot(`
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
      }
    `);
  });
});
