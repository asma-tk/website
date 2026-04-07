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
  let nodemailer = null;
  try {
    nodemailer = require("nodemailer");
  } catch (error) {
    console.error("❌ nodemailer introuvable:", error.message);
    return {
      transporter: null,
      fromAddress: process.env.CONTACT_FROM || "no-reply@maconova.local",
      provider: "sandbox",
    };
  }

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
      fromAddress:
        process.env.CONTACT_FROM ||
        brevoUser,
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
      fromAddress:
        process.env.CONTACT_FROM ||
        gmailUser,
      provider: "gmail",
    };
  }

  return {
    transporter: null,
    fromAddress: process.env.CONTACT_FROM || "no-reply@maconova.local",
    provider: "sandbox",
  };
}

function normalizePayload(body) {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  if (typeof body === "object") {
    return body;
  }

  return {};
}

const handler = async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const payload = normalizePayload(req.body);
    const errors = validatePayload(payload);

    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
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

      return res.status(200).json({
        ok: true,
        message: "Demande reçue (mode sandbox - pas d'envoi réel).",
      });
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email envoyé via ${provider}: ${info.response || info.messageId}`);

      return res.status(200).json({
        ok: true,
        message: "Demande envoyée avec succès.",
      });
    } catch (error) {
      console.error(`❌ Erreur d'envoi email: ${error.message}`);
      return res.status(500).json({
        ok: false,
        error: "Envoi email échoué.",
        details: error.message,
      });
    }
  } catch (error) {
    console.error("❌ Crash api/contact:", error);
    return res.status(500).json({
      ok: false,
      error: "Erreur interne serveur.",
      details: error?.message || "Unknown error",
    });
  }
};

module.exports = handler;
module.exports.default = handler;
