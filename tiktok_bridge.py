"""
Puntea catre libraria TikTokLive (github.com/isaackogan/TikTokLive).

Aceasta librarie NU este un API oficial TikTok - citeste acelasi
websocket "Webcast" pe care il vede orice viewer al unui live. Nu ai
nevoie de login sau parola, doar de @username-ul contului care da live.

Fluxul:
  - un comentariu care contine codul/numele unui judet -> +1 punct
  - un cadou trimis de un utilizator -> se calculeaza valoarea lui in
    "diamante" TikTok, se dubleaza (x2) si se aduna la ultimul judet
    scris de acel utilizator in chat
  - daca valoarea cadoului (inainte de x2) trece de 99 -> animatie
    "mega" separata, cu numele celui care a dat si judetul lui
"""
import asyncio
import os
import time
from typing import Optional

from TikTokLive import TikTokLiveClient
from TikTokLive.client.web.web_settings import WebDefaults
from TikTokLive.events import (
    ConnectEvent,
    DisconnectEvent,
    CommentEvent,
    GiftEvent,
    LiveEndEvent,
)

try:
    from TikTokLive.events import RoomUserSeqEvent
except ImportError:  # numele exact poate difera intre versiuni
    RoomUserSeqEvent = None

from counties import find_county
from game_state import STATE
from connection_manager import MANAGER

# Cheie optionala Euler Stream (serverul de semnare folosit de TikTokLive)
# care ridica limitele gratuite de conectare. Vezi README.md.
_API_KEY = os.getenv("EULERSTREAM_API_KEY")
if _API_KEY:
    WebDefaults.tiktok_sign_api_key = _API_KEY

# Peste cate "diamante" (valoarea cadoului inainte de x2) declansam
# animatia mega, distincta de un cadou obisnuit.
MEGA_GIFT_THRESHOLD = int(os.getenv("MEGA_GIFT_THRESHOLD", "99"))


def _extract_diamond_value(event: GiftEvent) -> int:
    """
    Incearca sa afle valoarea in diamante a unui cadou, testand mai
    multe cai posibile (numele exact al campului difera intre
    versiunile libraeriei). Daca nu gaseste nimic, presupune 1
    diamant per bucata, ca sa nu pice jocul.
    """
    gift = event.gift
    candidates = [
        lambda: event.value_usd,  # unele versiuni: valoare in USD direct pe event
        lambda: getattr(gift, "diamond_count", None),
        lambda: getattr(getattr(gift, "info", None), "diamond_count", None),
        lambda: getattr(gift, "diamondCount", None),
    ]
    for get in candidates:
        try:
            val = get()
        except Exception:
            val = None
        if isinstance(val, (int, float)) and val > 0:
            return int(val)
    return 1


class TikTokBridge:
    def __init__(self):
        self.client: Optional[TikTokLiveClient] = None
        self.task: Optional[asyncio.Task] = None

    async def connect(self, username: str):
        """Porneste o conexiune noua la live-ul lui @username."""
        await self.disconnect()

        username = username.strip().lstrip("@")
        if not username:
            raise ValueError("Numele de utilizator TikTok este gol.")

        client = TikTokLiveClient(unique_id=f"@{username}")

        @client.on(ConnectEvent)
        async def on_connect(event: ConnectEvent):
            STATE.connected = True
            STATE.tiktok_username = username
            STATE.connected_since = time.time()
            await MANAGER.broadcast({
                "event": "status",
                "connected": True,
                "username": username,
                "message": f"Conectat la @{username}",
            })

        @client.on(CommentEvent)
        async def on_comment(event: CommentEvent):
            try:
                county = find_county(event.comment)
                if not county:
                    return
                c = STATE.add_point(county["id"], 1)
                if c is None:
                    return
                STATE.last_county_by_user[event.user.unique_id] = county["id"]
                STATE.mark_dirty()
                await MANAGER.broadcast({
                    "event": "hit",
                    "county": c.code,
                    "title": c.title,
                    "score": c.score,
                    "points": 1,
                    "gift": False,
                    "user": event.user.nickname or event.user.unique_id,
                })
            except Exception as exc:  # nu lasa un comentariu ciudat sa pice conexiunea
                client.logger.warning(f"Eroare la procesarea comentariului: {exc}")

        @client.on(GiftEvent)
        async def on_gift(event: GiftEvent):
            try:
                gift = event.gift
                if gift is None:
                    return
                # cadourile "cu streak" trimit mai multe evenimente cat
                # timp userul tine apasat - actionam doar la finalul streak-ului
                if getattr(gift, "type", None) == 1 and event.streaking:
                    return

                county_id = STATE.last_county_by_user.get(event.user.unique_id)
                if not county_id:
                    return  # userul n-a scris inca niciun judet in chat

                repeat_count = getattr(event, "repeat_count", 1) or 1
                unit_value = _extract_diamond_value(event)
                gift_value = unit_value * repeat_count  # valoare bruta, inainte de x2
                points = gift_value * 2  # regula: cadourile se pun x2

                c = STATE.add_point(county_id, points)
                if c is None:
                    return
                STATE.mark_dirty()

                user_label = event.user.nickname or event.user.unique_id
                gift_name = getattr(gift, "name", "cadou")
                is_mega = gift_value > MEGA_GIFT_THRESHOLD

                await MANAGER.broadcast({
                    "event": "mega_gift" if is_mega else "gift",
                    "county": c.code,
                    "title": c.title,
                    "score": c.score,
                    "points": points,
                    "value": gift_value,
                    "user": user_label,
                    "gift_name": gift_name,
                })
            except Exception as exc:
                client.logger.warning(f"Eroare la procesarea cadoului: {exc}")

        if RoomUserSeqEvent is not None:
            @client.on(RoomUserSeqEvent)
            async def on_viewers(event):
                try:
                    STATE.viewer_count = getattr(event, "total", None) or getattr(event, "viewer_count", 0)
                    await MANAGER.broadcast({
                        "event": "viewers",
                        "viewer_count": STATE.viewer_count,
                    })
                except Exception:
                    pass

        @client.on(DisconnectEvent)
        async def on_disconnect(event: DisconnectEvent):
            STATE.connected = False
            await MANAGER.broadcast({
                "event": "status",
                "connected": False,
                "message": "Deconectat de la TikTok.",
            })

        @client.on(LiveEndEvent)
        async def on_live_end(event: LiveEndEvent):
            STATE.connected = False
            await MANAGER.broadcast({
                "event": "status",
                "connected": False,
                "message": "Live-ul s-a incheiat.",
            })

        self.client = client
        self.task = asyncio.create_task(client.start())

    async def disconnect(self):
        """Inchide conexiunea curenta, daca exista una activa."""
        if self.client is not None:
            try:
                await self.client.disconnect()
            except Exception:
                pass
        if self.task is not None:
            self.task.cancel()
        self.client = None
        self.task = None
        STATE.connected = False
        STATE.tiktok_username = None
        STATE.connected_since = None


BRIDGE = TikTokBridge()
