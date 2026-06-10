/**
 * Email templates in multiple languages
 * Supports: English (en), Spanish (es)
 */

export interface EmailTemplate {
  subject: string;
  html: string;
}

interface Templates {
  en: Record<string, EmailTemplate>;
  es: Record<string, EmailTemplate>;
}

const baseStyle = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f6f9fc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 48px 32px;
      text-align: center;
    }
    .logo {
      font-size: 36px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .hero {
      padding: 48px 32px 32px;
      text-align: center;
    }
    .hero-title {
      font-size: 28px;
      font-weight: 600;
      color: #1a202c;
      margin: 0 0 24px 0;
      line-height: 1.3;
    }
    .content {
      padding: 0 32px 32px;
    }
    .text {
      font-size: 16px;
      color: #4a5568;
      line-height: 1.6;
      margin: 0 0 16px 0;
    }
    .cta-container {
      text-align: center;
      margin: 40px 0;
    }
    .button {
      display: inline-block;
      padding: 16px 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
    .secondary-text {
      font-size: 14px;
      color: #718096;
      text-align: center;
      margin: 32px 0;
      line-height: 1.6;
    }
    .footer {
      background-color: #f7fafc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer-title {
      font-size: 16px;
      font-weight: 600;
      color: #2d3748;
      margin: 0 0 4px 0;
    }
    .footer-tagline {
      font-size: 14px;
      color: #718096;
      margin: 0 0 16px 0;
    }
    .footer-legal {
      font-size: 12px;
      color: #a0aec0;
      margin: 0;
    }
  </style>
`;

function wrapEmailHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  ${baseStyle}
</head>
<body>
  ${content}
</body>
</html>
  `;
}

export const templates: Templates = {
  // ============================================================================
  // ENGLISH TEMPLATES
  // ============================================================================
  en: {
    confirm_signup: {
      subject: "Welcome to NOOLY ✨",
      html: wrapEmailHtml(`
        <div class="email-container">
          <div class="header">
            <h1 class="logo">NOOLY</h1>
          </div>

          <div class="hero">
            <h2 class="hero-title">Your financial life starts here.</h2>
          </div>

          <div class="content">
            <p class="text">Hi there,</p>

            <p class="text">Thanks for joining NOOLY.</p>

            <p class="text">
              We created NOOLY to make money feel simpler, calmer and more human — whether you're saving for something important, managing shared plans or just trying to stay on top of your finances.
            </p>

            <p class="text">To activate your account, confirm your email below.</p>

            <div class="cta-container">
              <a href="{{CONFIRMATION_URL}}" class="button">Confirm email</a>
            </div>

            <div class="secondary-text">
              This link will expire in 24 hours.<br>
              If you didn't create an account, you can safely ignore this email.
            </div>
          </div>

          <div class="footer">
            <p class="footer-title">NOOLY</p>
            <p class="footer-tagline">Plan smarter. Together.</p>
            <p class="footer-legal">© 2026 NOOLY. All rights reserved.</p>
          </div>
        </div>
      `),
    },

    reset_password: {
      subject: "Reset your NOOLY password",
      html: wrapEmailHtml(`
        <div class="email-container">
          <div class="header">
            <h1 class="logo">NOOLY</h1>
          </div>

          <div class="hero">
            <h2 class="hero-title">Reset your password</h2>
          </div>

          <div class="content">
            <p class="text">Hi there,</p>

            <p class="text">
              We received a request to reset the password for your NOOLY account.
            </p>

            <p class="text">
              Click the button below to create a new password. If you didn't request this, you can safely ignore this email.
            </p>

            <div class="cta-container">
              <a href="{{CONFIRMATION_URL}}" class="button">Reset password</a>
            </div>

            <div class="secondary-text">
              This link will expire in 1 hour.<br>
              If you didn't request a password reset, no action is needed.
            </div>
          </div>

          <div class="footer">
            <p class="footer-title">NOOLY</p>
            <p class="footer-tagline">Plan smarter. Together.</p>
            <p class="footer-legal">© 2026 NOOLY. All rights reserved.</p>
          </div>
        </div>
      `),
    },

    magic_link: {
      subject: "Your NOOLY magic link",
      html: wrapEmailHtml(`
        <div class="email-container">
          <div class="header">
            <h1 class="logo">NOOLY</h1>
          </div>

          <div class="hero">
            <h2 class="hero-title">Your magic link is here</h2>
          </div>

          <div class="content">
            <p class="text">Hi there,</p>

            <p class="text">
              Click the button below to sign in to NOOLY. No password needed.
            </p>

            <div class="cta-container">
              <a href="{{CONFIRMATION_URL}}" class="button">Sign in to NOOLY</a>
            </div>

            <div class="secondary-text">
              This link will expire in 1 hour and can only be used once.<br>
              If you didn't request this, you can safely ignore this email.
            </div>
          </div>

          <div class="footer">
            <p class="footer-title">NOOLY</p>
            <p class="footer-tagline">Plan smarter. Together.</p>
            <p class="footer-legal">© 2026 NOOLY. All rights reserved.</p>
          </div>
        </div>
      `),
    },

    change_email: {
      subject: "Confirm your new email",
      html: wrapEmailHtml(`
        <div class="email-container">
          <div class="header">
            <h1 class="logo">NOOLY</h1>
          </div>

          <div class="hero">
            <h2 class="hero-title">Confirm your new email</h2>
          </div>

          <div class="content">
            <p class="text">Hi there,</p>

            <p class="text">
              We received a request to change your NOOLY account email address.
            </p>

            <p class="text">
              Click the button below to confirm your new email address.
            </p>

            <div class="cta-container">
              <a href="{{CONFIRMATION_URL}}" class="button">Confirm email change</a>
            </div>

            <div class="secondary-text">
              This link will expire in 24 hours.<br>
              If you didn't request this change, please contact support immediately.
            </div>
          </div>

          <div class="footer">
            <p class="footer-title">NOOLY</p>
            <p class="footer-tagline">Plan smarter. Together.</p>
            <p class="footer-legal">© 2026 NOOLY. All rights reserved.</p>
          </div>
        </div>
      `),
    },
  },

  // ============================================================================
  // SPANISH TEMPLATES
  // ============================================================================
  es: {
    confirm_signup: {
      subject: "Bienvenido a NOOLY ✨",
      html: wrapEmailHtml(`
        <div class="email-container">
          <div class="header">
            <h1 class="logo">NOOLY</h1>
          </div>

          <div class="hero">
            <h2 class="hero-title">Tu vida financiera empieza aquí.</h2>
          </div>

          <div class="content">
            <p class="text">Hola,</p>

            <p class="text">Gracias por unirte a NOOLY.</p>

            <p class="text">
              Creamos NOOLY para hacer que el dinero se sienta más simple, más tranquilo y más humano — ya sea que estés ahorrando para algo importante, gestionando planes compartidos o simplemente tratando de controlar tus finanzas.
            </p>

            <p class="text">Para activar tu cuenta, confirma tu email a continuación.</p>

            <div class="cta-container">
              <a href="{{CONFIRMATION_URL}}" class="button">Confirmar email</a>
            </div>

            <div class="secondary-text">
              Este enlace expirará en 24 horas.<br>
              Si no creaste una cuenta, puedes ignorar este email.
            </div>
          </div>

          <div class="footer">
            <p class="footer-title">NOOLY</p>
            <p class="footer-tagline">Planifica mejor. Juntos.</p>
            <p class="footer-legal">© 2026 NOOLY. Todos los derechos reservados.</p>
          </div>
        </div>
      `),
    },

    reset_password: {
      subject: "Restablece tu contraseña de NOOLY",
      html: wrapEmailHtml(`
        <div class="email-container">
          <div class="header">
            <h1 class="logo">NOOLY</h1>
          </div>

          <div class="hero">
            <h2 class="hero-title">Restablece tu contraseña</h2>
          </div>

          <div class="content">
            <p class="text">Hola,</p>

            <p class="text">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta NOOLY.
            </p>

            <p class="text">
              Haz clic en el botón a continuación para crear una nueva contraseña. Si no solicitaste esto, puedes ignorar este email.
            </p>

            <div class="cta-container">
              <a href="{{CONFIRMATION_URL}}" class="button">Restablecer contraseña</a>
            </div>

            <div class="secondary-text">
              Este enlace expirará en 1 hora.<br>
              Si no solicitaste restablecer tu contraseña, no necesitas hacer nada.
            </div>
          </div>

          <div class="footer">
            <p class="footer-title">NOOLY</p>
            <p class="footer-tagline">Planifica mejor. Juntos.</p>
            <p class="footer-legal">© 2026 NOOLY. Todos los derechos reservados.</p>
          </div>
        </div>
      `),
    },

    magic_link: {
      subject: "Tu enlace mágico de NOOLY",
      html: wrapEmailHtml(`
        <div class="email-container">
          <div class="header">
            <h1 class="logo">NOOLY</h1>
          </div>

          <div class="hero">
            <h2 class="hero-title">Tu enlace mágico está aquí</h2>
          </div>

          <div class="content">
            <p class="text">Hola,</p>

            <p class="text">
              Haz clic en el botón a continuación para iniciar sesión en NOOLY. No necesitas contraseña.
            </p>

            <div class="cta-container">
              <a href="{{CONFIRMATION_URL}}" class="button">Iniciar sesión en NOOLY</a>
            </div>

            <div class="secondary-text">
              Este enlace expirará en 1 hora y solo se puede usar una vez.<br>
              Si no solicitaste esto, puedes ignorar este email.
            </div>
          </div>

          <div class="footer">
            <p class="footer-title">NOOLY</p>
            <p class="footer-tagline">Planifica mejor. Juntos.</p>
            <p class="footer-legal">© 2026 NOOLY. Todos los derechos reservados.</p>
          </div>
        </div>
      `),
    },

    change_email: {
      subject: "Confirma tu nuevo email",
      html: wrapEmailHtml(`
        <div class="email-container">
          <div class="header">
            <h1 class="logo">NOOLY</h1>
          </div>

          <div class="hero">
            <h2 class="hero-title">Confirma tu nuevo email</h2>
          </div>

          <div class="content">
            <p class="text">Hola,</p>

            <p class="text">
              Recibimos una solicitud para cambiar la dirección de email de tu cuenta NOOLY.
            </p>

            <p class="text">
              Haz clic en el botón a continuación para confirmar tu nueva dirección de email.
            </p>

            <div class="cta-container">
              <a href="{{CONFIRMATION_URL}}" class="button">Confirmar cambio de email</a>
            </div>

            <div class="secondary-text">
              Este enlace expirará en 24 horas.<br>
              Si no solicitaste este cambio, contacta a soporte inmediatamente.
            </div>
          </div>

          <div class="footer">
            <p class="footer-title">NOOLY</p>
            <p class="footer-tagline">Planifica mejor. Juntos.</p>
            <p class="footer-legal">© 2026 NOOLY. Todos los derechos reservados.</p>
          </div>
        </div>
      `),
    },
  },
};

/**
 * Get email template for a specific type and language
 */
export function getTemplate(
  type: string,
  language: string,
  confirmationUrl: string
): EmailTemplate | null {
  const lang = (language === "es" || language.startsWith("es-")) ? "es" : "en";
  const template = templates[lang][type];

  if (!template) {
    console.error(`Template not found: ${type} (${lang})`);
    return null;
  }

  // Replace placeholder with actual URL
  return {
    subject: template.subject,
    html: template.html.replace(/\{\{CONFIRMATION_URL\}\}/g, confirmationUrl),
  };
}

/**
 * Detect language from various sources
 */
export function detectLanguage(
  headers: Headers,
  userMetadata?: Record<string, unknown>
): string {
  // 1. Check user metadata (if stored in profile)
  if (userMetadata?.locale && typeof userMetadata.locale === "string") {
    return userMetadata.locale;
  }

  // 2. Check Accept-Language header
  const acceptLanguage = headers.get("accept-language");
  if (acceptLanguage) {
    // Parse accept-language header (e.g., "es-ES,es;q=0.9,en;q=0.8")
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code, q] = lang.trim().split(";q=");
        return {
          code: code.split("-")[0], // Get base language (es from es-ES)
          quality: q ? parseFloat(q) : 1.0,
        };
      })
      .sort((a, b) => b.quality - a.quality);

    if (languages.length > 0) {
      return languages[0].code;
    }
  }

  // 3. Default to English
  return "en";
}
