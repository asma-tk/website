const nodemailer = require("nodemailer");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(body),
  };
}

function validatePayload(payload) {
  const { nom, email, message } = payload || {};
  const errors = [];

  if (!nom || nom.length < 2) {
    errors.push("Le nom est requis (min 2 caractères).");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Email invalide.");
  }

  if (!message || message.length < 10) {
    errors.push("Le message est requis (min 10 caractères).");
  }

  return errors;
}

function getTransport() {
  const brevoUser = process.env.BREVO_SMTP_USER || process.env.SMTP_USER;
  const brevoPass = process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;

  if (brevoUser && brevoPass) {
    return {
      transporter: nodemailer.createTransport({
        host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
        port: Number(process.env.BREVO_SMTP_PORT || 587),
        secure: (process.env.BREVO_SMTP_SECURE || "false") === "true",
        auth: {
          user: brevoUser,
          pass: brevoPass,
        },
      }),
      fromAddress: process.env.CONTACT_FROM || brevoUser,
      provider: "brevo",
    };
  }

  if (gmailUser && gmailPass) {
    return {
      transporter: nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      }),
      fromAddress: process.env.CONTACT_FROM || gmailUser,
      provider: "gmail",
    };
  }

  return {
    transporter: null,
    fromAddress: process.env.CONTACT_FROM || "no-reply@maconova.local",
    provider: "sandbox",
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return json(200, { ok: true });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method Not Allowed" });
    }

    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Corps JSON invalide." });
    }

    const errors = validatePayload(payload);
    if (errors.length > 0) {
      return json(400, { ok: false, errors });
    }

    const { nom, email, telephone, message } = payload;
    const toAddress = process.env.CONTACT_TO || "macon.novaa@gmail.com";
    const { transporter, fromAddress, provider } = getTransport();

    const mailOptions = {
      from: fromAddress,
      to: toAddress,
      subject: `Nouvelle demande de devis - ${nom}`,
      text: [
        "Nouvelle demande de devis depuis le site ma9onNova.",
        "",
        `Nom: ${nom}`,
        `Email: ${email}`,
        `Téléphone: ${telephone || "Non renseigné"}`,
        "",
        "Message:",
        message,
      ].join("\n"),
    };

    if (!transporter) {
      console.log("🔐 MODE SANDBOX - pas de SMTP configuré");
      console.log(`📧 Email vers: ${toAddress}`);
      console.log(`📝 Sujet: ${mailOptions.subject}`);
      return json(200, {
        ok: true,
        message: "Demande reçue (mode sandbox - pas d'envoi réel).",
      });
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email envoyé via ${provider}: ${info.response || info.messageId}`);
      return json(200, {
        ok: true,
        message: "Demande envoyée avec succès.",
      });
    } catch (error) {
      console.error(`❌ Erreur d'envoi email: ${error.message}`);
      return json(500, {
        ok: false,
        error: "Envoi email échoué.",
        details: error.message,
      });
    }
  } catch (error) {
    console.error("❌ Crash netlify function contact:", error);
    return json(500, {
      ok: false,
      error: "Erreur interne serveur.",
      details: error?.message || "Unknown error",
    });
  }
};
