import { describe, expect, it } from "vitest";
import { generateRaffleContract } from "../contract-helper";
import { someCV, stringAsciiCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const felix = accounts.get("felix")!;
const felixRandomContract = `${deployer}.felix-meta-v2`;
const raffleName = "felix-nft";
const entries = [
  "vini-btc",
  "muneeb",
  "aaron",
  "patrick",
  "jude",
  "mitchell",
  "james",
  "larry",
  "josh",
  "julian",
];

const raffleArguments = {
  name: raffleName,
  entries,
  felix,
  felixRandomContract,
};
describe("Felix raffle", () => {
  it("deploys the contract with all entries", async () => {
    const contract = await generateRaffleContract(raffleArguments);
    const { result } = simnet.deployContract(
      raffleName,
      contract,
      null,
      deployer
    );
    expect(result).toBeBool(true);

    const { result: entriesResult } = simnet.callReadOnlyFn(
      raffleName,
      "get-entries",
      [],
      deployer
    );
    expect(entriesResult).toBeList(
      entries.map((entry) => stringAsciiCV(entry))
    );
  });

  it("only allows drawing ten blocks after deployment", async () => {
    const contract = await generateRaffleContract(raffleArguments);
    simnet.deployContract(raffleName, contract, null, deployer);
    const { result: attempt1 } = simnet.callPublicFn(
      raffleName,
      "pick-winner",
      [],
      deployer
    );
    expect(attempt1).toBeErr(uintCV(400));
    simnet.mineEmptyBlocks(9);
    const { result: attempt2 } = simnet.callPublicFn(
      raffleName,
      "pick-winner",
      [],
      deployer
    );
    expect(attempt2).toBeOk(someCV(stringAsciiCV("jude")));
  });

  it("only allows drawing ten blocks after deployment", async () => {
    const contract = await generateRaffleContract(raffleArguments);
    simnet.deployContract(raffleName, contract, null, deployer);
    const { result: attempt1 } = simnet.callPublicFn(
      raffleName,
      "pick-winner",
      [],
      deployer
    );
    expect(attempt1).toBeErr(uintCV(400));

    simnet.mineEmptyBlocks(3);

    const { result: attempt2 } = simnet.callPublicFn(
      raffleName,
      "pick-winner",
      [],
      deployer
    );
    expect(attempt2).toBeErr(uintCV(400));
    simnet.mineEmptyBlocks(6);
    const { result: attempt3 } = simnet.callPublicFn(
      raffleName,
      "pick-winner",
      [],
      deployer
    );
    expect(attempt3).toBeOk(someCV(stringAsciiCV("jude")));
  });

  it("only allows picking a winner once", async () => {
    const contract = await generateRaffleContract(raffleArguments);
    simnet.deployContract(raffleName, contract, null, deployer);
    simnet.mineEmptyBlocks(9);
    const { result: successfulAttempt } = simnet.callPublicFn(
      raffleName,
      "pick-winner",
      [],
      deployer
    );
    expect(successfulAttempt).toBeOk(someCV(stringAsciiCV("jude")));

    const { result: failedAttempt } = simnet.callPublicFn(
      raffleName,
      "pick-winner",
      [],
      deployer
    );
    expect(failedAttempt).toBeErr(uintCV(501));
  });

  it("only allows standard principals to pick winner", async () => {
    const contract = await generateRaffleContract(raffleArguments);
    simnet.deployContract(raffleName, contract, null, deployer);
    const exploiter = accounts.get("wallet_7")!;
    const proxyContractName = "felix-proxy";
    const proxyContract = `(define-public (proxy-pick-winner) (contract-call? '${deployer}.${raffleName} pick-winner))`;

    simnet.deployContract(proxyContractName, proxyContract, null, exploiter);
    simnet.mineEmptyBlocks(10);
    const { result: exploitAttempt } = simnet.callPublicFn(
      `${exploiter}.${proxyContractName}`,
      "proxy-pick-winner",
      [],
      exploiter
    );
    expect(exploitAttempt).toBeErr(uintCV(401));

    const { result: successfulAttempt } = simnet.callPublicFn(
      raffleName,
      "pick-winner",
      [],
      deployer
    );
    expect(successfulAttempt).toBeOk(someCV(stringAsciiCV("jude")));
  });
});
