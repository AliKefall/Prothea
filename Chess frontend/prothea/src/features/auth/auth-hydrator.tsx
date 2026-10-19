"use client";

import { useEffect } from "react";
import { refreshSession } from "@/lib/http";
import { useAuthStore } from "./auth-store";

export function AuthHydrator() {
    const hydrate = useAuthStore((state) => state.hydrate);

    useEffect(() => {
        hydrate();
        if (useAuthStore.getState().user) {
            void refreshSession()
                .then(({ access_token, user }) => {
                    useAuthStore.getState().setSession(access_token, user);
                })
                .catch(() => {
                    useAuthStore.getState().clearSession();
                });
        }
    }, [hydrate]);

    return null
}
