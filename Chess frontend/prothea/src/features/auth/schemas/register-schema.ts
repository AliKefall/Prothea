import {z} from "zod";

export const registerSchema = z.object({
    username: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,32}$/, "Invalid username"),

    email: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"),

    password: z
    .string()
    .min(8)
    .max(128)
})
