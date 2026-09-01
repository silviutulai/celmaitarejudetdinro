"""
Autentificare simpla pentru pagina de admin (o singura parola, fara
cont de utilizator). Sesiunile traiesc in memorie - suficient pentru
un singur operator conectat de pe un dispozitiv sau doua.
"""
import os
import secrets
import time
from typing import Optional

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
SESSION_COOKIE = "admin_session"
SESSION_TTL_SECONDS = 12 * 3600  # 12 ore

_sessions: dict[str, float] = {}  # token -> timestamp de expirare


def is_configured() -> bool:
    """True daca s-a setat o parola de admin in variabilele de mediu."""
    return bool(ADMIN_PASSWORD)


def check_password(password: str) -> bool:
    if not ADMIN_PASSWORD:
        return False
    return secrets.compare_digest(password, ADMIN_PASSWORD)


def create_session() -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = time.time() + SESSION_TTL_SECONDS
    return token


def is_valid(token: Optional[str]) -> bool:
    if not token:
        return False
    expiry = _sessions.get(token)
    if expiry is None:
        return False
    if expiry < time.time():
        _sessions.pop(token, None)
        return False
    return True


def revoke(token: Optional[str]):
    if token:
        _sessions.pop(token, None)
