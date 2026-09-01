"""
Cel mai tare judet din Romania - server FastAPI.

Ruleaza local:
    uvicorn app:app --reload

Pe Render, foloseste Procfile-ul din acest repo.

Pagini:
  /        - afisajul jocului (harta + clasament), curat, fara butoane -
             asta e pagina pe care o filmezi.
  /admin   - panou de control (conectare TikTok, mod test, reset),
             protejat cu parola din variabila de mediu ADMIN_PASSWORD.
"""
import asyncio
import contextlib
import pathlib
from typing import Optional

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import auth
from counties import find_county
from connection_manager import MANAGER
from game_state import STATE
from tiktok_bridge import BRIDGE, MEGA_GIFT_THRESHOLD

BASE_DIR = pathlib.Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Cel mai tare judet din Romania")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

_save_task: Optional[asyncio.Task] = None


async def _periodic_save():
    """Salveaza scorurile pe disc la fiecare 4 secunde, daca s-au schimbat."""
    while True:
        await asyncio.sleep(4)
        STATE.save_to_disk()


@app.on_event("startup")
async def on_startup():
    global _save_task
    _save_task = asyncio.create_task(_periodic_save())


@app.on_event("shutdown")
async def on_shutdown():
    STATE.save_to_disk(force=True)
    if _save_task is not None:
        _save_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _save_task


async def require_admin(admin_session: Optional[str] = Cookie(default=None)):
    """Dependency FastAPI: protejeaza rutele de control ale jocului."""
    if not auth.is_valid(admin_session):
        raise HTTPException(status_code=401, detail="Neautorizat. Conecteaza-te din /admin.")
    return True


class ConnectPayload(BaseModel):
    username: str


class ManualHitPayload(BaseModel):
    text: str
    gift: bool = False
    value: int = 0  # valoare simulata in "diamante", doar pentru Mod test


class LoginPayload(BaseModel):
    password: str


# ==================== PAGINI ====================

@app.get("/", response_class=HTMLResponse)
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    return FileResponse(STATIC_DIR / "admin.html")


# ==================== AUTENTIFICARE ADMIN ====================

@app.get("/api/admin/check")
async def admin_check(admin_session: Optional[str] = Cookie(default=None)):
    return {"authenticated": auth.is_valid(admin_session), "configured": auth.is_configured()}


@app.post("/api/admin/login")
async def admin_login(payload: LoginPayload, response: Response):
    if not auth.is_configured():
        return JSONResponse(
            {"ok": False, "message": "Nu ai setat ADMIN_PASSWORD pe server (vezi README.md)."},
            status_code=500,
        )
    if not auth.check_password(payload.password):
        return JSONResponse({"ok": False, "message": "Parola gresita."}, status_code=401)
    token = auth.create_session()
    response.set_cookie(
        auth.SESSION_COOKIE, token,
        httponly=True, samesite="lax", max_age=auth.SESSION_TTL_SECONDS,
    )
    return {"ok": True}


@app.post("/api/admin/logout")
async def admin_logout(response: Response, admin_session: Optional[str] = Cookie(default=None)):
    auth.revoke(admin_session)
    response.delete_cookie(auth.SESSION_COOKIE)
    return {"ok": True}


# ==================== STATE (public, doar citire) ====================

@app.get("/api/state")
async def get_state():
    return JSONResponse(STATE.snapshot())


# ==================== CONTROL JOC (protejat) ====================

@app.post("/api/connect")
async def connect_tiktok(payload: ConnectPayload, _: bool = Depends(require_admin)):
    try:
        await BRIDGE.connect(payload.username)
        return {"ok": True, "message": f"Se conecteaza la @{payload.username.lstrip('@')}..."}
    except Exception as exc:
        return JSONResponse({"ok": False, "message": str(exc)}, status_code=400)


@app.post("/api/disconnect")
async def disconnect_tiktok(_: bool = Depends(require_admin)):
    await BRIDGE.disconnect()
    await MANAGER.broadcast({"event": "status", "connected": False, "message": "Deconectat."})
    return {"ok": True}


@app.post("/api/reset")
async def reset_game(_: bool = Depends(require_admin)):
    STATE.reset()
    await MANAGER.broadcast({"event": "reset", **STATE.snapshot()})
    return {"ok": True}


@app.post("/api/manual-hit")
async def manual_hit(payload: ManualHitPayload, _: bool = Depends(require_admin)):
    """
    Endpoint pentru 'Mod test' (din /admin): simuleaza un comentariu
    sau un cadou, inclusiv animatia mega la cadouri mari.
    """
    county = find_county(payload.text)
    if not county:
        return JSONResponse({"ok": False, "message": "Judet necunoscut."}, status_code=404)

    if payload.gift:
        gift_value = max(payload.value, 1)
        points = gift_value * 2
    else:
        gift_value = 0
        points = 1

    c = STATE.add_point(county["id"], points)
    is_mega = payload.gift and gift_value > MEGA_GIFT_THRESHOLD

    event = {
        "event": "mega_gift" if is_mega else ("gift" if payload.gift else "hit"),
        "county": c.code,
        "title": c.title,
        "score": c.score,
        "points": points,
        "value": gift_value,
        "gift": payload.gift,
        "user": "test_user",
    }
    if payload.gift:
        event["gift_name"] = "Cadou de test"
    await MANAGER.broadcast(event)
    return {"ok": True}


# ==================== WEBSOCKET (public, doar citire) ====================

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await MANAGER.connect(ws)
    await ws.send_json(STATE.snapshot())
    try:
        while True:
            # nu asteptam mesaje de la client, doar tinem conexiunea deschisa
            await ws.receive_text()
    except WebSocketDisconnect:
        await MANAGER.disconnect(ws)
