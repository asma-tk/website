import re


EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_email(value: str) -> bool:
    if not isinstance(value, str):
        return False
    return bool(EMAIL_REGEX.match(value.strip()))


def validate_contact_payload(payload: dict) -> dict:
    errors = []

    if not isinstance(payload, dict):
        return {"is_valid": False, "errors": ["Payload invalide."]}

    if len(str(payload.get("nom", "")).strip()) < 2:
        errors.append("Le nom est requis (min 2 caractères).")

    if not validate_email(str(payload.get("email", ""))):
        errors.append("Email invalide.")

    if len(str(payload.get("message", "")).strip()) < 10:
        errors.append("Le message est requis (min 10 caractères).")

    return {"is_valid": len(errors) == 0, "errors": errors}