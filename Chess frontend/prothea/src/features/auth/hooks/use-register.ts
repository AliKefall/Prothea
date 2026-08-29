import { useMutation } from "@tanstack/react-query";
import { register } from "../api/auth.service";

export function useRegister() {
  return useMutation({
    mutationFn: register
  });
}
