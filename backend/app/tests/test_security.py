from app.security import CredentialCipher, mask_secret, redact_secrets


def test_mask_secret_keeps_edges_only():
    assert mask_secret("TESTKEY-1234567890abcdef").startswith("TEST")
    assert "1234567890" not in mask_secret("TESTKEY-1234567890abcdef")


def test_redact_secrets_recursive():
    payload = {"api_key": "abc123456789", "nested": {"password": "secret", "safe": "ok"}}
    redacted = redact_secrets(payload)
    assert redacted["api_key"] != payload["api_key"]
    assert redacted["nested"]["password"] != "secret"
    assert redacted["nested"]["safe"] == "ok"


def test_cipher_roundtrip():
    cipher = CredentialCipher("unit-test-secret")
    token = cipher.encrypt("TESTKEY-abc")
    assert token != "TESTKEY-abc"
    assert cipher.decrypt(token) == "TESTKEY-abc"
