# send-auth-email — Multi-language Auth Email Edge Function

Sends localized authentication emails in Spanish and English based on user language preferences.

## Features

- **Auto-detects language** from:
  1. User profile (`profiles.locale`)
  2. `Accept-Language` header
  3. Defaults to English

- **Supports 4 auth events:**
  - `confirm_signup` — Email verification for new accounts
  - `reset_password` — Password reset requests
  - `magic_link` — Passwordless login
  - `change_email` — Email address change confirmation

- **NOOLY branded templates** with purple gradient design

## Deployment

### 1. Deploy the Edge Function

```bash
npx supabase functions deploy send-auth-email
```

### 2. Set environment variables

```bash
# Resend API key (get from https://resend.com/api-keys)
npx supabase secrets set RESEND_API_KEY=re_xxxxxxxxx

# Optional: Custom from email (default: NOOLY <noreply@nooly.app>)
npx supabase secrets set FROM_EMAIL="NOOLY <hello@yourdomain.com>"
```

### 3. Configure Auth Hooks in Supabase Dashboard

Go to **Authentication > Hooks** in your Supabase Dashboard and configure:

#### Send Email Hook

- **Enabled:** ✓
- **Hook:** `Send Email`
- **Method:** `POST`
- **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-auth-email`
- **HTTP Headers:**
  ```json
  {
    "Authorization": "Bearer YOUR_ANON_KEY"
  }
  ```

#### Auth Events to Enable

Create separate hooks for each event:

1. **Confirm Signup** (`user.confirmation.send`)
2. **Password Recovery** (`user.recovery.send`)
3. **Magic Link** (`user.magiclink.send`)
4. **Email Change** (`user.email_change.send`)

All pointing to the same Edge Function URL.

### 4. Disable default Supabase emails

Go to **Authentication > Email Templates** and disable the default templates once the Edge Function is working:

- Uncheck "Enable Email Confirmations"
- Uncheck "Enable Password Recovery"
- Keep custom templates as backup

## Testing

### Local testing

```bash
npx supabase functions serve send-auth-email --no-verify-jwt
```

### Test with curl

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-auth-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "confirm_signup",
    "user": {
      "id": "test-user-id",
      "email": "test@example.com",
      "user_metadata": {
        "locale": "es"
      }
    },
    "email_data": {
      "token_hash": "test-token-hash",
      "redirect_to": "https://yourapp.com/dashboard"
    }
  }'
```

### Verify email was sent

Check Resend dashboard: https://resend.com/emails

## Adding more languages

1. Open `email-templates.ts`
2. Add new language code to `Templates` interface
3. Create templates object with all 4 event types
4. Update `getTemplate()` to support new language code
5. Redeploy function

Example for Portuguese:

```typescript
pt: {
  confirm_signup: {
    subject: "Bem-vindo ao NOOLY ✨",
    html: wrapEmailHtml(`...`),
  },
  // ... other events
}
```

## Monitoring

Check Edge Function logs:

```bash
npx supabase functions logs send-auth-email
```

Look for:
- `[send-auth-email] Event: ...` — Incoming requests
- `Detected language: ...` — Language detection results
- `Email sent successfully: ...` — Resend confirmation
- Any error messages

## Troubleshooting

**Emails not sending:**
- Verify `RESEND_API_KEY` is set correctly
- Check Resend API limits and domain verification
- Review Edge Function logs for errors

**Wrong language:**
- Check `profiles.locale` is set correctly for user
- Verify `Accept-Language` header in requests
- Default fallback is always English

**Auth hooks not triggering:**
- Verify hooks are enabled in Supabase Dashboard
- Check hook URL matches your project ref
- Ensure Authorization header is set with anon key

## Architecture

```
User signs up
    ↓
Supabase Auth triggers hook
    ↓
send-auth-email Edge Function
    ↓
1. Fetch user locale from profiles table
2. Detect language (profile > header > default)
3. Build confirmation URL
4. Get localized template
5. Send via Resend API
    ↓
User receives email in their language
```

## Security

- Uses `SUPABASE_SERVICE_ROLE_KEY` (auto-injected) to read profiles
- Validates token_hash presence before sending
- CORS restricted to Supabase auth domain
- API keys stored as encrypted secrets

---

Built for NOOLY — Plan smarter. Together.
