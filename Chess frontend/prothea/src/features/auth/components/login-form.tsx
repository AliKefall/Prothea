"use client";

import { z } from "zod";
import { useRouter } from "next/navigation";
import { useLogin } from "../hooks/use-login";
import { loginSchema } from "../schemas/login-schema";

import { useForm } from "react-hook-form";
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
  EnvelopeIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

type FormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const mutation = useLogin();

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
        <div className="absolute left-0 top-0 h-[600px] w-[600px] rounded-full bg-zinc-800/30 blur-3xl" />

        <div className="absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full bg-zinc-700/20 blur-3xl" />
      </div>

      {/* Login Card */}
      <Card className="relative z-10 w-full max-w-lg border-zinc-700 bg-zinc-900/90 py-4 shadow-2xl backdrop-blur">
        {/* Header */}
        <CardHeader className="space-y-4 px-10 pt-8 text-center">
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
        <CardContent className="px-10 pb-10 pt-6">
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
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-base font-medium text-zinc-200"
                >
                  Password
                </Label>

                <button
                  type="button"
                  className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <LockClosedIcon
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />

                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-12 border-zinc-700 bg-zinc-950 pl-12 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-500"
                  {...form.register("password")}
                />
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
