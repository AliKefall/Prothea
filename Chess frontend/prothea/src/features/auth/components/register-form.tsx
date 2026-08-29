"use client";

import { z } from "zod";
import { useRouter } from "next/navigation";
import { registerSchema } from "../schemas/register-schema";
import { useRegister } from "../hooks/use-register";

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
  LockClosedIcon,
  EnvelopeIcon,
  UserIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";

type FormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const mutation = useRegister();

  const form = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

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
        <CardHeader className="space-y-4 px-10 pt-8 text-center">
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

        <CardContent className="px-10 pb-10 pt-6">
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
                  type="password"
                  placeholder="Create a password"
                  autoComplete="new-password"
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
              className="h-12 w-full bg-zinc-100 text-base font-semibold text-zinc-950 transition hover:bg-zinc-300"
            >
              {mutation.isPending
                ? "Creating account..."
                : "Create account"}
            </Button>

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
