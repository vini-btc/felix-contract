import { describe, expect, it } from "vitest";
import { stringAsciiCV, trueCV, uintCV } from "@stacks/transactions";
import { GenerateContractArgs, generateContract } from "../contract-helper";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const deployer = accounts.get("deployer")!;
const funder = accounts.get("wallet_2")!;

const fee = BigInt(20);

const defaultContractArgs: GenerateContractArgs = {
  name: "test",
  creator: deployer,
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
};
const contractName = `felix-${defaultContractArgs.name}`;

describe("cancel", () => {
  it("can only be cancelled by the lottery admin", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, deployer);
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
