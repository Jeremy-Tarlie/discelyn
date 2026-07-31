import { z } from "zod";

export const createBotSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nom trop court")
    .max(32, "Nom trop long")
    .regex(/^[\w\s\-àâäéèêëïîôùûüç]+$/i, "Caractères non autorisés"),
  description: z.string().trim().max(300).optional(),
});

export const checkoutSchema = z.object({
  planId: z.enum(["STARTER", "PRO", "BUSINESS"]),
});

export type CreateBotInput = z.infer<typeof createBotSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
