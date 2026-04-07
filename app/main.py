import asyncio
import logging
import os
import smtplib
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pydantic import BaseModel, Field

from app.validation import validate_contact_payload


load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


DEFAULT_CONTACT_TO = "macon.novaa@gmail.com"


class ContactPayload(BaseModel):
    nom: str = Field(min_length=2)
    email: str
    telephone: str | None = None
    message: str = Field(min_length=10)


app = FastAPI(title="MaçoNova Bâtiment API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_clients: set[WebSocket] = set()
status_task: asyncio.Task | None = None


async def broadcast(payload: dict) -> None:
    disconnected = []
    for client in connected_clients:
        try:
            await client.send_json(payload)
        except Exception:
            disconnected.append(client)
    for client in disconnected:
        connected_clients.discard(client)


def send_email(payload: ContactPayload) -> None:
    to_address = os.getenv("CONTACT_TO", DEFAULT_CONTACT_TO)
    from_address = os.getenv("CONTACT_FROM", os.getenv("SMTP_USER", DEFAULT_CONTACT_TO))

    message = EmailMessage()
    message["Subject"] = f"Nouvelle demande de devis - {payload.nom}"
    message["From"] = from_address
    message["To"] = to_address
    message.set_content(
        "\n".join(
            [
                "Nouvelle demande de devis depuis le site MaçoNova.",
                "",
                f"Nom: {payload.nom}",
                f"Email: {payload.email}",
                f"Téléphone: {payload.telephone or 'Non renseigné'}",
                "",
                "Message:",
                payload.message,
            ]
        )
    )

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    smtp_secure = os.getenv("SMTP_SECURE", "false").lower() == "true"

    # Mode sandbox: log l'email sans le envoyer réellement
    if not smtp_host or not smtp_user or not smtp_pass:
        logger.info(
            f"🔐 MODE SANDBOX (pas de SMTP configuré)\n"
            f"📧 Email vers: {to_address}\n"
            f"📝 Sujet: {message['Subject']}\n"
            f"✉️  Message:\n{message.get_payload()}"
        )
        return

    # Mode production: envoi réel via SMTP
    try:
        if smtp_secure:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(message)
        logger.info(f"✅ Email envoyé avec succès à {to_address}")
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"❌ Erreur d'authentification SMTP: {e}")
        raise RuntimeError("Identifiants SMTP invalides. Vérifiez SMTP_USER et SMTP_PASS.")
    except smtplib.SMTPException as e:
        logger.error(f"❌ Erreur SMTP: {e}")
        raise RuntimeError(f"Erreur lors de l'envoi: {str(e)}")


async def periodic_status() -> None:
    while True:
        await asyncio.sleep(20)
        await broadcast(
            {
                "type": "site_status",
                "payload": {
                    "text": "Équipe disponible pour vos chantiers cette semaine.",
                    "updatedAt": datetime.utcnow().isoformat() + "Z",
                },
            }
        )


@app.on_event("startup")
async def on_startup() -> None:
    global status_task
    status_task = asyncio.create_task(periodic_status())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if status_task:
        status_task.cancel()


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "service": "maconova-site", "now": datetime.utcnow().isoformat() + "Z"}


@app.post("/api/contact")
async def contact(payload: ContactPayload):
    validation = validate_contact_payload(payload.model_dump())
    if not validation["is_valid"]:
        return JSONResponse(status_code=400, content={"ok": False, "errors": validation["errors"]})

    try:
        send_email(payload)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": "Envoi email échoué. Vérifiez la configuration SMTP.",
                "details": str(exc),
            },
        )

    await broadcast(
        {
            "type": "new_quote_request",
            "payload": {
                "nom": payload.nom,
                "email": payload.email,
                "receivedAt": datetime.utcnow().isoformat() + "Z",
            },
        }
    )

    return {"ok": True, "message": "Demande envoyée avec succès."}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)

    await websocket.send_json(
        {
            "type": "welcome",
            "payload": {
                "message": "Connexion WebSocket active.",
                "connectedAt": datetime.utcnow().isoformat() + "Z",
            },
        }
    )

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.discard(websocket)


public_candidates = [
    Path("public"),
    Path(__file__).resolve().parent / "public",
    Path(__file__).resolve().parent.parent / "public",
]

public_dir = next((path for path in public_candidates if path.is_dir()), None)

if public_dir:
    app.mount("/", StaticFiles(directory=str(public_dir), html=True), name="static")
else:
    logger.warning("Dossier static introuvable; montage '/' ignoré")