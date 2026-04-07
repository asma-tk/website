from app.validation import validate_contact_payload, validate_email


def test_validate_email_accepts_valid_address() -> None:
    assert validate_email("client@example.com") is True


def test_validate_email_rejects_invalid_address() -> None:
    assert validate_email("client.example.com") is False


def test_validate_contact_payload_accepts_valid_payload() -> None:
    result = validate_contact_payload(
        {
            "nom": "Karim",
            "email": "karim@example.com",
            "message": "Bonjour, je souhaite un devis pour une extension.",
        }
    )
    assert result["is_valid"] is True
    assert result["errors"] == []


def test_validate_contact_payload_rejects_invalid_payload() -> None:
    result = validate_contact_payload({"nom": "A", "email": "karim", "message": "court"})
    assert result["is_valid"] is False
    assert len(result["errors"]) >= 2