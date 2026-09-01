"""
Gestioneaza conexiunile WebSocket deschise de browsere si trimite
(broadcast) evenimentele jocului catre toate ferestrele deschise in
acelasi timp (util daca filmezi pe un ecran si urmaresti pe altul).
"""
import asyncio
import json
from typing import List

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.append(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            if ws in self.active:
                self.active.remove(ws)

    async def broadcast(self, message: dict):
        data = json.dumps(message, ensure_ascii=False)
        stale = []
        for ws in list(self.active):
            try:
                await ws.send_text(data)
            except Exception:
                stale.append(ws)
        for ws in stale:
            await self.disconnect(ws)


MANAGER = ConnectionManager()
