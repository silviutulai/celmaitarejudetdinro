"""
State-ul jocului: scorurile curente ale celor 42 de judete, plus
clasamentul sustinatorilor (persoanele care scriu/dau cadouri) si
informatii despre conexiunea curenta la TikTok Live.

Traieste in memorie, dar se salveaza periodic pe disc (STATE_FILE)
ca sa nu se piarda scorul daca procesul se restarteaza in timpul
unui live (vezi README.md - sectiunea despre Render).
"""
import json
import os
import pathlib
import time
from dataclasses import dataclass
from typing import Optional

from counties import COUNTIES

STATE_FILE = pathlib.Path(os.getenv("STATE_FILE", "./data/state.json"))
MAX_SUPPORTERS_KEPT = 200  # nu tinem un istoric nelimitat de useri in memorie/pe disc


@dataclass
class CountyScore:
    id: str
    code: str
    title: str
    score: int = 0


@dataclass
class Supporter:
    user_id: str    # unique_id TikTok - identificator stabil
    name: str        # nickname afisat (poate sa difere de user_id)
    points: int = 0


class GameState:
    def __init__(self):
        self.counties: dict[str, CountyScore] = {
            c["id"]: CountyScore(id=c["id"], code=c["code"], title=c["title"])
            for c in COUNTIES
        }
        self.supporters: dict[str, Supporter] = {}  # user_id -> Supporter
        self.total_points: int = 0
        self.connected: bool = False
        self.tiktok_username: Optional[str] = None
        self.viewer_count: int = 0
        self.connected_since: Optional[float] = None
        # tine minte ultimul judet mentionat de fiecare utilizator,
        # ca sa stim pe cine bonusam cand trimite un cadou
        self.last_county_by_user: dict[str, str] = {}
        self._dirty: bool = False

    def add_point(self, county_id: str, points: int) -> Optional[CountyScore]:
        c = self.counties.get(county_id)
        if c is None:
            return None
        c.score += points
        self.total_points += points
        self.mark_dirty()
        return c

    def add_supporter_points(self, user_id: str, name: str, points: int) -> Supporter:
        s = self.supporters.get(user_id)
        if s is None:
            s = Supporter(user_id=user_id, name=name, points=0)
            self.supporters[user_id] = s
        s.name = name  # numele poate sa se schimbe intre aparitii
        s.points += points
        self.mark_dirty()
        # curatare simpla daca lista creste prea mult (tinem doar cei mai activi)
        if len(self.supporters) > MAX_SUPPORTERS_KEPT:
            ordered = sorted(self.supporters.values(), key=lambda x: -x.points)
            self.supporters = {s.user_id: s for s in ordered[:MAX_SUPPORTERS_KEPT]}
        return s

    def mark_dirty(self):
        self._dirty = True

    def leaderboard(self, limit: int = 42) -> list[CountyScore]:
        ordered = sorted(
            self.counties.values(),
            key=lambda c: (-c.score, c.title),
        )
        return ordered[:limit]

    def top_supporters(self, limit: int = 5) -> list[Supporter]:
        ordered = sorted(self.supporters.values(), key=lambda s: -s.points)
        return ordered[:limit]

    def snapshot(self) -> dict:
        return {
            "event": "snapshot",
            "counties": [
                {"id": c.id, "code": c.code, "title": c.title, "score": c.score}
                for c in self.counties.values()
            ],
            "top_supporters": [
                {"name": s.name, "points": s.points} for s in self.top_supporters(10)
            ],
            "total_points": self.total_points,
            "connected": self.connected,
            "username": self.tiktok_username,
            "viewer_count": self.viewer_count,
            "connected_since": self.connected_since,
        }

    def reset(self):
        for c in self.counties.values():
            c.score = 0
        self.supporters.clear()
        self.last_county_by_user.clear()
        self.total_points = 0
        self.mark_dirty()
        self.save_to_disk(force=True)

    # ---------------- persistenta pe disc ----------------
    def save_to_disk(self, force: bool = False):
        """
        Scrie scorurile curente intr-un fisier JSON, ca sa poata fi
        recuperate daca procesul reporneste in timpul unui live.
        Nu salveaza starea conexiunii TikTok (aceea se reface la
        reconectare manuala).
        """
        if not self._dirty and not force:
            return
        try:
            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "counties": {cid: c.score for cid, c in self.counties.items()},
                "supporters": {
                    uid: {"name": s.name, "points": s.points}
                    for uid, s in self.supporters.items()
                },
                "total_points": self.total_points,
                "saved_at": time.time(),
            }
            tmp = STATE_FILE.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            tmp.replace(STATE_FILE)
            self._dirty = False
        except Exception:
            # persistenta e un "nice to have" - nu trebuie sa pice jocul
            pass

    def load_from_disk(self):
        if not STATE_FILE.exists():
            return
        try:
            payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            scores = payload.get("counties", {})
            for cid, score in scores.items():
                if cid in self.counties:
                    self.counties[cid].score = int(score)
            for uid, data in payload.get("supporters", {}).items():
                self.supporters[uid] = Supporter(
                    user_id=uid, name=data.get("name", uid), points=int(data.get("points", 0))
                )
            self.total_points = int(payload.get("total_points", 0))
        except Exception:
            pass


STATE = GameState()
STATE.load_from_disk()
