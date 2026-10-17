export type AuthMailTemplate = {
  subject: string;
  text: string;
  html: string;
};

export function verifyEmailTemplate(input: {
  verifyUrl: string;
  locale: "fr" | "en";
}): AuthMailTemplate {
  if (input.locale === "en") {
    return {
      subject: "Verify your Discelyn email",
      text: `Confirm your email by opening this link (valid 24h):\n\n${input.verifyUrl}\n\nIf you did not create a Discelyn account, ignore this message.`,
      html: `<p>Confirm your email by opening this link (valid 24h):</p><p><a href="${input.verifyUrl}">${input.verifyUrl}</a></p><p>If you did not create a Discelyn account, ignore this message.</p>`,
    };
  }
  return {
    subject: "Vérifie ton e-mail Discelyn",
    text: `Confirme ton e-mail en ouvrant ce lien (valide 24 h) :\n\n${input.verifyUrl}\n\nSi tu n’as pas créé de compte Discelyn, ignore ce message.`,
    html: `<p>Confirme ton e-mail en ouvrant ce lien (valide 24&nbsp;h)&nbsp;:</p><p><a href="${input.verifyUrl}">${input.verifyUrl}</a></p><p>Si tu n’as pas créé de compte Discelyn, ignore ce message.</p>`,
  };
}

export function resetPasswordTemplate(input: {
  resetUrl: string;
  locale: "fr" | "en";
}): AuthMailTemplate {
  if (input.locale === "en") {
    return {
      subject: "Reset your Discelyn password",
      text: `Reset your password with this link (valid 1h):\n\n${input.resetUrl}\n\nIf you did not request a reset, ignore this message.`,
      html: `<p>Reset your password with this link (valid 1h):</p><p><a href="${input.resetUrl}">${input.resetUrl}</a></p><p>If you did not request a reset, ignore this message.</p>`,
    };
  }
  return {
    subject: "Réinitialise ton mot de passe Discelyn",
    text: `Réinitialise ton mot de passe avec ce lien (valide 1 h) :\n\n${input.resetUrl}\n\nSi tu n’as pas demandé de reset, ignore ce message.`,
    html: `<p>Réinitialise ton mot de passe avec ce lien (valide 1&nbsp;h)&nbsp;:</p><p><a href="${input.resetUrl}">${input.resetUrl}</a></p><p>Si tu n’as pas demandé de reset, ignore ce message.</p>`,
  };
}
