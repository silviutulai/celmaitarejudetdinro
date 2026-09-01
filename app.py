"""
Cel mai tare judet din Romania - server FastAPI.

Ruleaza local:
    uvicorn app:app --reload

Pe Render, foloseste Procfile-ul din acest repo.

Pagini:
  /        - afisajul jocului (format 9:16, harta + top 5 sustinatori),
             curat, fara butoane - asta e pagina pe care o filmezi.
  /admin   - panou de control + clasament complet, protejat cu parola
             din variabila de mediu ADMIN_PASSWORD.
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
from connection_manager import MANAGER
from game_state import STATE
from tiktok_bridge import BRIDGE
from scoring import process_comment, process_gift, rarity_for, MAX_COMMENTS_PER_USER

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


class ManualCommentPayload(BaseModel):
    text: str
    user: str = "test_user"


class ManualGiftPayload(BaseModel):
    value: int          # valoare bruta simulata, in "diamante"
    user: str = "test_user"
    county: str = ""     # daca e gol, cadoul e pus "in asteptare" (test flow)
    gift_name: str = "Cadou de test"


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
    data = STATE.snapshot()
    data["counties_ranked"] = [
        {"id": c.id, "code": c.code, "title": c.title, "score": c.score}
        for c in STATE.leaderboard(42)
    ]
    data["top_supporters"] = [
        {"name": s.name, "points": s.points} for s in STATE.top_supporters(20)
    ]
    data["pending_gifts_count"] = len(STATE.pending_gift_by_user)
    return JSONResponse(data)


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


@app.post("/api/manual-comment")
async def manual_comment(payload: ManualCommentPayload, _: bool = Depends(require_admin)):
    """
    Mod test: simuleaza un comentariu (respecta plafonul de
    MAX_COMMENTS_PER_USER si rezolva orice cadou pus 'in asteptare'
    pentru acest user de test).
    """
    user_id = f"test:{payload.user.strip() or 'test_user'}"
    result = process_comment(user_id, payload.user.strip() or "test_user", payload.text)
    if not result["hit"] and not result["gift"]:
        return JSONResponse({"ok": False, "message": "Județ necunoscut."}, status_code=404)
    if result["hit"]:
        await MANAGER.broadcast(result["hit"])
    if result["gift"]:
        await MANAGER.broadcast(result["gift"])
    return {"ok": True, "resolved_pending_gift": result["gift"] is not None}


@app.post("/api/manual-gift")
async def manual_gift(payload: ManualGiftPayload, _: bool = Depends(require_admin)):
    """
    Mod test: simuleaza un cadou.
    - daca 'county' e completat, il aplica direct pe acel judet (test
      rapid al animatiei, indiferent de istoricul userului).
    - daca 'county' e gol, simuleaza cazul real "a dat cadou fara sa
      scrie inainte judetul" - cadoul ramane 'in asteptare' pentru
      user-ul de test pana la urmatorul lui comentariu valid.
    """
    user_label = payload.user.strip() or "test_user"
    user_id = f"test:{user_label}"
    raw_value = max(payload.value, 1)

    if payload.county.strip():
        from counties import find_county
        county = find_county(payload.county)
        if not county:
            return JSONResponse({"ok": False, "message": "Județ necunoscut."}, status_code=404)
        STATE.last_county_by_user[user_id] = county["id"]

    gift_event = process_gift(user_id, user_label, raw_value, payload.gift_name)
    if gift_event:
        await MANAGER.broadcast(gift_event)
        return {"ok": True, "pending": False}

    return {"ok": True, "pending": True, "message": f"Cadou pus în așteptare pentru {user_label}."}


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
