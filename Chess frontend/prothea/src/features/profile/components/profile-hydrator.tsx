"use client"

import { useCurrentUser } from "../hooks/use-current-user"

export function ProfileHydrator() {
    useCurrentUser()

    return null
}
