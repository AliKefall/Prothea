import { http } from "@/lib/http";
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from "./auth.types";

export async function register(
  payload: RegisterRequest,
): Promise<RegisterResponse> {
  const response = await http.post<RegisterResponse>("/auth/register", payload);

  return response.data;
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await http.post<LoginResponse>("/auth/login", payload);

  return response.data;
}

export async function logout(): Promise<{message: string}> {
    const response = await http.post("/auth/logout");

    return response.data
}
