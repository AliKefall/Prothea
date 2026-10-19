"use client";

interface Props {
  message?: string;
}

export function FormError({ message }: Props) {
  if (!message) return null;

  return <p role="alert" aria-live="polite" className="text-sm text-red-400">{message}</p>;
}
