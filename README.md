# Cel mai tare județ din România 🏆

Joc live pentru TikTok: fiecare comentariu cu numele/codul unui județ
îi dă +1 punct, iar dacă persoana respectivă trimite și un cadou,
punctele pentru județul ei se dublează (×2). Top 5 județe apar
evidențiate special pe hartă și în clasament (contur + culoare de
rang), fiecare județ are prescurtarea afișată direct pe hartă, iar
București are propriul cerc separat (pe harta reală e prea mic ca să
se citească ceva pe el). Când vine un cadou cu valoare peste 99
(prag configurabil), pornește o animație "mega" separată, cu numele
celui care a dat cadoul și județul lui. Totul e gândit să fie filmat
cu telefonul: fundal alb, scris mare și clar.

Se conectează direct la contul tău de TikTok când dai live, folosind
[TikTokLive](https://github.com/isaackogan/TikTokLive) — o librărie
open-source care citește comentariile și cadourile din live-ul tău
**fără parolă și fără login**, doar cu username-ul contului.

> ⚠️ TikTokLive nu este un API oficial TikTok, ci un proiect de reverse
> engineering (citește același websocket pe care îl vede orice
> spectator al unui live). Funcționează foarte bine pentru uz personal,
> dar TikTok își poate schimba structura internă din când în când —
> dacă la un moment dat conexiunea nu mai merge, de obicei apare rapid
> o versiune nouă a librăriei (`pip install --upgrade TikTokLive`).

---

## 1. Rulează local (ca să testezi înainte de live)

Ai nevoie de Python 3.11+ instalat.

```bash
# 1. intră în folderul proiectului
cd cel-mai-tare-judet

# 2. creează un mediu virtual (recomandat)
python -m venv venv
source venv/bin/activate        # pe Windows: venv\Scripts\activate

# 3. instalează dependințele
pip install -r requirements.txt

# 4. pornește serverul
uvicorn app:app --reload
```

Deschide apoi `http://localhost:8000` în browser — asta e **pagina de
afișaj**, curată, fără butoane, gata de filmat.

Controalele (conectare TikTok, mod test, reset) sunt separat, la
`http://localhost:8000/admin`, protejate cu o parolă. Local, setează
parola înainte să pornești serverul:

```bash
# Linux / Mac
export ADMIN_PASSWORD=parola_ta
uvicorn app:app --reload

# Windows (PowerShell)
$env:ADMIN_PASSWORD="parola_ta"
uvicorn app:app --reload
```

Fără `ADMIN_PASSWORD` setat, pagina `/admin` afișează un mesaj clar
că parola nu e configurată, în loc să lase pe oricine să intre.

În `/admin` poți testa jocul fără să fii live:

- **„+1 comentariu”** — simulează un comentariu normal.
- **„🎁 cadou ×2”** — simulează un cadou mic (10 puncte brute → 20 cu ×2).
- **„🔥 simulează cadou MEGA (100+)”** — simulează un cadou mare
  (150 puncte brute → peste prag → declanșează animația mega).

Când ești gata să te conectezi la propriul live TikTok, din `/admin`
scrie username-ul tău (fără @) și apasă **„Conectează-te la live”**.
Trebuie să fii deja LIVE pe TikTok cu contul respectiv ca să
funcționeze. Pagina de afișaj (`/`) preia automat toate schimbările —
nu trebuie s-o dai refresh.

---

## 2. Pune codul pe GitHub

Dacă nu ai încă un repo, din folderul proiectului:

```bash
git init
git add .
git commit -m "Primul commit - cel mai tare judet din Romania"
```

Creează un repo nou și gol pe [github.com/new](https://github.com/new)
(fără README, fără .gitignore — le ai deja), apoi:

```bash
git remote add origin https://github.com/<user-ul-tau>/cel-mai-tare-judet.git
git branch -M main
git push -u origin main
```

---

## 3. Deploy pe Render

**Varianta rapidă (cu `render.yaml`, inclus în proiect):**

1. Mergi pe [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. Conectează contul tău de GitHub și alege repo-ul `cel-mai-tare-judet`.
3. Render citește automat `render.yaml` (plan `starter` + disc persistent, vezi mai jos).
4. Apasă **Apply** — build-ul pornește automat.

**Varianta manuală:**

1. **New** → **Web Service** → alege repo-ul.
2. Environment: `Python 3`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Plan: **Starter** (nu Free — vezi mai jos de ce).

După deploy, Render îți dă un URL de tipul
`https://cel-mai-tare-judet.onrender.com` — acela e link-ul pe care îl
deschizi pe ecranul pe care îl filmezi.

---

### ⚠️ Ce trebuie să cumperi pe Render ca să nu ți se reseteze jocul în timpul live-ului

Sunt **două riscuri diferite**, și trebuie rezolvate pe rând:

**1. Planul Free "adoarme" — riscul cel mai mare.**
Pe planul gratuit, Render oprește complet serviciul după ~15 minute
fără trafic. Dacă exact atunci ești live și cineva scrie în chat,
pagina poate pica sau dura 30-60s să pornească din nou, iar conexiunea
la TikTok se rupe. **Soluție: treci pe planul „Starter" (în jur de
7 USD/lună)** — de la **Dashboard → serviciul tău → Settings →
Instance Type**. Serviciile plătite nu mai adorm din inactivitate.

**2. Chiar și pe Starter, un restart normal șterge scorul din memorie.**
Scorurile sunt ținute în memoria procesului. Dacă Render repornește
serviciul din orice motiv (crash, mentenanță, redeploy), memoria se
golește. Ca să nu pierzi scorul, aplicația salvează automat pe disc la
fiecare câteva secunde — dar are nevoie de **un disc persistent**, care
există doar pe planuri plătite:

- Dashboard → serviciul tău → **Disks** → **Add Disk**
- Mount path: `/var/data`, dimensiune: 1 GB e mai mult decât suficient.
- Setează variabila de mediu `STATE_FILE=/var/data/state.json`
  (deja inclusă în `render.yaml`, dacă folosești Blueprint-ul).

Cu discul atașat, chiar dacă serviciul repornește la mijlocul unui
live, la following request scorurile sunt reîncărcate exact de unde
au rămas (doar starea conexiunii TikTok trebuie refăcută manual,
apăsând din nou „Conectează-te la live").

**3. Nu redeploya în timpul live-ului.**
Orice push nou pe GitHub (dacă ai activat auto-deploy) repornește
serviciul. Fă update-urile de cod **înainte sau după** live, niciodată
în timpul lui.

**Rezumat ce să cumperi:** planul **Starter** (obligatoriu, ~7$/lună)
+ un **Disk** de 1 GB atașat lui (câțiva cenți/lună) = combinația care
te protejează de ambele riscuri.

### Setează parola de admin pe Render

Fără asta, `/admin` nu funcționează deloc pe server (măsură de
siguranță — nu vrei ca oricine găsește URL-ul să-ți poată conecta sau
deconecta live-ul). Din Render:

**Dashboard → serviciul tău → Environment → Add Environment Variable:**

```
ADMIN_PASSWORD=o_parola_serioasa_a_ta
```

Salvează — Render repornește automat serviciul cu noua variabilă.
Apoi accesează `https://<url-ul-tau-render>.onrender.com/admin` și
loghează-te cu parola respectivă.

### Cheie opțională Euler Stream (limite mai mari)

TikTokLive folosește un server de semnare gratuit (Euler Stream) cu
limite comunitare — suficiente de obicei pentru un singur live
personal. Dacă vrei limite mai mari, îți poți face o cheie gratuită pe
[eulerstream.com](https://www.eulerstream.com/) și o adaugi în Render
la **Environment → Environment Variables**:

```
EULERSTREAM_API_KEY=cheia_ta_aici
```

---

## 4. Două pagini, roluri diferite

- **`/`** — pagina de afișaj: doar hartă, clasament, statistici. Fără
  niciun buton. Asta e link-ul pe care îl deschizi pe ecranul filmat.
- **`/admin`** — panoul de control: conectare TikTok, mod test,
  reset. Protejat cu parolă (`ADMIN_PASSWORD`). Îl deschizi separat,
  pe telefon sau pe alt monitor/tab, niciodată pe ecranul filmat.

## 5. Cum funcționează scorul

- Cineva scrie în chat `CJ`, `Cluj`, `cluj` (fără diacritice merge la
  fel) → județul Cluj primește **+1 punct**.
- Dacă acea persoană trimite și un **cadou**, se calculează valoarea
  lui în "diamante" TikTok, se dublează (**×2**) și se adaugă la
  ultimul județ pe care l-a scris în chat.
- Dacă valoarea cadoului (înainte de ×2) trece de **99** (prag
  configurabil din variabila de mediu `MEGA_GIFT_THRESHOLD`), pornește
  o **animație mega** separată — mai mare, mai lungă, cu banner "SUPER
  SUSȚINĂTOR LIVE", numele celui care a dat cadoul și județul lui.
  Sub prag, apare animația normală de cadou (mai mică).
- **Top 5 județe** (pe hartă și în clasament) au un contur/culoare
  distinctă în funcție de loc: auriu (#1), argintiu (#2), bronz (#3),
  turcoaz (#4), roz (#5) — restul județelor rămân colorate după
  intensitatea scorului (gri → galben → roșu).
- **Fiecare județ** are prescurtarea și locul afișate direct pe hartă
  (ex. `CJ #1`). **București** e prea mic pe harta reală ca să se
  vadă ceva pe el, așa că are propriul cerc, separat, în colțul
  hărții, cu aceeași colorare și logică de rang ca restul.
- Clasamentul din dreapta și harta din centru se actualizează instant
  pentru toată lumea care are pagina deschisă (prin WebSocket).

Recunoașterea județului acceptă: codul auto (`CJ`, `AB`, `B` pentru
București), numele complet cu sau fără diacritice (`Cluj`, `cluj`,
`Bistrița-Năsăud`, `bistrita nasaud`), și câteva alias-uri uzuale
(`Timișoara` → Timiș, `Iași` → Iași, `Constanța` → Constanța etc.) —
vezi/editează lista din `counties.py`.

---

## 6. Structura proiectului

```
.
├── app.py                # server FastAPI: pagini, rute, WebSocket, salvare periodica
├── auth.py                 # login cu parola pentru /admin (sesiuni in memorie)
├── tiktok_bridge.py           # conectarea la TikTokLive (comentarii, cadouri, mega gift)
├── counties.py                  # cele 42 de judete + logica de identificare
├── game_state.py                  # scorurile curente + persistenta pe disc
├── connection_manager.py            # broadcast WebSocket catre browsere
├── requirements.txt
├── Procfile                          # comanda de pornire pentru Render
├── render.yaml                         # configurare automata Render (plan + disc)
├── .env.example
└── static/
    ├── index.html                      # pagina de afisaj (fara controale)
    ├── admin.html                        # pagina de admin (login + controale)
    ├── admin.js                            # logica paginii de admin
    ├── admin.css                             # stiluri specifice paginii de admin
    ├── style.css                               # design comun (impartit de ambele pagini)
    ├── app.js                                    # logica paginii de afisaj (WebSocket, harta, clasament)
    └── data/romania.js                             # coordonatele SVG ale celor 42 de judete
```

## 7. Idei de extins mai departe

- Migrare de la fișier JSON local la o bază de date mică (Postgres pe
  Render, gratuit la nivel de bază) dacă vrei clasament pe termen
  lung, nu doar per-live.
- Un mod "rundă cu timp" (ex. 3 ore) cu reset automat.
- Sunet la fiecare cadou / mega cadou (fișier audio redat din browser).
- Afișarea celor mai activi 5 utilizatori, nu doar a județelor.
