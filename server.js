require("dotenv").config();
const http = require("http");
const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Configuration email
let transporter = null;
let mailProvider = "sandbox";

const brevoUser = process.env.BREVO_SMTP_USER || process.env.SMTP_USER;
const brevoPass = process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS;
const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_PASS;

if (brevoUser && brevoPass) {
  transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
    port: Number(process.env.BREVO_SMTP_PORT || 587),
    secure: (process.env.BREVO_SMTP_SECURE || "false") === "true",
    auth: {
      user: brevoUser,
      pass: brevoPass,
    },
  });
  mailProvider = "brevo";
  console.log("✅ SMTP Brevo configuré");
} else if (gmailUser && gmailPass) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
  mailProvider = "gmail";
  console.log("✅ SMTP Gmail configuré");
} else {
  console.log("⚠️  SMTP non configuré - mode sandbox (logs uniquement)");
}

// Endpoint POST /api/contact
app.post("/api/contact", (req, res) => {
  const { nom, email, telephone, message } = req.body || {};

  // Validation
  const errors = [];
  if (!nom || nom.length < 2) errors.push("Le nom est requis (min 2 caractères).");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email invalide.");
  if (!message || message.length < 10) errors.push("Le message est requis (min 10 caractères).");

  if (errors.length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  const toAddress = process.env.CONTACT_TO || "macon.novaa@gmail.com";
  const fromAddress = process.env.CONTACT_FROM || brevoUser || gmailUser || "no-reply@maconova.local";

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

  // Mode sandbox: log uniquement
  if (!transporter) {
    console.log("\n🔐 MODE SANDBOX");
    console.log(`📧 Email vers: ${toAddress}`);
    console.log(`📝 Sujet: ${mailOptions.subject}`);
    console.log(`✉️  Contenu:\n${mailOptions.text}\n`);

    broadcastToClients({
      type: "new_quote_request",
      payload: { nom, email, receivedAt: new Date().toISOString() },
    });

    return res.status(200).json({
      ok: true,
      message: "Demande reçue (mode sandbox - pas d'envoi réel).",
    });
  }

  // Mode production: envoi réel
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.error(`❌ Erreur d'envoi email: ${error.message}`);
      return res.status(500).json({
        ok: false,
        error: "Envoi email échoué.",
        details: error.message,
      });
    } else {
      console.log(`✅ Email envoyé via ${mailProvider}: ${info.response}`);

      broadcastToClients({
        type: "new_quote_request",
        payload: { nom, email, receivedAt: new Date().toISOString() },
      });

      return res.status(200).json({
        ok: true,
        message: "Demande envoyée avec succès.",
      });
    }
  });
});

// Endpoint health check
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ma9onnova-site",
    now: new Date().toISOString(),
  });
});

// WebSocket
const wss = new WebSocketServer({ server });

function broadcastToClients(data) {
  const serialized = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(serialized);
    }
  }
}

wss.on("connection", (socket) => {
  console.log("✅ Client WebSocket connecté");
  socket.send(
    JSON.stringify({
      type: "welcome",
      payload: {
        message: "Connexion WebSocket active.",
        connectedAt: new Date().toISOString(),
      },
    })
  );

  socket.on("close", () => {
    console.log("❌ Client WebSocket déconnecté");
  });
});

// Diffusion status périodique
setInterval(() => {
  broadcastToClients({
    type: "site_status",
    payload: {
      text: "Équipe disponible pour vos chantiers cette semaine.",
      updatedAt: new Date().toISOString(),
    },
  });
}, 20000);

server.listen(PORT, () => {
  console.log(`\n✅ Serveur ma9onNova lancé sur http://localhost:${PORT}\n`);
});
