import { describe, expect, it } from "vitest";
import { principalCV, uintCV } from "@stacks/transactions";
import { GenerateContractArgs, generateContract } from "../contract-helper";

const accounts = simnet.getAccounts();
const felix = accounts.get("felix")!;
const admin = accounts.get("deployer")!;
const creator = accounts.get("wallet_1")!;
const newAdmin = accounts.get("wallet_5")!;

const defaultContractArgs: GenerateContractArgs = {
  name: "test",
  creator,
  felix,
  fee: BigInt(20),
  availableTickets: 5,
  ticketPrice: BigInt(10),
  difficulty: 5,
  startBlock: 100,
  endBlock: 200,
  token: "STX",
  slots: 10,
  slotSize: BigInt(1000),
};
const contractName = `felix-${defaultContractArgs.name}`;

describe("update-admin", () => {
  it("can only be updated by the current admin", async () => {
    const contract = await generateContract(defaultContractArgs);
    simnet.deployContract(contractName, contract, null, admin);
    simnet.mineEmptyBlocks(1000);
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
