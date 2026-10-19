"use client";

import { z } from "zod";
import { useRouter } from "next/navigation";
import { useLogin } from "../hooks/use-login";
import { loginSchema } from "../schemas/login-schema";

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
  EyeIcon,
  EyeSlashIcon,
  EnvelopeIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

type FormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const mutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(data: FormData) {
    mutation.mutate(data, {
      onSuccess: () => {
        router.push("/dashboard");
      },
    });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6 py-12">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute left-0 top-0 h-150 w-150 rounded-full bg-zinc-800/30 blur-3xl" />

        <div className="absolute bottom-0 right-0 h-150 w-150 rounded-full bg-zinc-700/20 blur-3xl" />
      </div>

      {/* Login Card */}
      <Card className="relative z-10 w-full max-w-lg border-zinc-700 bg-zinc-900/90 py-4 shadow-2xl backdrop-blur">
        {/* Header */}
        <CardHeader className="space-y-4 px-6 pt-8 text-center sm:px-10">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-600 bg-zinc-800">
            <LockClosedIcon className="h-7 w-7 text-zinc-100" />
          </div>

          {/* Heading */}
          <div>
            <p className="mb-3 text-sm font-semibold tracking-[0.35em] text-zinc-400">
              PROTHEA
            </p>

            <CardTitle className="text-4xl font-bold tracking-tight text-zinc-50">
              Welcome back
            </CardTitle>

            <CardDescription className="mt-3 text-base text-zinc-300">
              Sign in to continue to your account.
            </CardDescription>
          </div>
        </CardHeader>

        {/* Form */}
        <CardContent className="px-6 pb-8 pt-6 sm:px-10 sm:pb-10">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
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
                  className="h-12 border-zinc-700 bg-zinc-950 pl-12 text-base text-zinc-100 placeholder:opacity-50"
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
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  maxLength={128}
                  className="h-12 border-zinc-700 bg-zinc-950 pl-12 pr-12 text-base text-zinc-100 placeholder:opacity-50"
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
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="h-12 w-full bg-zinc-100 text-base font-semibold text-zinc-950 transition-colors hover:bg-zinc-300"
            >
              {mutation.isPending
                ? "Logging in..."
                : "Sign in"}
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

            {/* Register */}
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/register")}
              className="h-12 w-full border-zinc-600 bg-transparent text-base font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
            >
              Create an account
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
