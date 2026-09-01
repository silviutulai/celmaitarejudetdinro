"""
Lista celor 42 de "judete" (41 judete + Bucuresti) si logica de potrivire
a unui comentariu TikTok cu un judet (dupa cod, nume, sau alias uzual).
"""
import re
import unicodedata

COUNTIES = [
    {"id": "RO-AB", "code": "AB", "title": "Alba"},
    {"id": "RO-AG", "code": "AG", "title": "Argeș"},
    {"id": "RO-AR", "code": "AR", "title": "Arad"},
    {"id": "RO-BC", "code": "BC", "title": "Bacău"},
    {"id": "RO-BH", "code": "BH", "title": "Bihor"},
    {"id": "RO-BN", "code": "BN", "title": "Bistrița-Năsăud"},
    {"id": "RO-BR", "code": "BR", "title": "Brăila"},
    {"id": "RO-BT", "code": "BT", "title": "Botoșani"},
    {"id": "RO-B",  "code": "B",  "title": "București"},
    {"id": "RO-BV", "code": "BV", "title": "Brașov"},
    {"id": "RO-BZ", "code": "BZ", "title": "Buzău"},
    {"id": "RO-CJ", "code": "CJ", "title": "Cluj"},
    {"id": "RO-CL", "code": "CL", "title": "Călărași"},
    {"id": "RO-CS", "code": "CS", "title": "Caraș-Severin"},
    {"id": "RO-CT", "code": "CT", "title": "Constanța"},
    {"id": "RO-CV", "code": "CV", "title": "Covasna"},
    {"id": "RO-DB", "code": "DB", "title": "Dâmbovița"},
    {"id": "RO-DJ", "code": "DJ", "title": "Dolj"},
    {"id": "RO-GJ", "code": "GJ", "title": "Gorj"},
    {"id": "RO-GL", "code": "GL", "title": "Galați"},
    {"id": "RO-GR", "code": "GR", "title": "Giurgiu"},
    {"id": "RO-HD", "code": "HD", "title": "Hunedoara"},
    {"id": "RO-HR", "code": "HR", "title": "Harghita"},
    {"id": "RO-IF", "code": "IF", "title": "Ilfov"},
    {"id": "RO-IL", "code": "IL", "title": "Ialomița"},
    {"id": "RO-IS", "code": "IS", "title": "Iași"},
    {"id": "RO-MH", "code": "MH", "title": "Mehedinți"},
    {"id": "RO-MM", "code": "MM", "title": "Maramureș"},
    {"id": "RO-MS", "code": "MS", "title": "Mureș"},
    {"id": "RO-NT", "code": "NT", "title": "Neamț"},
    {"id": "RO-OT", "code": "OT", "title": "Olt"},
    {"id": "RO-PH", "code": "PH", "title": "Prahova"},
    {"id": "RO-SB", "code": "SB", "title": "Sibiu"},
    {"id": "RO-SJ", "code": "SJ", "title": "Sălaj"},
    {"id": "RO-SM", "code": "SM", "title": "Satu Mare"},
    {"id": "RO-SV", "code": "SV", "title": "Suceava"},
    {"id": "RO-TL", "code": "TL", "title": "Tulcea"},
    {"id": "RO-TM", "code": "TM", "title": "Timiș"},
    {"id": "RO-TR", "code": "TR", "title": "Teleorman"},
    {"id": "RO-VL", "code": "VL", "title": "Vâlcea"},
    {"id": "RO-VN", "code": "VN", "title": "Vrancea"},
    {"id": "RO-VS", "code": "VS", "title": "Vaslui"},
]

COUNTIES_BY_ID = {c["id"]: c for c in COUNTIES}

EXTRA_ALIASES = {
    "bucuresti": "RO-B", "buc": "RO-B", "bucurest": "RO-B", "capitala": "RO-B",
    "ilfov": "RO-IF",
    "clujnapoca": "RO-CJ", "cluj napoca": "RO-CJ",
    "satumare": "RO-SM", "satu-mare": "RO-SM",
    "bistritanasaud": "RO-BN", "bistrita": "RO-BN", "nasaud": "RO-BN",
    "carasseverin": "RO-CS", "caras severin": "RO-CS", "caras": "RO-CS",
    "timisoara": "RO-TM", "iasi": "RO-IS", "constanta": "RO-CT",
    "valcea": "RO-VL", "giurgiu": "RO-GR", "ramnicu valcea": "RO-VL",
}


def _norm(s: str) -> str:
    """Scoate diacriticele, minusculizeaza si taie spatiile."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s.lower().strip()


_LOOKUP: dict[str, dict] = {}
for c in COUNTIES:
    _LOOKUP[_norm(c["code"])] = c
    _LOOKUP[_norm(c["title"])] = c
    _LOOKUP[_norm(c["title"]).replace(" ", "").replace("-", "")] = c

for alias, county_id in EXTRA_ALIASES.items():
    target = COUNTIES_BY_ID.get(county_id)
    if target:
        _LOOKUP[_norm(alias)] = target


def find_county(text: str) -> dict | None:
    """
    Incearca sa gaseasca un judet intr-un text de comentariu TikTok.
    Accepta cod (CJ), nume intreg (Cluj), fara diacritice, sau ca token
    izolat intr-un comentariu mai lung ("hai CJ!!!").
    """
    if not text:
        return None
    t = _norm(text)
    t = re.sub(r"[^a-z0-9\s-]", "", t)
    if t in _LOOKUP:
        return _LOOKUP[t]
    compact = t.replace(" ", "").replace("-", "")
    if compact in _LOOKUP:
        return _LOOKUP[compact]
    for token in t.split():
        if token in _LOOKUP:
            return _LOOKUP[token]
    return None
