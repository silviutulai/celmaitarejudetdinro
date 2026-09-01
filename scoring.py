"""
Logica de scor comuna, folosita atat de bridge-ul TikTok
(tiktok_bridge.py) cat si de modul test din /admin (app.py) - ca sa nu
duplicam regulile in doua locuri si sa se comporte identic.

Reguli:
  - un comentariu cu un judet valid = +1 punct pentru judet, +1 in
    clasamentul personal al utilizatorului. Maxim MAX_COMMENTS_PER_USER
    comentarii per utilizator sunt punctate (restul sunt ignorate ca
    scor, dar tot actualizeaza "ultimul judet" pentru atribuirea
    cadourilor).
  - un cadou = valoarea lui in diamante x2, adaugata la ultimul judet
    scris de utilizator. Daca utilizatorul n-a scris inca niciun judet,
    cadoul e pus "in asteptare" si se aplica automat, cu tot cu
    animatie, de indata ce utilizatorul scrie un judet valid.
  - fiecare cadou primeste o raritate (comun/rar/epic/legendar) in
    functie de valoarea bruta (inainte de x2).
"""
import os
from typing import Optional

from counties import find_county
from game_state import STATE

MAX_COMMENTS_PER_USER = int(os.getenv("MAX_COMMENTS_PER_USER", "10"))
RARE_THRESHOLD = int(os.getenv("RARE_THRESHOLD", "10"))
EPIC_THRESHOLD = int(os.getenv("EPIC_THRESHOLD", "30"))
MEGA_GIFT_THRESHOLD = int(os.getenv("MEGA_GIFT_THRESHOLD", "99"))  # = prag "legendar"


def rarity_for(raw_value: int) -> str:
    if raw_value > MEGA_GIFT_THRESHOLD:
        return "legendary"
    if raw_value >= EPIC_THRESHOLD:
        return "epic"
    if raw_value >= RARE_THRESHOLD:
        return "rare"
    return "common"


def _top_supporters_payload():
    return [{"name": s.name, "points": s.points} for s in STATE.top_supporters(5)]


def process_comment(user_id: str, user_label: str, text: str) -> dict:
    """
    Proceseaza un comentariu. Intoarce {"hit": <event|None>, "gift": <event|None>}.
    "gift" apare doar daca acest comentariu a rezolvat un cadou care
    astepta un judet.
    """
    result = {"hit": None, "gift": None}
    county = find_county(text)
    if not county:
        return result

    county_id = county["id"]
    STATE.last_county_by_user[user_id] = county_id

    count = STATE.comment_count_by_user.get(user_id, 0)
    if count < MAX_COMMENTS_PER_USER:
        STATE.comment_count_by_user[user_id] = count + 1
        c = STATE.add_point(county_id, 1)
        STATE.add_supporter_points(user_id, user_label, 1)
        if c is not None:
            result["hit"] = {
                "event": "hit",
                "county": c.code, "title": c.title, "score": c.score,
                "points": 1, "gift": False, "user": user_label,
                "top_supporters": _top_supporters_payload(),
            }

    pending = STATE.pending_gift_by_user.pop(user_id, None)
    if pending:
        gift_value = pending["value"]
        points = gift_value * 2
        rarity = rarity_for(gift_value)
        c = STATE.add_point(county_id, points)
        if c is not None:
            STATE.add_supporter_points(user_id, user_label, points)
            result["gift"] = {
                "event": "mega_gift" if rarity == "legendary" else "gift",
                "county": c.code, "title": c.title, "score": c.score,
                "points": points, "value": gift_value, "rarity": rarity,
                "user": user_label, "gift_name": pending.get("gift_name", "cadou"),
                "top_supporters": _top_supporters_payload(),
            }

    return result


def process_gift(user_id: str, user_label: str, raw_value: int, gift_name: str) -> Optional[dict]:
    """
    Proceseaza un cadou. Daca userul a scris deja un judet, il aplica
    imediat (x2) si intoarce evenimentul. Daca nu, il pune "in
    asteptare" (se rezolva la urmatorul comentariu valid) si intoarce
    None.
    """
    county_id = STATE.last_county_by_user.get(user_id)
    if not county_id:
        pending = STATE.pending_gift_by_user.get(user_id, {"value": 0, "gift_name": gift_name})
        pending["value"] += raw_value
        pending["gift_name"] = gift_name
        STATE.pending_gift_by_user[user_id] = pending
        return None

    points = raw_value * 2
    rarity = rarity_for(raw_value)
    c = STATE.add_point(county_id, points)
    if c is None:
        return None
    STATE.add_supporter_points(user_id, user_label, points)
    return {
        "event": "mega_gift" if rarity == "legendary" else "gift",
        "county": c.code, "title": c.title, "score": c.score,
        "points": points, "value": raw_value, "rarity": rarity,
        "user": user_label, "gift_name": gift_name,
        "top_supporters": _top_supporters_payload(),
    }
