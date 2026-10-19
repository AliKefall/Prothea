import {z} from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9]+(_[a-zA-Z0-9]+)*$/, "Use 3–32 letters or numbers, with single underscores only between them")
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be no more than 32 characters"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254, "Email must be no more than 254 characters"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be no more than 128 characters")
    .regex(/^[^\s]+$/, "Password cannot contain spaces")
    .regex(/[a-z]/, "Add at least one lowercase letter")
    .regex(/[A-Z]/, "Add at least one uppercase letter")
    .regex(/[0-9]/, "Add at least one number")
    .regex(/[^A-Za-z0-9\s]/, "Add at least one symbol"),
});
