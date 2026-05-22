import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(72, "Password is too long"),
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
