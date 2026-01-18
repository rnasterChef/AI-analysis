import { supabase } from "./supabase.js";

function authError(message) {
  const err = new Error(message);
  err.status = 401;
  return err;
}

export async function getUserFromAuthHeader(authHeader) {
  if (!authHeader) {
    throw authError("Authorization header missing");
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw authError("Authorization header must be a Bearer token");
  }
  const token = match[1].trim();
  if (!token) {
    throw authError("Authorization token missing");
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    throw authError("Invalid or expired token");
  }

  return data.user;
}
