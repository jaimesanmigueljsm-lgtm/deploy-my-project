import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { parseOrThrow } from "@/schemas";
import { UpdateProfileSchema } from "@/schemas/profile.schema";

export type Profile = Tables<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProfile(
  userId: string,
  updates: ProfileUpdate,
): Promise<Profile> {
  const validated = parseOrThrow(UpdateProfileSchema, updates, "updateProfile");

  const { data, error } = await supabase
    .from("profiles")
    .update(validated)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
