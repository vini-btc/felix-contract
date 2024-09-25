import { describe, expect, it } from "vitest";
import { boolCV, principalCV, uintCV } from "@stacks/transactions";
import { GenerateContractArgs, generateContract } from "../contract-helper";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const creator = accounts.get("deployer")!;
const fee = BigInt(20);
const defaultContractArgs: GenerateContractArgs = {
  name: "test",
  felix,
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
const buyBlockMargin = 6;

describe("buy tickets", () => {
  it("should not allow contracts to call", async () => {
    const contract = await generateContract(defaultContractArgs);
    const exploiter = accounts.get("wallet_7")!;
    const proxyContractName = "felix-proxy";
    const proxyContract = `(define-public (proxy-buy-ticket (recipient principal) (nums uint)) (contract-call? '${creator}.${contractName} buy-ticket recipient nums))`;
    simnet.deployContract(contractName, contract, null, creator);
    simnet.deployContract(proxyContractName, proxyContract, null, exploiter);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
    simnet.callPublicFn(contractName, "start", [], creator);
    const { result } = simnet.callPublicFn(
      `${exploiter}.${proxyContractName}`,
      "proxy-buy-ticket",
      [principalCV(exploiter), uintCV(1245)],
      exploiter
    );

    expect(result).toBeErr(uintCV(2001));
  });

  it("should allow a player to buy tickets", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
    const { result: startResult } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      creator
    );
    expect(startResult).toBeOk(boolCV(true));
    const ticketBuyer = accounts.get("wallet_1")!;
    const { result } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(1245)],
      ticketBuyer
    );
    expect(result).toBeOk(uintCV(1));

    const ticketBuyer2 = accounts.get("wallet_2")!;
    const { result: result2 } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer2), uintCV(54321)],
      ticketBuyer
    );
    expect(result2).toBeOk(uintCV(2));
  });

  it("should not allow a player to buy a ticket when the contract is still in funding", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    const ticketBuyer = accounts.get("wallet_1")!;
    const { events, result } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );
    expect(events).toHaveLength(0);
    expect(result).toBeErr(uintCV(502));
  });

  it("should not allow a player to buy a ticket when all tickets were sold", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock);
    const { result: startResult } = simnet.callPublicFn(
      contractName,
      "start",
      [],
      creator
    );
    expect(startResult).toBeOk(boolCV(true));
    const ticketBuyer = accounts.get("wallet_1")!;

    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );

    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(22345)],
      ticketBuyer
    );

    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(32345)],
      ticketBuyer
    );
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(42345)],
      ticketBuyer
    );
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(52345)],
      ticketBuyer
    );
    const { events, result } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(92345)],
      ticketBuyer
    );
    expect(events).toHaveLength(0);
    expect(result).toBeErr(uintCV(200));
  });

  it("should not allow a player to buy a ticket after five blocks before the end of the contract", async () => {
    const ticketBuyer = accounts.get("wallet_1")!;
    const contract = await generateContract(defaultContractArgs);
    // Block height: 1
    simnet.deployContract(contractName, contract, null, creator);
    // Block height: 2
    simnet.callPublicFn(contractName, "fund", [], creator);
    // Block height: 3
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    // Block height: 10
    simnet.callPublicFn(contractName, "start", [], creator);
    // Block height: 11
    const blocksUntillastBlockWithBuyAvailable =
      defaultContractArgs.endBlock - buyBlockMargin - simnet.blockHeight - 1;
    // We mine until one before the last available, since the buy transaction goes on the next block
    simnet.mineEmptyBlocks(blocksUntillastBlockWithBuyAvailable - 1);
    const { result: availableTicketResult } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(92345)],
      ticketBuyer
    );
    expect(availableTicketResult).toBeOk(uintCV(1));
    const { result: unavailableTicketResult } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );
    // Error: End too close
    expect(unavailableTicketResult).toBeErr(uintCV(300));
  });

  it("should transfer the ticket price to the contract, a fee to the felix contract and mint a new ticket", async () => {
    const ticketBuyer = accounts.get("wallet_1")!;
    const contract = await generateContract(defaultContractArgs);

    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    const { events } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );
    expect(events).toHaveLength(3);
    const [transferEvent, feeEvent, mintEvent] = events;
    // Expect fee to be paid to the platform
    expect(feeEvent.event).toBe("stx_transfer_event");
    expect(feeEvent.data.amount).toBe(defaultContractArgs.fee.toString());
    expect(feeEvent.data.recipient).toBe(felix);
    // Expect ticket price to be deposited to the lottery
    expect(transferEvent.event).toBe("stx_transfer_event");
    expect(transferEvent.data.amount).toBe(
      defaultContractArgs.ticketPrice.toString()
    );
    expect(transferEvent.data.recipient).toBe(`${creator}.${contractName}`);
    // Expecxt min event to have happened
    expect(mintEvent.event).toBe("nft_mint_event");
    expect(mintEvent.data.recipient).toBe(ticketBuyer);
    expect(mintEvent.data.value).toBeUint(1);
  });

  it("should update the sold tickets pool after buying a ticket", async () => {
    const ticketBuyer = accounts.get("wallet_1")!;
    const caller = accounts.get("wallet_3")!;
    const contract = await generateContract(defaultContractArgs);

    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );

    const { result } = simnet.callReadOnlyFn(
      contractName,
      "get-sold-tickets-pool",
      [],
      caller
    );
    expect(result).toBeOk(uintCV(defaultContractArgs.ticketPrice));

    [2, 3, 4].forEach((luckyNumber) => {
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(Number(`${luckyNumber}2345`))],
        ticketBuyer
      );
    });

    const { result: newSoldTicketPoolResult } = simnet.callReadOnlyFn(
      contractName,
      "get-sold-tickets-pool",
      [],
      caller
    );
    // * 3 => 1 ticket sold on the first assertion plus 3 tickets sold on the second assertion
    expect(newSoldTicketPoolResult).toBeOk(
      uintCV(Number(defaultContractArgs.ticketPrice * BigInt(4)))
    );
  });

  it("should not allow a player to buy a ticket with the same numbers as another player", async () => {
    const ticketBuyer = accounts.get("wallet_1")!;
    const secondTicketBuyer = accounts.get("wallet_5")!;
    const contract = await generateContract(defaultContractArgs);

    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    // Buying ticket with: 1 2 3 4 5
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );

    const { result } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(secondTicketBuyer), uintCV(12345)],
      secondTicketBuyer
    );

    // err-number-already-sold
    expect(result).toBeErr(uintCV(800));
  });

  it("should correctly assign the played number to the ticket id", async () => {
    const ticketBuyer = accounts.get("wallet_1")!;
    const contract = await generateContract(defaultContractArgs);

    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);
    // Buying ticket with: 1 2 3 4 5. Ticket id is one.
    simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(12345)],
      ticketBuyer
    );

    const ticketId = simnet.getMapEntry(
      contractName,
      "numbersToTicketIds",
      uintCV(12345)
    );

    expect(ticketId).toBeSome(uintCV(1));
  });

  it("should not allow buying tickets for a number bigger than what would be drawn with given difficulty but allow a smaller one", async () => {
    const ticketBuyer = accounts.get("wallet_1")!;
    const contract = await generateContract(defaultContractArgs);

    simnet.deployContract(contractName, contract, null, creator);
    simnet.callPublicFn(contractName, "fund", [], creator);
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
    simnet.callPublicFn(contractName, "start", [], creator);

    // Buying ticket with numbers: 1 2 3 4 5
    const { result: biggerNumberResult } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(123456)],
      ticketBuyer
    );
    expect(biggerNumberResult).toBeErr(uintCV(202));

    const { result: smallerNumberResult } = simnet.callPublicFn(
      contractName,
      "buy-ticket",
      [principalCV(ticketBuyer), uintCV(123)],
      ticketBuyer
    );
    expect(smallerNumberResult).toBeOk(uintCV(1));
  });
});
