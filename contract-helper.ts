import ejs from "ejs";
import path from "path";

export interface GenerateContractArgs {
  availableTickets: number;
  creator: string;
  difficulty: number;
  endBlock: number;
  fee: bigint;
  felix: string;
  name: string;
  slotSize: bigint;
  slots: number;
  startBlock: number;
  ticketPrice: bigint;
  token: string;
  startBlockBuffer?: number;
}

function validateArgs(args: GenerateContractArgs): void {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const isValidSlug = (slug: string) => slugRegex.test(slug);
  if (
    args.startBlockBuffer! < 0 ||
    args.availableTickets < 0 ||
    args.difficulty < 1 ||
    args.difficulty > 10 ||
    args.endBlock < args.startBlock ||
    args.slotSize < 0 ||
    args.slots < 0 ||
    args.startBlock < 0 ||
    args.ticketPrice < 0 ||
    args.token !== "STX" ||
    typeof args.felix !== "string" ||
    typeof args.name !== "string" ||
    !isValidSlug(args.name)
  ) {
    throw new Error("Invalid contract argument");
  }
  return;
}

export const generateContract = (
  args: GenerateContractArgs
): Promise<string> => {
  const argsWithDefaults = {
    ...args,
    startBlockBuffer: args.startBlockBuffer ?? 0,
  };
  validateArgs(args);
  return ejs.renderFile(
    path.resolve("./contracts/felix-template.clar.ejs"),
    argsWithDefaults
  );
};
