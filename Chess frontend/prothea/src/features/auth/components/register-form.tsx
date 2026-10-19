"use client";

import { z } from "zod";
import { useRouter } from "next/navigation";
import { registerSchema } from "../schemas/register-schema";
import { useRegister } from "../hooks/use-register";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FormError } from "@/components/form-error";

import {
  LockClosedIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";

type FormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const mutation = useRegister();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });
  const password = form.watch("password");
  const passwordRules = [
    { label: "8–128 characters", valid: password.length >= 8 && password.length <= 128 },
    { label: "At least one lowercase letter", valid: /[a-z]/.test(password) },
    { label: "At least one uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "At least one number", valid: /[0-9]/.test(password) },
    { label: "At least one symbol and no spaces", valid: /[^A-Za-z0-9\s]/.test(password) && !/\s/.test(password) },
  ];

  function onSubmit(data: FormData) {
    mutation.mutate(data, {
      onSuccess: () => {
        router.push("/login");
      },
    });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6 py-12">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute left-0 top-0 h-[600px] w-[600px] rounded-full bg-zinc-800/30 blur-3xl" />

        <div className="absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full bg-zinc-700/20 blur-3xl" />
      </div>

      {/* Register Card */}
      <Card className="relative z-10 w-full max-w-lg border-zinc-700 bg-zinc-900/90 py-4 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-4 px-6 pt-8 text-center sm:px-10">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-600 bg-zinc-800">
            <UserPlusIcon className="h-7 w-7 text-zinc-100" />
          </div>

          {/* Heading */}
          <div>
            <p className="mb-3 text-sm font-semibold tracking-[0.35em] text-zinc-400">
              PROTHEA
            </p>

            <CardTitle className="text-4xl font-bold tracking-tight text-zinc-50">
              Create account
            </CardTitle>

            <CardDescription className="mt-3 text-base text-zinc-300">
              Create your account and start your journey.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-6 sm:px-10 sm:pb-10">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
          >
            {/* Username */}
            <div className="space-y-2.5">
              <Label
                htmlFor="username"
                className="text-base font-medium text-zinc-200"
              >
                Username
              </Label>

              <div className="relative">
                <UserIcon
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />

                <Input
                  id="username"
                  type="text"
                  placeholder="Choose a username"
                  autoComplete="username"
                  className="h-12 border-zinc-700 bg-zinc-950 pl-12 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
                  {...form.register("username")}
                />
              </div>

              <FormError
                message={form.formState.errors.username?.message}
              />
              <p className="text-xs leading-relaxed text-zinc-500">
                3–32 characters. Use letters and numbers; underscores can appear between them.
              </p>
            </div>

            {/* Email */}
            <div className="space-y-2.5">
              <Label
                htmlFor="email"
                className="text-base font-medium text-zinc-200"
              >
                Email
              </Label>

              <div className="relative">
                <EnvelopeIcon
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />

                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="h-12 border-zinc-700 bg-zinc-950 pl-12 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
                  {...form.register("email")}
                />
              </div>

              <FormError
                message={form.formState.errors.email?.message}
              />
            </div>

            {/* Password */}
            <div className="space-y-2.5">
              <Label
                htmlFor="password"
                className="text-base font-medium text-zinc-200"
              >
                Password
              </Label>

              <div className="relative">
                <LockClosedIcon
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />

                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  maxLength={128}
                  className="h-12 border-zinc-700 bg-zinc-950 pl-12 pr-12 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>

              <FormError
                message={form.formState.errors.password?.message}
              />
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3" role="group" aria-label="Password requirements">
                <p className="mb-2 text-xs font-medium text-zinc-300">Password requirements</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {passwordRules.map((rule) => (
                    <li key={rule.label} className={`flex items-center gap-2 text-xs ${rule.valid ? "text-emerald-300" : "text-zinc-500"}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${rule.valid ? "bg-emerald-400" : "bg-zinc-600"}`} aria-hidden="true" />
                      {rule.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-zinc-500">Commonly used passwords are not accepted.</p>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="h-12 w-full bg-zinc-100 text-base font-semibold text-zinc-950 transition hover:bg-zinc-300"
            >
              {mutation.isPending
                ? "Creating account..."
                : "Create account"}
            </Button>

            <FormError message={mutation.error instanceof Error ? mutation.error.message : undefined} />

            {/* Divider */}
            <div className="flex items-center gap-5 py-1">
              <div className="h-px flex-1 bg-zinc-700" />

              <span className="text-sm font-medium text-zinc-400">
                OR
              </span>

              <div className="h-px flex-1 bg-zinc-700" />
            </div>

            {/* Login */}
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/login")}
              className="h-12 w-full border-zinc-600 bg-transparent text-base font-semibold text-zinc-200 transition hover:bg-zinc-800 hover:text-zinc-50"
            >
              Sign in to your account
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
