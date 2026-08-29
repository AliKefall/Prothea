import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../auth-store";
import { logout } from "../api/auth.service";
import { websocketManager } from "@/lib/websocket";

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      websocketManager.disconnect();
      clearSession();
    },
    onError: () => {
        websocketManager.disconnect();
        clearSession();
    }
  });
}
