import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";
import {
  GenerateNftLotteryArgs,
  generateNftLotteryContract,
} from "./contract-helper";
import { principalCV, trueCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const felix = accounts.get("felix")!;
const buyer = accounts.get("wallet_1")!;
const buyer2 = accounts.get("wallet_2")!;
const exploiter = accounts.get("wallet_7")!;
const felixRandomContract = `${deployer}.felix-meta-v2`;

const defaultContractArgs: GenerateNftLotteryArgs = {
  duration: 100,
  name: "test",
  nftContract: `${deployer}.sample-megapont-nft`,
  nftUid: 1,
  felix,
  felixRandomContract,
  fee: BigInt(20_000),
  availableTickets: 5,
  ticketPrice: BigInt(1_000_000),
  difficulty: 5,
  token: "STX",
};

const contractName = `felixnft-${defaultContractArgs.name}`;

const mintNft = (minter: string) => {
  simnet.callPublicFn(
    defaultContractArgs.nftContract,
    "set-mint-address",
    [],
    minter
  ).result;
  simnet.callPublicFn(
    defaultContractArgs.nftContract,
    "mint",
    [principalCV(minter)],
    minter
  );
};

const deployLottery = async (
  contractArgs: Partial<GenerateNftLotteryArgs> = {}
): Promise<number> => {
  mintNft(deployer);
  const contract = await generateNftLotteryContract({
    ...defaultContractArgs,
    ...contractArgs,
  });
  simnet.deployContract(
    contractName,
    contract,
    { clarityVersion: 3 },
    deployer
  );
  return simnet.burnBlockHeight;
};

const buyTicket = (maybeNumber?: number) => {
  const number = faker.number.bigInt({
    max: BigInt(10 ** defaultContractArgs.difficulty) - BigInt(1),
  });
  simnet.callPublicFn(
    contractName,
    "buy-ticket",
    [principalCV(buyer), uintCV(maybeNumber ?? number)],
    buyer
  );
};

const drawLottery = () => {
  simnet.mineEmptyBurnBlocks(defaultContractArgs.duration + 1);
  simnet.callPublicFn(contractName, "draw", [], felix);
};

describe("NFT Lottery", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });
  describe("deploy", () => {
    it("should not deploy the contract if deployer can't transfer the contract", async () => {
      const contract = await generateNftLotteryContract(defaultContractArgs);
      const { result } = simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      expect(result).toBeErr(uintCV(3));
    });

    it("should deploy the contract if deployer can transfer the contract", async () => {
      mintNft(deployer);
      const contract = await generateNftLotteryContract(defaultContractArgs);
      const { result } = simnet.deployContract(
        contractName,
        contract,
        { clarityVersion: 3 },
        deployer
      );
      expect(result).toBeOk(trueCV());
    });
  });

  describe("buy-ticket", () => {
    it("should not allow contracts to call", async () => {
      await deployLottery();
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-buy-ticket (recipient principal) (nums uint)) (contract-call? '${deployer}.${contractName} buy-ticket recipient nums))`;
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      const { result } = simnet.callPublicFn(
        `${exploiter}.${proxyContractName}`,
        "proxy-buy-ticket",
        [principalCV(exploiter), uintCV(1245)],
        buyer
      );

      expect(result).toBeErr(uintCV(101));
    });

    it("should allow ticket buyers to buy a ticket with the selected numbers", async () => {
      await deployLottery();
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer), uintCV(1245)],
        buyer
      );
      expect(result).toBeOk(uintCV(1));

      const { result: result2 } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer2), uintCV(123)],
        buyer2
      );
      expect(result2).toBeOk(uintCV(2));
    });

    it("should not allow a player to buy a ticket when all tickets were sold", async () => {
      await deployLottery({ availableTickets: 5 });
      [100, 200, 300, 400, 500].map((num, idx) => {
        expect(
          simnet.callPublicFn(
            contractName,
            "buy-ticket",
            [principalCV(buyer), uintCV(num)],
            buyer
          ).result
        ).toBeOk(uintCV(idx + 1));
      });
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer2), uintCV(600)],
        buyer2
      );
      expect(result).toBeErr(uintCV(102));
    });

    it("should not allow two buyers to select the same number", async () => {
      await deployLottery();
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer), uintCV(1245)],
        buyer
      );
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer2), uintCV(1245)],
        buyer2
      );
      expect(result).toBeErr(uintCV(103));
    });

    it("should not allow to buy tickets at block end or later", async () => {
      const deployBlockHeight = await deployLottery();
      // Move to one tenure height before the end
      simnet.mineEmptyBurnBlocks(
        deployBlockHeight +
          defaultContractArgs.duration -
          simnet.burnBlockHeight -
          1
      );
      const { result: oneBlockBeforeTheEnd } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer), uintCV(123)],
        buyer
      );
      expect(oneBlockBeforeTheEnd).toBeOk(uintCV(1));

      // Now at tenure height equals end;
      simnet.mineEmptyBurnBlock();
      const { result: atTheEnd } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer), uintCV(1234)],
        buyer
      );
      expect(atTheEnd).toBeErr(uintCV(100));

      // Moving to the next tenure height after the end
      simnet.mineEmptyBurnBlock();
      const { result: oneBlockAfterTheEnd } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer), uintCV(12345)],
        buyer
      );
      expect(oneBlockAfterTheEnd).toBeErr(uintCV(100));
    });

    it("should transfer the ticket price to the contract, a fee to the felix contract and mint a new ticket", async () => {
      await deployLottery();
      const { events } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer), uintCV(123)],
        buyer
      );
      expect(events).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "amount": "1000000",
              "memo": "",
              "recipient": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felixnft-test",
              "sender": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
            },
            "event": "stx_transfer_event",
          },
          {
            "data": {
              "amount": "20000",
              "memo": "",
              "recipient": "STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6",
              "sender": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
            },
            "event": "stx_transfer_event",
          },
          {
            "data": {
              "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felixnft-test::felix-nft-test",
              "raw_value": "0x0100000000000000000000000000000001",
              "recipient": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
              "value": {
                "type": 1,
                "value": 1n,
              },
            },
            "event": "nft_mint_event",
          },
        ]
      `);
    });

    it("should correctly assign the played number to the ticket id", async () => {
      await deployLottery();
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer), uintCV(123)],
        buyer
      );

      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer2), uintCV(321)],
        buyer2
      );
      const firstTicketId = simnet.getMapEntry(
        contractName,
        "numbersToTicketIds",
        uintCV(123)
      );
      expect(firstTicketId).toBeSome(uintCV(1));

      const secondTicketId = simnet.getMapEntry(
        contractName,
        "numbersToTicketIds",
        uintCV(321)
      );
      expect(secondTicketId).toBeSome(uintCV(2));
    });

    it("should not allow buying tickets for a number bigger than what would be drawn with given difficulty but allow a smaller one", async () => {
      await deployLottery();
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer), uintCV(123456)],
        buyer
      );
      expect(result).toBeErr(uintCV(104));
    });
  });

  describe("draw", () => {
    it("should not allow contracts to call", async () => {
      await deployLottery();
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-draw) (contract-call? '${deployer}.${contractName} draw))`;
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      const { result } = simnet.callPublicFn(
        `${exploiter}.${proxyContractName}`,
        "proxy-draw",
        [],
        felix
      );

      expect(result).toBeErr(uintCV(101));
    });

    it("should only allow drawing the numbers after the defined duration period", async () => {
      const deployBlockHeight = await deployLottery();
      buyTicket();

      const { result } = simnet.callPublicFn(contractName, "draw", [], felix);
      expect(result).toBeErr(uintCV(105));

      // Move simnet to two blocks before the end
      simnet.mineEmptyBurnBlocks(
        deployBlockHeight +
          defaultContractArgs.duration -
          simnet.burnBlockHeight -
          1
      );

      // This TX goes to the block before the end
      const { result: resultBeforeEndBlock } = simnet.callPublicFn(
        contractName,
        "draw",
        [],
        felix
      );
      expect(resultBeforeEndBlock).toBeErr(uintCV(105));

      // Moving to end tenure height
      simnet.mineEmptyBurnBlock();
      const { result: resultAtEndBlock } = simnet.callPublicFn(
        contractName,
        "draw",
        [],
        felix
      );
      expect(resultAtEndBlock).toBeErr(uintCV(105));

      // Moving to one burn block after end tenure height
      simnet.mineEmptyBurnBlock();
      const { result: resultAfterEndBlock } = simnet.callPublicFn(
        contractName,
        "draw",
        [],
        felix
      );
      expect(resultAfterEndBlock).toBeOk(uintCV(17633));
    });

    it("should pick a random number using the random number contract", async () => {
      const deployBlockHeight = await deployLottery();
      simnet.mineEmptyBurnBlocks(
        deployBlockHeight +
          defaultContractArgs.duration +
          1 -
          simnet.burnBlockHeight
      );
      const { result } = simnet.callPublicFn(contractName, "draw", [], felix);
      expect(result).toBeOk(uintCV(17633));
    });

    it("should always pick the random number from the end block height", async () => {
      await deployLottery();
      simnet.mineEmptyBurnBlocks(2000);
      // We already know the drawn number for this lottery is 17633 - it is deterministic in test environments
      // So we move many blocks ahead before we draw to check that it's picking it from the right block height.
      const { result } = simnet.callPublicFn(contractName, "draw", [], felix);
      expect(result).toBeOk(uintCV(17633));
    });

    it("should set the result after the drawing", async () => {
      await deployLottery();
      simnet.mineEmptyBurnBlocks(120);
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-result",
        [],
        felix
      );
      expect(result).toBeNone();
      simnet.callPublicFn(contractName, "draw", [], felix);
      const { result: resultAfterDrawing } = simnet.callReadOnlyFn(
        contractName,
        "get-result",
        [],
        felix
      );
      expect(resultAfterDrawing).toBeSome(uintCV(17633));
    });

    it("should only draw once", async () => {
      await deployLottery();
      simnet.mineEmptyBurnBlocks(400);
      const { result } = simnet.callPublicFn(contractName, "draw", [], felix);
      expect(result).toBeOk(uintCV(17633));

      const { result: secondDraw } = simnet.callPublicFn(
        contractName,
        "draw",
        [],
        felix
      );
      expect(secondDraw).toBeErr(uintCV(106));
    });

    it.each([
      [2, 33],
      [3, 633],
      [4, 7633],
      [5, 17633],
      [6, 617633],
      // We repeat for seven because the seventh digit is 0
      [7, 617633],
      [8, 80617633],
      [9, 880617633],
      [10, 3880617633],
    ])(
      "should pick %i when lottery difficulty is %i",
      async (difficulty, expected) => {
        await deployLottery({ difficulty });
        simnet.mineEmptyBurnBlocks(400);
        const { result } = simnet.callPublicFn(contractName, "draw", [], felix);
        expect(result).toBeOk(uintCV(expected));
      }
    );

    it("should set the winner ticket id if someone guessed the number correctly", async () => {
      await deployLottery();
      simnet.callPublicFn(
        contractName,
        "buy-ticket",
        [principalCV(buyer), uintCV(17633)],
        buyer
      );
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-winner",
        [],
        buyer
      );
      expect(result).toBeNone();
      simnet.mineEmptyBurnBlocks(300);
      simnet.callPublicFn(contractName, "draw", [], felix);
      const { result: withWinnerResult } = simnet.callReadOnlyFn(
        contractName,
        "get-winner",
        [],
        buyer
      );
      expect(withWinnerResult).toBeSome(uintCV(1));
    });
  });

  describe("claim-prize", () => {
    it("should not allow contracts to call", async () => {
      await deployLottery();
      buyTicket(17633);
      drawLottery();
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-claim-prize (ticket-id uint)) (contract-call? '${deployer}.${contractName} claim-prize ticket-id))`;
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      const { result } = simnet.callPublicFn(
        `${exploiter}.${proxyContractName}`,
        "proxy-claim-prize",
        [uintCV(1)],
        buyer
      );

      expect(result).toBeErr(uintCV(101));
    });

    it("should return an error in case the lottery has not been drawn yet", async () => {
      await deployLottery();
      await buyTicket();
      await buyTicket();
      const { result } = simnet.callPublicFn(
        contractName,
        "claim-prize",
        [uintCV(1)],
        buyer
      );
      expect(result).toBeErr(uintCV(108));
    });

    it("should return an error in case the ticket number does not match the winner result", async () => {
      await deployLottery();
      // Buy a ticket with a different number than the winner
      buyTicket(1234);
      drawLottery();
      const { result } = simnet.callPublicFn(
        contractName,
        "claim-prize",
        [uintCV(1)],
        buyer
      );
      expect(result).toBeErr(uintCV(109));
    });

    it("should only allow the owner of a ticket to claim a prize", async () => {
      await deployLottery();
      // Buyer buys the winning ticket
      buyTicket(17633);
      drawLottery();
      // Exploiter tries to claim the prize
      const { result } = simnet.callPublicFn(
        contractName,
        "claim-prize",
        [uintCV(1)],
        deployer
      );
      expect(result).toBeErr(uintCV(403));

      const { result: legitCallResult } = simnet.callPublicFn(
        contractName,
        "claim-prize",
        [uintCV(1)],
        buyer
      );
      expect(legitCallResult).toBeOk(trueCV());
    });

    it("should only allow the owner of a ticket to claim the prize once", async () => {
      await deployLottery();
      // Buyer buys the winning ticket
      buyTicket(17633);
      drawLottery();
      simnet.callPublicFn(contractName, "claim-prize", [uintCV(1)], buyer);
      const { result } = simnet.callPublicFn(
        contractName,
        "claim-prize",
        [uintCV(1)],
        buyer
      );
      expect(result).toBeErr(uintCV(110));
    });

    it("should transfer the nft to the ticket owner if the ticket number matches the result", async () => {
      await deployLottery();
      buyTicket();
      buyTicket();
      // Buyer buys the winning ticket
      buyTicket(17633);
      drawLottery();
      const { result, events } = simnet.callPublicFn(
        contractName,
        "claim-prize",
        [uintCV(3)],
        buyer
      );
      expect(result).toBeOk(trueCV());
      expect(events).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sample-megapont-nft::Megapont-Ape-Club",
              "raw_value": "0x0100000000000000000000000000000001",
              "recipient": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
              "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felixnft-test",
              "value": {
                "type": 1,
                "value": 1n,
              },
            },
            "event": "nft_transfer_event",
          },
        ]
      `);
    });
  });

  describe("claim-revenue", () => {
    it("should not allow contracts to call", async () => {
      await deployLottery();
      const exploiter = accounts.get("wallet_7")!;
      const proxyContractName = "felix-proxy";
      const proxyContract = `(define-public (proxy-claim-revenue) (contract-call? '${deployer}.${contractName} claim-revenue))`;
      simnet.deployContract(
        proxyContractName,
        proxyContract,
        { clarityVersion: 3 },
        exploiter
      );
      const { result } = simnet.callPublicFn(
        `${exploiter}.${proxyContractName}`,
        "proxy-claim-revenue",
        [],
        deployer
      );

      expect(result).toBeErr(uintCV(101));
    });

    it("should only allow the funder to claim the ticket sales after the lottery was drawn", async () => {
      await deployLottery();
      buyTicket();
      buyTicket();
      buyTicket();
      const { result } = simnet.callPublicFn(
        contractName,
        "claim-revenue",
        [],
        deployer
      );
      expect(result).toBeErr(uintCV(108));
      drawLottery();
      const { result: resultAfterDrawing } = simnet.callPublicFn(
        contractName,
        "claim-revenue",
        [],
        deployer
      );
      expect(resultAfterDrawing).toBeOk(trueCV());
    });

    it("should only allow the funder to claim the ticket sales", async () => {
      await deployLottery();
      buyTicket();
      drawLottery();
      const { result } = simnet.callPublicFn(
        contractName,
        "claim-revenue",
        [],
        exploiter
      );
      expect(result).toBeErr(uintCV(403));
    });

    it("should only allow the funder to claim the ticket sales once", async () => {
      await deployLottery();
      buyTicket();
      drawLottery();
      simnet.callPublicFn(contractName, "claim-revenue", [], deployer);
      const { result } = simnet.callPublicFn(
        contractName,
        "claim-revenue",
        [],
        deployer
      );
      expect(result).toBeErr(uintCV(111));
    });

    it("should transfer all ticket sales revenue if the lottery had a winner", async () => {
      await deployLottery();
      buyTicket();
      buyTicket();
      buyTicket();
      // Winning ticket
      buyTicket(17633);
      drawLottery();
      const { result, events } = simnet.callPublicFn(
        contractName,
        "claim-revenue",
        [],
        deployer
      );
      expect(result).toBeOk(trueCV());
      expect(events).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "amount": "4000000",
              "memo": "",
              "recipient": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
              "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felixnft-test",
            },
            "event": "stx_transfer_event",
          },
        ]
      `);
    });

    it("should transfer all ticket sales and the nft back if the lottery had no winner", async () => {
      await deployLottery();
      buyTicket();
      buyTicket();
      buyTicket();
      drawLottery();
      const { result, events } = simnet.callPublicFn(
        contractName,
        "claim-revenue",
        [],
        deployer
      );
      expect(result).toBeOk(trueCV());
      expect(events).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sample-megapont-nft::Megapont-Ape-Club",
              "raw_value": "0x0100000000000000000000000000000001",
              "recipient": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
              "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felixnft-test",
              "value": {
                "type": 1,
                "value": 1n,
              },
            },
            "event": "nft_transfer_event",
          },
          {
            "data": {
              "amount": "3000000",
              "memo": "",
              "recipient": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
              "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felixnft-test",
            },
            "event": "stx_transfer_event",
          },
        ]
      `);
    });

    it("should transfer the nft back if the lottery had no winner and did not sell any tickets", async () => {
      await deployLottery();
      drawLottery();
      const { result, events } = simnet.callPublicFn(
        contractName,
        "claim-revenue",
        [],
        deployer
      );
      expect(result).toBeOk(trueCV());
      expect(events).toMatchInlineSnapshot(`
        [
          {
            "data": {
              "asset_identifier": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sample-megapont-nft::Megapont-Ape-Club",
              "raw_value": "0x0100000000000000000000000000000001",
              "recipient": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
              "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felixnft-test",
              "value": {
                "type": 1,
                "value": 1n,
              },
            },
            "event": "nft_transfer_event",
          },
        ]
      `);
    });
  });
});
