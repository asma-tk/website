const yearNode = document.getElementById("year");
const wsStatusNode = document.getElementById("ws-status");
const form = document.getElementById("contact-form");
const feedbackNode = document.getElementById("form-feedback");
const emailJsConfig = window.EMAILJS_CONFIG || {};
const submitButton = form?.querySelector('button[type="submit"], input[type="submit"]');

yearNode.textContent = new Date().getFullYear();

if (emailJsConfig.enabled && window.emailjs?.init) {
  window.emailjs.init({
    publicKey: emailJsConfig.publicKey,
  });
}

// WebSocket connection disabled (live status section removed)
// let wsRetryCount = 0;
// const maxWsRetries = 5;

// function connectWebSocket() {
//   const protocol = window.location.protocol === "https:" ? "wss" : "ws";
//   const wsUrl = `${protocol}://${window.location.host}`;
//   const socket = new WebSocket(wsUrl);
//   ...
// }

// connectWebSocket();

const revealNodes = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 }
  );

  revealNodes.forEach((node) => observer.observe(node));
} else {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
}

function setFeedback(message, type) {
  feedbackNode.textContent = message;
  feedbackNode.classList.remove("success", "error");
  if (type) {
    feedbackNode.classList.add(type);
  }
}

async function parseResponseSafely(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return { error: text || "Réponse serveur invalide." };
}

function isEmailJsReady() {
  return Boolean(
    emailJsConfig.enabled &&
      emailJsConfig.publicKey &&
      emailJsConfig.templateId &&
      window.emailjs?.send
  );
}

function buildEmailJsError(label, error) {
  const details = [error?.status ? `status ${error.status}` : null, error?.text, error?.message]
    .filter(Boolean)
    .join(" - ");
  return `${label}: ${details || "Erreur EmailJS inconnue."}`;
}

async function sendWithEmailJs(payload) {
  let toEmailInput = form.querySelector('input[name="to_email"]');
  if (!toEmailInput) {
    toEmailInput = document.createElement("input");
    toEmailInput.type = "hidden";
    toEmailInput.name = "to_email";
    form.appendChild(toEmailInput);
  }

  const serviceCandidates = [emailJsConfig.serviceId, "default_service"].filter(Boolean);
  const uniqueServiceIds = [...new Set(serviceCandidates)];

  const sendTemplate = async (templateId, toEmail, label) => {
    toEmailInput.value = toEmail;
    const failures = [];

    for (const serviceId of uniqueServiceIds) {
      try {
        await window.emailjs.sendForm(serviceId, templateId, form);
        console.log(`✅ EmailJS: ${label} (service: ${serviceId})`);
        return;
      } catch (error) {
        console.error(`❌ EmailJS ${label} (service: ${serviceId})`, error);
        failures.push(buildEmailJsError(`${label} via ${serviceId}`, error));
      }
    }

    throw new Error(failures.join(" | "));
  };

  await sendTemplate(emailJsConfig.templateId, "macon.novaa@gmail.com", "Mail ma9onNova");

  if (!emailJsConfig.templateIdClient) {
    return;
  }

  await sendTemplate(emailJsConfig.templateIdClient, payload.email, "Mail client");
}

async function sendWithBackend(payload, signal) {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const result = await parseResponseSafely(response);

  if (!response.ok) {
    const message = Array.isArray(result.errors)
      ? result.errors.join(" ")
      : result.error || "Impossible d'envoyer la demande.";
    throw new Error(message);
  }

  return result;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (window.location.protocol === "file:") {
    setFeedback(
      "Le formulaire ne fonctionne pas en ouverture directe du fichier. Lancez le serveur puis ouvrez http://localhost:3000.",
      "error"
    );
    return;
  }

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  setFeedback("Envoi en cours...", null);
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    if (isEmailJsReady()) {
      await sendWithEmailJs(payload);
    } else {
      await sendWithBackend(payload, controller.signal);
    }
    clearTimeout(timeoutId);

    setFeedback("Merci ! Votre demande de devis a bien été envoyée.", "success");
    form.reset();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Erreur formulaire", error);

    if (error?.name === "AbortError") {
      setFeedback("Délai dépassé. Vérifiez la connexion et réessayez.", "error");
      return;
    }

    setFeedback(error?.message || "Serveur indisponible. Rechargez la page et réessayez.", "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Envoyer la demande";
    }
  }
});