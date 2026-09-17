import { http } from "@/lib/http";
import { CurrentUserProfile } from "../types/profile-types";

export async function getCurrentUser(): Promise<CurrentUserProfile> {
  const response = await http.get<CurrentUserProfile>("/profile");

  return response.data;
}
