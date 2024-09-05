import { describe, expect, it } from "vitest";
import { boolCV, principalCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const funder = accounts.get("wallet_2")!;
const ticketBuyer = accounts.get("wallet_3")!;
const notTheTicketBuyer = accounts.get("wallet_4")!;
const anotherTicketBuyer = accounts.get("wallet_5")!;
const contractName = `felix-ticket`;
const startBlock = 10;
const endBlock = 50;

describe("get ticket refund", () => {
  it("is possible to get a ticket refund on a cancelled lottery", async () => {
    const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
    expect(result).toBeOk(boolCV(true));

    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(contractName, "start", [], funder);
    const { result: buyTicketResult } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );
    expect(buyTicketResult).toBeOk(uintCV(1));
    simnet.callPublicFn(contractName, "cancel", [], felix);
    const { result: getTicketRefundResult, events } = simnet.callPublicFn(
      contractName,
      "get-ticket-refund",
      [uintCV(1)],
      ticketBuyer
    );
    expect(getTicketRefundResult).toBeOk(uintCV(1));
    expect(events[0]).toMatchInlineSnapshot(`
      {
        "data": {
          "amount": "97",
          "memo": "",
          "recipient": "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC",
          "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket",
        },
        "event": "stx_transfer_event",
      }
    `);
    expect(events[1]).toMatchInlineSnapshot(`
      {
        "data": {
          "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-ticket::felix-draft-000",
          "raw_value": "0x0100000000000000000000000000000001",
          "sender": "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC",
          "value": {
            "type": 1,
            "value": 1n,
          },
        },
        "event": "nft_burn_event",
      }
    `);
  });
  it("is only possible to get a ticket refund once", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );
    simnet.callPublicFn(contractName, "cancel", [], felix);
    simnet.callPublicFn(
      contractName,
      "get-ticket-refund",
      [uintCV(1)],
      ticketBuyer
    );
    const { result: getTicketRefundResult } = simnet.callPublicFn(
      contractName,
      "get-ticket-refund",
      [uintCV(1)],
      ticketBuyer
    );
    expect(getTicketRefundResult).toBeErr(uintCV(102));
  });

  it("is only possible to get a refund for a ticket if the lottery was cancelled", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );
    const { result: getTicketRefundResult } = simnet.callPublicFn(
      contractName,
      "get-ticket-refund",
      [uintCV(1)],
      ticketBuyer
    );
    expect(getTicketRefundResult).toBeErr(uintCV(502));
    simnet.mineEmptyBlocks(endBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "draw-numbers", [], funder);
    const { result: getTicketRefundResultAfterFinished } = simnet.callPublicFn(
      contractName,
      "get-ticket-refund",
      [uintCV(1)],
      ticketBuyer
    );
    expect(getTicketRefundResultAfterFinished).toBeErr(uintCV(502));
  });

  it("is only possible to get a refund for a ticket if you are the ticket owner", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );
    simnet.callPublicFn(contractName, "cancel", [], felix);
    const { result } = simnet.callPublicFn(
      contractName,
      "get-ticket-refund",
      [uintCV(1)],
      notTheTicketBuyer
    );
    expect(result).toBeErr(uintCV(101));
  });

  it("is possible for multiple ticket owners to get their ticket refund", async () => {
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.mineEmptyBlocks(startBlock);
    simnet.callPublicFn(contractName, "start", [], funder);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(notTheTicketBuyer), uintCV(12346)],
      notTheTicketBuyer
    );
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(anotherTicketBuyer), uintCV(12347)],
      anotherTicketBuyer
    );
    simnet.callPublicFn(contractName, "cancel", [], felix);
    const { result } = simnet.callPublicFn(
      contractName,
      "get-ticket-refund",
      [uintCV(1)],
      ticketBuyer
    );
    expect(result).toBeOk(uintCV(1));

    const { result: result2 } = simnet.callPublicFn(
      contractName,
      "get-ticket-refund",
      [uintCV(2)],
      notTheTicketBuyer
    );
    expect(result2).toBeOk(uintCV(2));

    const { result: result3 } = simnet.callPublicFn(
      contractName,
      "get-ticket-refund",
      [uintCV(3)],
      anotherTicketBuyer
    );
    expect(result3).toBeOk(uintCV(3));
  });
});
