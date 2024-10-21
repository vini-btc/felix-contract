import { beforeEach, describe, expect, it } from "vitest";
import {
  boolCV,
  noneCV,
  principalCV,
  someCV,
  stringAsciiCV,
  trueCV,
  uintCV,
} from "@stacks/transactions";
import {
  generateLotteryContract,
  GenerateFelixLotteryContractArgs,
} from "./contract-helper";
import { tx } from "@hirosystems/clarinet-sdk";

const accounts = simnet.getAccounts();
const buyBlockMargin = 6;
const felix = accounts.get("felix")!;
const deployer = accounts.get("deployer")!;
const felixRandomContract = `${deployer}.felix-meta-v2`;
const creator = accounts.get("deployer")!;
const funder = accounts.get("wallet_1")!;
const ticketBuyer = accounts.get("wallet_2")!;
const ticketBuyer2 = accounts.get("wallet_3")!;
const winner = accounts.get("wallet_4")!;
const secondFunder = accounts.get("wallet_5")!;
const thirdFunder = accounts.get("wallet_6")!;
const notAFunder = accounts.get("wallet_7")!;
const notWinner = accounts.get("wallet_8")!;
const notTheTicketBuyer = funder;
const newAdmin = deployer;
const defaultContractArgs: GenerateFelixLotteryContractArgs = {
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

describe("felix lottery", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });
  describe("update-admin", () => {
    it("should not allow contracts to call", async () => {
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-update-admin (new-admin principal)) (contract-call? '${creator}.${contractName} update-admin new-admin))`;
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );

      const { result } = simnet.callPublicFn(
        `${exploiter}.${proxyContractName}`,
        "proxy-update-admin",
        [principalCV(newAdmin)],
        exploiter
      );
      expect(result).toBeErr(uintCV(2001));
    });

    it("can only be updated by the current admin", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.mineEmptyBurnBlocks(1000);
      const { result: nonAdminCalling } = simnet.callPublicFn(
        contractName,
        "update-admin",
        [principalCV(newAdmin)],
        creator
      );
      expect(nonAdminCalling).toBeErr(uintCV(2000));
      const { result: creatorCalling } = simnet.callPublicFn(
        contractName,
        "update-admin",
        [principalCV(newAdmin)],
        creator
      );
      expect(creatorCalling).toBeErr(uintCV(2000));

      const { result: adminCalling } = simnet.callPublicFn(
        contractName,
        "update-admin",
        [principalCV(newAdmin)],
        felix
      );
      expect(adminCalling).toBeOk(principalCV(newAdmin));

      const { result: newAdminCalling } = simnet.callPublicFn(
        contractName,
        "update-admin",
        [principalCV(felix)],
        newAdmin
      );
      expect(newAdminCalling).toBeOk(principalCV(felix));
    });
  });

  describe("start", () => {
    it("should not allow contracts to call", async () => {
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-start) (contract-call? '${deployer}.${contractName} start))`;
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight
      );
      const { result } = simnet.callPublicFn(
        `${exploiter}.${proxyContractName}`,
        "proxy-start",
        [],
        exploiter
      );
      expect(result).toBeErr(uintCV(2001));
    });

    it("can only be started from its defined start block", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBlock();
      const { result: startBeforeStartBlock } = simnet.callPublicFn(
        contractName,
        "start",
        [],
        funder
      );
      expect(startBeforeStartBlock).toBeErr(uintCV(500));
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
      const { result: startAfterStartBlock } = simnet.callPublicFn(
        contractName,
        "start",
        [],
        funder
      );
      expect(startAfterStartBlock).toBeOk(trueCV());
    });

    it("can only be started if it was already funded", async () => {
      const contract = await generateLotteryContract({
        ...defaultContractArgs,
        startBlockBuffer: 0,
      });
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
      const { result: startBeforeFunding } = simnet.callPublicFn(
        contractName,
        "start",
        [],
        funder
      );
      expect(startBeforeFunding).toBeErr(uintCV(501));
    });

    it("can only be started if it was in funding before", async () => {
      const contract = await generateLotteryContract({
        ...defaultContractArgs,
        startBlockBuffer: 0,
      });
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
      simnet.callPublicFn(contractName, "start", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
      simnet.callPublicFn(contractName, "draw-numbers", [], funder);
      const { result } = simnet.callPublicFn(contractName, "start", [], funder);
      expect(result).toBeErr(uintCV(502));

      // Test cancelled contract
      const secondContractArgs = {
        ...defaultContractArgs,
        name: "test2",
        endBlock: simnet.burnBlockHeight + 10 + 50,
        startBlock: simnet.burnBlockHeight + 10,
        startBlockBuffer: 0,
      };
      const secondContract = await generateLotteryContract(secondContractArgs);
      const secondContractName = `felix-test2`;
      simnet.deployContract(
        secondContractName,
        secondContract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(secondContractName, "fund", [], funder);
      simnet.callPublicFn(secondContractName, "cancel", [], felix);
      simnet.mineEmptyBurnBlocks(
        secondContractArgs.startBlock - simnet.burnBlockHeight
      );
      const { result: cancelledLotteryResult } = simnet.callPublicFn(
        secondContractName,
        "start",
        [],
        funder
      );
      expect(cancelledLotteryResult).toBeErr(uintCV(502));
    });

    it("can only be started if the end block is a block in the future", async () => {
      const contract = await generateLotteryContract({
        ...defaultContractArgs,
        startBlock: 50,
        endBlock: 100,
      });
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(100 - simnet.burnBlockHeight + 1);
      const { result } = simnet.callPublicFn(contractName, "start", [], funder);

      expect(result).toBeErr(uintCV(300));
    });
  });

  describe("burn-ticket", () => {
    it("should not allow contracts to call", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-burn-ticket (ticket-id uint)) (contract-call? '${creator}.${contractName} burn-ticket ticket-id))`;
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight
      );
      simnet.callPublicFn(contractName, "start", [], creator);
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(1245)],
        ticketBuyer
      );
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
      simnet.callPublicFn(contractName, "start", [], creator);
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(1245)],
        ticketBuyer
      );
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight
      );
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
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight
      );
      simnet.callPublicFn(contractName, "draw-numbers", [], creator);
    });

    it("should not allow a player to burn their tickets if the ticket is the winning one", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
      simnet.callPublicFn(contractName, "start", [], creator);
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(64807)],
        ticketBuyer
      );
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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

  describe("buy tickets", () => {
    it("should not allow contracts to call", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-buy-ticket (recipient principal) (nums uint)) (contract-call? '${creator}.${contractName} buy-ticket recipient nums))`;
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
      const { result: startResult } = simnet.callPublicFn(
        contractName,
        "start",
        [],
        creator
      );
      expect(startResult).toBeOk(boolCV(true));
      const ticketBuyer = accounts.get("wallet_1")!;
      simnet.mineBlock(
        [...Array(100).keys()].map((i) =>
          tx.callPublicFn(
            contractName,
            "buy-ticket",
            [principalCV(ticketBuyer), uintCV(i)],
            ticketBuyer
          )
        )
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
      const contract = await generateLotteryContract(defaultContractArgs);
      // Block height: 1
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      // Block height: 2
      simnet.callPublicFn(contractName, "fund", [], creator);
      // Block height: 3
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
      // Block height: 10
      simnet.callPublicFn(contractName, "start", [], creator);
      // Block height: 11
      const blocksUntillastBlockWithBuyAvailable =
        defaultContractArgs.endBlock -
        buyBlockMargin -
        simnet.burnBlockHeight -
        1;

      simnet.mineEmptyBurnBlocks(blocksUntillastBlockWithBuyAvailable);
      const { result: availableTicketResult } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(92345)],
        ticketBuyer
      );
      expect(availableTicketResult).toBeOk(uintCV(1));

      simnet.mineEmptyBurnBlock();
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
      const contract = await generateLotteryContract(defaultContractArgs);

      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);

      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);

      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);

      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);

      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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

  describe("cancel", () => {
    it("should not allow contracts to call", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-cancel) (contract-call? '${deployer}.${contractName} cancel))`;
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      simnet.callPublicFn(contractName, "fund", [], deployer);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
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
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
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

  describe("claim-funds", () => {
    it("should not allow contracts to call", async () => {
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-claim-funds) (contract-call? '${deployer}.${contractName} claim-funds))`;
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight
      );
      simnet.callPublicFn(contractName, "start", [], funder);
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(12300)],
        ticketBuyer
      );
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight
      );
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
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.callPublicFn(contractName, "fund", [], secondFunder);
      simnet.callPublicFn(contractName, "fund", [], thirdFunder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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

  describe("claim-prize", () => {
    it("should not allow contracts to call", async () => {
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-claim-prize (ticket-id uint)) (contract-call? '${deployer}.${contractName} claim-prize ticket-id))`;
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight
      );
      simnet.callPublicFn(contractName, "start", [], funder);
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(winner), uintCV(64807)],
        winner
      );
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
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

      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );

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

      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );

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
          "recipient": "ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND",
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
          "sender": "ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND",
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
      simnet.callPublicFn(contractName, "start", [], funder);
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(winner), uintCV(64807)],
        winner
      );
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
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
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.callPublicFn(contractName, "claim-prize", [uintCV(1)], winner);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
      simnet.callPublicFn(contractName, "start", [], funder);

      const { result: buyTicket } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(winner), uintCV(64807)],
        winner
      );
      expect(buyTicket).toBeOk(uintCV(1));

      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
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
          "recipient": "ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND",
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
          "sender": "ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND",
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

  describe("draw numbers", () => {
    it("should not allow contracts to call", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-draw-number) (contract-call? '${creator}.${contractName} draw-numbers))`;
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
      simnet.callPublicFn(contractName, "start", [], creator);
      const { result } = simnet.callPublicFn(
        `${exploiter}.${proxyContractName}`,
        "proxy-draw-number",
        [],
        exploiter
      );

      expect(result).toBeErr(uintCV(2001));
    });

    it("should only allow drawing the numbers of an active lottery", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const drawer = accounts.get("wallet_7")!;
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      const { result: result1 } = simnet.callPublicFn(
        contractName,
        "draw-numbers",
        [],
        drawer
      );
      expect(result1).toBeErr(uintCV(502));

      simnet.callPublicFn(contractName, "fund", [], creator);
      const { result: result2 } = simnet.callPublicFn(
        contractName,
        "draw-numbers",
        [],
        drawer
      );
      expect(result2).toBeErr(uintCV(502));

      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
      const { result: startResult } = simnet.callPublicFn(
        contractName,
        "start",
        [],
        creator
      );
      expect(startResult).toBeOk(boolCV(true));
      const { result: result3 } = simnet.callPublicFn(
        contractName,
        "draw-numbers",
        [],
        drawer
      );
      expect(result3).toBeErr(uintCV(301));

      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
      const { result } = simnet.callPublicFn(
        contractName,
        "draw-numbers",
        [],
        drawer
      );
      // The vrf-seed is deterministic in tests, so we can expect the same result for the same block-height
      // Since the coded difficulty is 5 we expect the result to be 1
      expect(result).toBeOk(uintCV(64807));
    });

    it("should always pick the vrf-seed from the same set tenure height", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const drawer = accounts.get("wallet_7")!;

      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
      const { result: startResult } = simnet.callPublicFn(
        contractName,
        "start",
        [],
        creator
      );
      expect(startResult).toBeOk(boolCV(true));

      simnet.mineEmptyBurnBlocks(100);
      const { result } = simnet.callPublicFn(
        contractName,
        "draw-numbers",
        [],
        drawer
      );
      // The vrf-seed is deterministic in tests, so we can expect the same result for the same block-height
      // Since the coded difficulty is 5 we expect the result to be 1
      expect(result).toBeOk(uintCV(64807));
    });

    it("should finish the lottery after drawing the numbers and the numbers should be available when there are no winners available", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const drawer = accounts.get("wallet_7")!;
      const player = accounts.get("wallet_3")!;
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
      simnet.callPublicFn(contractName, "start", [], creator);
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(player), uintCV(12345)],
        player
      );
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
      const { result } = simnet.callPublicFn(
        contractName,
        "draw-numbers",
        [],
        drawer
      );
      expect(result).toBeOk(uintCV(64807));

      const { result: result2 } = simnet.callReadOnlyFn(
        contractName,
        "get-status",
        [],
        drawer
      );
      expect(result2).toBeOk(stringAsciiCV("finished"));

      const { result: result3 } = simnet.callReadOnlyFn(
        contractName,
        "get-drawn-number",
        [],
        drawer
      );
      expect(result3).toBeSome(uintCV(64807));

      const { result: result4 } = simnet.callReadOnlyFn(
        contractName,
        "get-winner-ticket-id",
        [],
        drawer
      );
      expect(result4).toBeOk(noneCV());
    });

    it("should finish the lottery after drawing the numbers and the numbers and the winner should be available when it was won", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const drawer = accounts.get("wallet_7")!;
      const player = accounts.get("wallet_3")!;
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        creator
      );
      simnet.callPublicFn(contractName, "fund", [], creator);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
      simnet.callPublicFn(contractName, "start", [], creator);
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(player), uintCV(12345)],
        player
      );
      const { result: winnerResult } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(player), uintCV(64807)],
        player
      );
      expect(winnerResult).toBeOk(uintCV(2));
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
      const { result } = simnet.callPublicFn(
        contractName,
        "draw-numbers",
        [],
        drawer
      );
      expect(result).toBeOk(uintCV(64807));

      const { result: result2 } = simnet.callReadOnlyFn(
        contractName,
        "get-status",
        [],
        drawer
      );
      expect(result2).toBeOk(stringAsciiCV("won"));

      const { result: result3 } = simnet.callReadOnlyFn(
        contractName,
        "get-drawn-number",
        [],
        drawer
      );
      expect(result3).toBeSome(uintCV(64807));

      const { result: result4 } = simnet.callReadOnlyFn(
        contractName,
        "get-winner-ticket-id",
        [],
        drawer
      );
      expect(result4).toBeOk(someCV(uintCV(2)));
    });
  });

  describe("fund", () => {
    it("should not allow contracts to call", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-fund) (contract-call? '${deployer}.${contractName} fund))`;
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
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
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );

      const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
      expect(result).toBeOk(boolCV(true));

      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);

      simnet.callPublicFn(contractName, "start", [], funder);
      const { result: secondFundRequest } = simnet.callPublicFn(
        contractName,
        "fund",
        [],
        secondFunder
      );
      expect(secondFundRequest).toBeErr(uintCV(502));
    });

    it("a contract can only be funded if it is not ended", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );

      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
      simnet.callPublicFn(contractName, "start", [], funder);
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - defaultContractArgs.startBlock - 1
      );
      simnet.callPublicFn(contractName, "draw-numbers", [], funder);

      const { result: fundRequestAfterEnd } = simnet.callPublicFn(
        contractName,
        "fund",
        [],
        secondFunder
      );
      expect(fundRequestAfterEnd).toBeErr(uintCV(502));
    });

    it("a contract can only be funded if there are still slots available", async () => {
      const contract = await generateLotteryContract({
        ...defaultContractArgs,
        slots: 2,
      });
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
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
        secondFunder
      );
      expect(secondFundResult).toBeOk(boolCV(true));
      const { result: thirdFundResult } = simnet.callPublicFn(
        contractName,
        "fund",
        [],
        thirdFunder
      );
      expect(thirdFundResult).toBeErr(uintCV(503));
    });

    it("a contract can only be funded if the funder is not a funder already", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
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
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      const { events } = simnet.callPublicFn(contractName, "fund", [], funder);
      const transfer = events[0];

      expect(transfer.event).toBe("stx_transfer_event");
      expect(transfer.data.amount).toBe(
        defaultContractArgs.slotSize.toString()
      );
      expect(transfer.data.sender).toBe(funder);
      expect(transfer.data.recipient).toBe(`${deployer}.${contractName}`);
    });

    it("the contract prize pool should be updated with every fund", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      const { result: prizePoolBefore } = simnet.callReadOnlyFn(
        contractName,
        "get-prize-pool",
        [],
        funder
      );
      expect(prizePoolBefore).toBeOk(uintCV(0));
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.callPublicFn(contractName, "fund", [], secondFunder);
      simnet.callPublicFn(contractName, "fund", [], thirdFunder);
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
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      if (simnet.burnBlockHeight < 10) {
        simnet.mineEmptyBurnBlocks(10 - simnet.burnBlockHeight);
      }
      const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
      expect(result).toBeErr(uintCV(505));
    });
  });

  describe("get fund refund", () => {
    it("should not allow contracts to call", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-get-fund-refund) (contract-call? '${deployer}.${contractName} get-fund-refund))`;

      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.callPublicFn(contractName, "cancel", [], felix);
      const { result: getTicketRefundResult } = simnet.callPublicFn(
        `${exploiter}.${proxyContractName}`,
        "proxy-get-fund-refund",
        [],
        funder
      );
      expect(getTicketRefundResult).toBeErr(uintCV(2001));
    });

    it("is possible to get a pool contribution refund on a cancelled lottery", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
      expect(result).toBeOk(boolCV(true));

      simnet.callPublicFn(contractName, "cancel", [], felix);
      const { result: getTicketRefundResult, events } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        funder
      );
      expect(getTicketRefundResult).toBeOk(trueCV());
      expect(events[0]).toMatchInlineSnapshot(`
      {
        "data": {
          "amount": "1000",
          "memo": "",
          "recipient": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
          "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test",
        },
        "event": "stx_transfer_event",
      }
    `);
    });

    it("is only possible to get a pool contribution refund once", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
      expect(result).toBeOk(boolCV(true));

      simnet.callPublicFn(contractName, "cancel", [], felix);
      const { result: getTicketRefundResult } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        funder
      );
      expect(getTicketRefundResult).toBeOk(trueCV());

      const { result: getTryAgainResult } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        funder
      );
      expect(getTryAgainResult).toBeErr(uintCV(1002));
    });

    it("is only possible to get a refund for a contribution if the lottery was cancelled", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
      expect(result).toBeOk(trueCV());

      const { result: tryRefund } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        funder
      );
      expect(tryRefund).toBeErr(uintCV(502));
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.startBlock - simnet.burnBlockHeight + 1
      );
      const { result: start } = simnet.callPublicFn(
        contractName,
        "start",
        [],
        funder
      );
      expect(start).toBeOk(trueCV());

      const { result: tryRefundOnStart } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        funder
      );
      expect(tryRefundOnStart).toBeErr(uintCV(502));

      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight + 1
      );
      const { result: drawNumbers } = simnet.callPublicFn(
        contractName,
        "draw-numbers",
        [],
        funder
      );
      expect(drawNumbers).toBeOk(uintCV(64807));

      const { result: tryRefundOnFinish } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        funder
      );
      expect(tryRefundOnFinish).toBeErr(uintCV(502));
    });

    it("is only possible to get a refund for a lottery if the caller is funder of the lottery", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
      expect(result).toBeOk(boolCV(true));

      simnet.callPublicFn(contractName, "cancel", [], felix);
      const { result: notFunderRefund } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        ticketBuyer
      );
      expect(notFunderRefund).toBeErr(uintCV(1001));

      const { result: funderRefund } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        funder
      );
      expect(funderRefund).toBeOk(trueCV());
    });

    it("is possible for multiple funders to get their refunds", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.callPublicFn(contractName, "fund", [], secondFunder);

      simnet.callPublicFn(contractName, "cancel", [], felix);
      const { result: notFunderRefund } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        ticketBuyer
      );
      expect(notFunderRefund).toBeErr(uintCV(1001));

      const { result: funderRefund } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        funder
      );
      expect(funderRefund).toBeOk(trueCV());

      const { result: funderSecondRefund } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        funder
      );
      expect(funderSecondRefund).toBeErr(uintCV(1002));

      const { result: anotherRefund } = simnet.callPublicFn(
        contractName,
        "get-fund-refund",
        [],
        secondFunder
      );
      expect(anotherRefund).toBeOk(trueCV());
    });
  });

  describe("get ticket refund", () => {
    it("should not allow contracts to call", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-get-ticket-refund (ticket-id uint)) (contract-call? '${deployer}.${contractName} get-ticket-refund ticket-id))`;
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
      expect(result).toBeOk(boolCV(true));
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
      simnet.callPublicFn(contractName, "start", [], funder);
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(ticketBuyer), uintCV(12345)],
        ticketBuyer
      );
      simnet.callPublicFn(contractName, "cancel", [], felix);
      const { result: getTicketRefundResult } = simnet.callPublicFn(
        `${exploiter}.${proxyContractName}`,
        "proxy-get-ticket-refund",
        [uintCV(1)],
        funder
      );
      expect(getTicketRefundResult).toBeErr(uintCV(2001));
    });

    it("is possible to get a ticket refund on a cancelled lottery", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
      expect(result).toBeOk(boolCV(true));

      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
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
          "amount": "10",
          "memo": "",
          "recipient": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
          "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test",
        },
        "event": "stx_transfer_event",
      }
    `);
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

    it("is only possible to get a ticket refund once", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
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
      simnet.mineEmptyBurnBlocks(
        defaultContractArgs.endBlock - simnet.burnBlockHeight
      );
      simnet.callPublicFn(contractName, "draw-numbers", [], funder);
      const { result: getTicketRefundResultAfterFinished } =
        simnet.callPublicFn(
          contractName,
          "get-ticket-refund",
          [uintCV(1)],
          ticketBuyer
        );
      expect(getTicketRefundResultAfterFinished).toBeErr(uintCV(502));
    });

    it("is only possible to get a refund for a ticket if you are the ticket owner", async () => {
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
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
      const contract = await generateLotteryContract(defaultContractArgs);
      simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      simnet.callPublicFn(contractName, "fund", [], funder);
      simnet.mineEmptyBurnBlocks(defaultContractArgs.startBlock);
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
        [principalCV(ticketBuyer2), uintCV(12347)],
        ticketBuyer2
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
        ticketBuyer2
      );
      expect(result3).toBeOk(uintCV(3));
    });
  });
});
