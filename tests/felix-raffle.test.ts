import { describe, expect, test } from "vitest";

const accounts = simnet.getAccounts();
const contractName = `felix-raffle`;
const address1 = accounts.get("wallet_1")!;

describe("The Felix Raffle", () => {
  test.each([
    [1, "add-one"],
    [5, "add-five"],
    [10, "add-ten"],
    [25, "add-twenty-five"],
    [50, "add-fifty"],
    [100, "add-one-hundred"],
  ])(
    "allows the owner to add %i participant in the raffle",
    (numberOfParticipants) => {
      simnet.callPublicFn(contractName, , args: (Uint8Array)[], sender: string);
      expect(simnet.blockHeight).toBeDefined();
    }
  );

  // it("shows an example", () => {
  //   const { result } = simnet.callReadOnlyFn("counter", "get-counter", [], address1);
  //   expect(result).toBeUint(0);
  // });
});
