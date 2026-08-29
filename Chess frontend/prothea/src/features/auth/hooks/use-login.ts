import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../auth-store";
import { websocketManager } from "@/lib/websocket";
import { login } from "../api/auth.service";

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data.access_token, data.user);
      websocketManager.connect(data.access_token);
    },
  });
}
