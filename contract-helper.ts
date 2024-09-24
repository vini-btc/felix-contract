import { principalCV, principalToString } from "@stacks/transactions";
import ejs from "ejs";
import path from "path";
import { z } from "zod";

const parsePrincipal = (principal: string) =>
  principalToString(principalCV(principal));
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ContractArgs = z
  .object({
    availableTickets: z.number().int().positive(),
    difficulty: z.number().int().min(1).max(10),
    endBlock: z.number().int().positive(),
    fee: z.bigint(),
    felix: z.string().refine(
      (value) => {
        try {
          parsePrincipal(value);
          return true;
        } catch (error) {
          return false;
        }
      },
      {
        message: "Invalid principal format for felix",
      }
    ),
    name: z.string().regex(slugRegex, {
      message:
        "Name must be a valid slug: lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
    }),
    slotSize: z.bigint(),
    slots: z.number().int().positive(),
    startBlock: z.number().int().positive(),
    ticketPrice: z.bigint(),
    token: z.string(),
    startBlockBuffer: z.number().int().nonnegative(),
  })
  .strict();

export type GenerateContractArgs = z.infer<typeof ContractArgs>;

export const generateContract = (
  input: GenerateContractArgs
): Promise<string> => {
  const args = ContractArgs.parse(input);

  return ejs.renderFile(path.resolve("./contracts/felix-template.clar.ejs"), {
    availableTickets: args.availableTickets,
    difficulty: args.difficulty,
    endBlock: args.endBlock,
    fee: args.fee,
    felix: args.felix,
    name: args.name,
    slotSize: args.slotSize,
    slots: args.slots,
    startBlock: args.startBlock,
    ticketPrice: args.ticketPrice,
    token: args.token,
    startBlockBuffer: args.startBlockBuffer,
  });
};
