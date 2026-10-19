import {z} from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address" }).max(254)),
  password: z.string().min(1, "Enter your password").max(128, "Password is too long"),
});
