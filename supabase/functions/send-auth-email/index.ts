/**
 * send-auth-email — Multi-language authentication email Edge Function
 *
 * Triggered by Supabase Auth Hooks to send localized emails for:
 * - confirm_signup: Email verification for new accounts
 * - reset_password: Password reset requests
 * - magic_link: Passwordless login
 * - change_email: Email address change confirmation
 *
 * Language detection priority:
 * 1. User profile locale (profiles.locale)
 * 2. Accept-Language header
 * 3. Default: English
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getTemplate, detectLanguage } from "./email-templates.ts";

// Supabase client for fetching user metadata
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Email service configuration (using Resend)
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "NOOLY <noreply@nooly.app>";

interface AuthHookPayload {
  event: "confirm_signup" | "reset_password" | "magic_link" | "change_email";
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
  };
}

/**
 * Map Supabase auth events to email template types
 */
function mapEventToTemplateType(event: string): string {
  const mapping: Record<string, string> = {
    "confirm_signup": "confirm_signup",
    "reset_password": "reset_password",
    "magic_link": "magic_link",
    "change_email": "change_email",
  };
  return mapping[event] || "confirm_signup";
}

/**
 * Build confirmation URL from token
 */
function buildConfirmationUrl(
  event: string,
  tokenHash: string,
  redirectTo?: string
): string {
  const baseUrl = supabaseUrl.replace(".supabase.co", ".supabase.co/auth/v1");

  switch (event) {
    case "confirm_signup":
      return `${baseUrl}/verify?token=${tokenHash}&type=signup${redirectTo ? `&redirect_to=${encodeURIComponent(redirectTo)}` : ""}`;
    case "reset_password":
      return `${baseUrl}/verify?token=${tokenHash}&type=recovery${redirectTo ? `&redirect_to=${encodeURIComponent(redirectTo)}` : ""}`;
    case "magic_link":
      return `${baseUrl}/verify?token=${tokenHash}&type=magiclink${redirectTo ? `&redirect_to=${encodeURIComponent(redirectTo)}` : ""}`;
    case "change_email":
      return `${baseUrl}/verify?token=${tokenHash}&type=email_change${redirectTo ? `&redirect_to=${encodeURIComponent(redirectTo)}` : ""}`;
    default:
      return `${baseUrl}/verify?token=${tokenHash}`;
  }
}

/**
 * Fetch user locale from profiles table
 */
async function getUserLocale(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn(`Failed to fetch user locale: ${error.message}`);
      return null;
    }

    return data?.locale || null;
  } catch (err) {
    console.error("Error fetching user locale:", err);
    return null;
  }
}

/**
 * Send email using Resend API
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Resend API error: ${response.status} ${errorData}`);
      return false;
    }

    const result = await response.json();
    console.log(`Email sent successfully: ${result.id}`);
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Parse webhook payload
    const payload: AuthHookPayload = await req.json();
    const { event, user, email_data } = payload;

    console.log(`[send-auth-email] Event: ${event}, User: ${user.email}`);

    // Validate required data
    if (!email_data?.token_hash) {
      console.error("Missing token_hash in email_data");
      return new Response(
        JSON.stringify({ error: "Missing token_hash" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 1: Fetch user locale from database
    const dbLocale = await getUserLocale(user.id);

    // Step 2: Detect language (priority: db locale > Accept-Language > default)
    const userMetadata = user.user_metadata || {};
    if (dbLocale) {
      userMetadata.locale = dbLocale;
    }
    const language = detectLanguage(req.headers, userMetadata);

    console.log(`Detected language: ${language} (db: ${dbLocale}, header: ${req.headers.get("accept-language")})`);

    // Step 3: Build confirmation URL
    const confirmationUrl = buildConfirmationUrl(
      event,
      email_data.token_hash,
      email_data.redirect_to
    );

    // Step 4: Get email template
    const templateType = mapEventToTemplateType(event);
    const template = getTemplate(templateType, language, confirmationUrl);

    if (!template) {
      console.error(`Template not found: ${templateType} (${language})`);
      return new Response(
        JSON.stringify({ error: "Template not found" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 5: Send email
    const success = await sendEmail(user.email, template.subject, template.html);

    if (!success) {
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        language,
        event,
        to: user.email,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
