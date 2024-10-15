import { principalCV, principalToString } from "@stacks/transactions";
import ejs from "ejs";
import path from "path";
import { z } from "zod";

const parsePrincipal = (principal: string) =>
  principalToString(principalCV(principal));

const refinePrincipal = (value: string) => {
  try {
    parsePrincipal(value);
    return true;
  } catch (error) {
    return false;
  }
};

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const escape = (str: string) => {
  if (typeof str !== "string") {
    return str;
  }
  return str.replace("(", "").replace(")", "");
};

const LotteryContractArgs = z
  .object({
    availableTickets: z.number().int().positive(),
    difficulty: z.number().int().min(2).max(10),
    endBlock: z.number().int().positive(),
    fee: z.bigint(),
    felix: z.string().refine(refinePrincipal, {
      message: "Invalid principal format for felix",
    }),
    felixRandomContract: z.string().refine(refinePrincipal, {
      message: "Invalid principal format for felix",
    }),
    name: z.string().regex(slugRegex, {
      message:
        "Name must be a valid slug: lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
    }),
    slotSize: z.bigint().positive(),
    slots: z.number().int().positive(),
    startBlock: z.number().int().positive(),
    ticketPrice: z.bigint().positive(),
    token: z.literal("STX"),
    startBlockBuffer: z.number().int().nonnegative(),
  })
  .strict();

export type GenerateFelixLotteryContractArgs = z.infer<
  typeof LotteryContractArgs
>;

export const generateLotteryContract = (
  input: GenerateFelixLotteryContractArgs
): Promise<string> => {
  const args = LotteryContractArgs.parse(input);

  return ejs.renderFile(
    path.resolve("./contracts/felix-template.clar.ejs"),
    {
      availableTickets: args.availableTickets,
      difficulty: args.difficulty,
      endBlock: args.endBlock,
      fee: args.fee,
      felix: args.felix,
      felixRandomContract: args.felixRandomContract,
      name: args.name,
      slotSize: args.slotSize,
      slots: args.slots,
      startBlock: args.startBlock,
      ticketPrice: args.ticketPrice,
      token: args.token,
      startBlockBuffer: args.startBlockBuffer,
    },
    { escape }
  );
};

const safeString = /^[a-z0-9-@]+$/;
const RaffleArgs = z
  .object({
    entries: z.array(z.string().regex(safeString).max(40)).max(9999),
    felix: z.string().refine(refinePrincipal, {
      message: "Invalid principal format for felix",
    }),
    felixRandomContract: z.string().refine(refinePrincipal, {
      message: "Invalid principal format for felix",
    }),
    name: z.string().regex(slugRegex, {
      message:
        "Name must be a valid slug: lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
    }),
  })
  .strict();

export type GenerateRaffleArgs = z.infer<typeof RaffleArgs>;

export const generateRaffleContract = (
  input: GenerateRaffleArgs
): Promise<string> => {
  const args = RaffleArgs.parse(input);

  return ejs.renderFile(
    path.resolve("./contracts/raffle-template.clar.ejs"),
    {
      name: args.name,
      entries: args.entries,
      felix: args.felix,
      felixRandomContract: args.felixRandomContract,
    },
    { escape }
  );
};

const NftLotteryArgs = z.object({
  availableTickets: z.number().int().positive(),
  difficulty: z.number().int().min(2).max(10),
  duration: z.number().int().positive(),
  fee: z.bigint(),
  felix: z
    .string()
    .refine(refinePrincipal, { message: "Invalid principal format for felix" }),
  nftContract: z
    .string()
    .refine(refinePrincipal, { message: "Invalid principal format for felix" }),
  felixRandomContract: z
    .string()
    .refine(refinePrincipal, { message: "Invalid principal format for felix" }),
  name: z.string().regex(slugRegex, {
    message:
      "Name must be a valid slug: lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
  }),
  nftUid: z.number().int().positive(),
  ticketPrice: z.bigint().positive(),
  token: z.literal("STX"),
});

export type GenerateNftLotteryArgs = z.infer<typeof NftLotteryArgs>;

export const generateNftLotteryContract = (
  input: GenerateNftLotteryArgs
): Promise<string> => {
  const args = NftLotteryArgs.parse(input);

  return ejs.renderFile(
    path.resolve("./contracts/felix-nft-template.clar.ejs"),
    {
      availableTickets: args.availableTickets,
      difficulty: args.difficulty,
      duration: args.duration,
      fee: args.fee,
      felix: args.felix,
      felixRandomContract: args.felixRandomContract,
      name: args.name,
      nftContract: args.nftContract,
      nftUid: args.nftUid,
      ticketPrice: args.ticketPrice,
      ticketName: `felix-nft-${args.name}`,
      token: args.token,
    },
    { escape }
  );
};
