import { describe, expect, it } from "vitest";
import { boolCV, trueCV, uintCV } from "@stacks/transactions";
import { GenerateContractArgs, generateContract } from "../contract-helper";
import { uint } from "@stacks/transactions/dist/cl";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const deployer = accounts.get("deployer")!;
const funder = accounts.get("wallet_2")!;
const notFunder = accounts.get("wallet_3")!;
const anotherFunder = accounts.get("wallet_4")!;

const defaultContractArgs: GenerateContractArgs = {
  name: "test",
  creator: deployer,
  felix,
  fee: BigInt(20),
  availableTickets: 5,
  ticketPrice: BigInt(10),
  difficulty: 5,
  startBlock: 100,
  endBlock: 200,
  token: "STX",
  slots: 10,
  slotSize: BigInt(1_000),
};
const contractName = `felix-${defaultContractArgs.name}`;

describe("get fund refund", () => {
  it("is possible to get a pool contribution refund on a cancelled lottery", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
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
          "recipient": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
          "sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-test",
        },
        "event": "stx_transfer_event",
      }
    `);
  });

  it("is only possible to get a pool contribution refund once", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
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
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
    expect(result).toBeOk(trueCV());

    const { result: tryRefund } = simnet.callPublicFn(
      contractName,
      "get-fund-refund",
      [],
      funder
    );
    expect(tryRefund).toBeErr(uintCV(502));
    simnet.mineEmptyBlocks(defaultContractArgs.startBlock - simnet.blockHeight);
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

    simnet.mineEmptyBlocks(defaultContractArgs.endBlock - simnet.blockHeight);
    const { result: drawNumbers } = simnet.callPublicFn(
      contractName,
      "draw-numbers",
      [],
      funder
    );
    expect(drawNumbers).toBeOk(uintCV(15032));

    const { result: tryRefundOnFinish } = simnet.callPublicFn(
      contractName,
      "get-fund-refund",
      [],
      funder
    );
    expect(tryRefundOnFinish).toBeErr(uintCV(502));
  });

  it("is only possible to get a refund for a lottery if the caller is funder of the lottery", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    const { result } = simnet.callPublicFn(contractName, "fund", [], funder);
    expect(result).toBeOk(boolCV(true));

    simnet.callPublicFn(contractName, "cancel", [], felix);
    const { result: notFunderRefund } = simnet.callPublicFn(
      contractName,
      "get-fund-refund",
      [],
      notFunder
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
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
    simnet.callPublicFn(contractName, "fund", [], funder);
    simnet.callPublicFn(contractName, "fund", [], anotherFunder);

    simnet.callPublicFn(contractName, "cancel", [], felix);
    const { result: notFunderRefund } = simnet.callPublicFn(
      contractName,
      "get-fund-refund",
      [],
      notFunder
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
      anotherFunder
    );
    expect(anotherRefund).toBeOk(trueCV());
  });
});
