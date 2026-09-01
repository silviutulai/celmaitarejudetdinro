# Cel mai tare județ din România 🏆

Joc live pentru TikTok, format **9:16** (vertical, gata pentru filmat
pe telefon sau pentru OBS), cu design de tip "loading screen" de
battle royale (fundal navy, contur auriu, carduri de raritate).

Fiecare comentariu cu numele/codul unui județ îi dă **+5 puncte** —
atât pentru județ, cât și pentru clasamentul personal al celui care a
scris — și apare o mică animație cu numele lui chiar lângă județ.
Anti-spam pe bază de timp: între două comentarii punctate ale
**aceleiași persoane** trebuie să treacă minim **30 de secunde** —
ceea ce înseamnă practic maxim 10 comentarii punctate la fiecare 5
minute per persoană. Comentariile din pauză tot ajută la atribuirea
cadourilor, doar nu mai punctează.

Dacă persoana trimite și un **cadou**, punctele se dublează (×2), iar
pe ecran apare o "fighter card" mare, cu numele ei, avatar cu inițiale,
județul susținut și punctele câștigate — cu stil vizual diferit după
raritatea cadoului: **comun → rar → epic → legendar** (cadourile mari,
peste prag, declanșează animația legendară, cu raze de lumină și ecran
întunecat dramatic). Dacă cineva dă un cadou **înainte** să scrie din
ce județ e, cadoul nu se pierde — rămâne "în așteptare" și se aplică
automat, cu tot cu animație, de îndată ce scrie un județ valid.

Pe hartă doar **top 5 județe** au culoare (auriu/argintiu/bronz/cyan/
mov), restul rămân gri-uniform cu numărul de loc afișat clar, cu
cifre mari și negre. Deasupra hărții apare mereu un panou cu **top 5
susținători** (persoanele cu cele mai multe puncte acumulate), cu
insignă de scut și coroană pentru primul loc. Clasamentul **complet**
(toate cele 42 de județe + toți susținătorii) e vizibil doar în
`/admin`, ca pagina de afișaj să rămână curată pentru filmat.

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

Controalele (conectare TikTok, mod test, reset, clasament complet)
sunt separat, la `http://localhost:8000/admin`, protejate cu o
parolă. Local, setează parola înainte să pornești serverul:

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

În `/admin` poți testa jocul fără să fii live, cu un buton pentru
fiecare raritate de cadou:

- **„+1 comentariu”** — simulează un comentariu normal (dă 5 puncte,
  fără card, dar cu mica animație cu numele lângă județ; în modul
  test sare peste pauza de 30s, ca să poți apăsa liber).
- **„Cadou comun”** — cadou mic, sub prag (5 → 10 puncte).
- **„Cadou rar”** — (15 → 30 puncte).
- **„Cadou epic”** — (50 → 100 puncte).
- **„🔥 Cadou LEGENDAR (98+)”** — declanșează animația mare, cu raze
  de lumină și ecran întunecat.

Mai jos, în același panou, poți testa special fluxul de "cadou dat
înainte de a scrie județul":
1. Apasă **„1️⃣ Cadou fără județ (60 pct)”** — pune un cadou în
   așteptare pentru un utilizator de test separat.
2. Scrie un cod de județ în câmp și apasă **„2️⃣ Scrie județul acum”**
   — cadoul de la pasul 1 se aplică automat, cu tot cu animație.

Când ești gata să te conectezi la propriul live TikTok, din `/admin`
scrie username-ul tău (fără @) și apasă **„Conectează-te la live”**.
Trebuie să fii deja LIVE pe TikTok cu contul respectiv ca să
funcționeze. Pagina de afișaj (`/`) preia automat toate schimbările —
nu trebuie s-o dai refresh.

---

## 2. Pune codul pe GitHub

Din folderul proiectului (păstrează fișierele la rădăcina repo-ului,
nu într-un subfolder — vezi nota de mai jos dacă ai probleme cu asta):

```bash
git init
git add .
git commit -m "Design nou: fighter cards, susținători, panou admin"
git branch -M main
git remote add origin https://github.com/<user-ul-tau>/<repo-ul-tau>.git
git push -u origin main --force
```

Dacă repo-ul există deja și vrei doar să actualizezi fișierele (fără
`git` instalat), cea mai simplă variantă e prin browser: deschide
folderul dezarhivat pe calculator, selectează tot conținutul din
interior (Ctrl+A / Cmd+A — inclusiv folderul `static`, ca folder
întreg, nu fișierele lui individual) și trage totul peste zona de
upload de pe GitHub (**Add file → Upload files**). Browserul păstrează
structura de subfoldere dacă tragi folderul `static` ca atare.

---

## 3. Deploy pe Render

**Varianta rapidă (cu `render.yaml`, inclus în proiect):**

1. Mergi pe [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. Conectează contul tău de GitHub și alege repo-ul.
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
deschizi pe ecranul pe care îl filmezi, iar `/admin` pentru control.

---

### ⚠️ Ce trebuie să schimbi/cumperi pe Render ca să nu ți se reseteze jocul în timpul live-ului

Sunt **două riscuri diferite**, și trebuie rezolvate pe rând:

**1. Planul Free "adoarme" — riscul cel mai mare.**
Pe planul gratuit, Render oprește complet serviciul după ~15 minute
fără trafic. Dacă exact atunci ești live și cineva scrie în chat,
pagina poate pica sau dura 30-60s să pornească din nou, iar conexiunea
la TikTok se rupe. **Soluție: treci pe planul „Starter" (în jur de
7 USD/lună)** — de la **Dashboard → serviciul tău → Settings →
Instance Type**. Serviciile plătite nu mai adorm din inactivitate.

**2. Chiar și pe Starter, un restart normal șterge scorul din memorie.**
Scorurile (și clasamentul susținătorilor) sunt ținute în memoria
procesului. Dacă Render repornește serviciul din orice motiv (crash,
mentenanță, redeploy), memoria se golește. Ca să nu pierzi progresul,
aplicația salvează automat pe disc la fiecare câteva secunde — dar are
nevoie de **un disc persistent**, care există doar pe planuri plătite:

- Dashboard → serviciul tău → **Disks** → **Add Disk**
- Mount path: `/var/data`, dimensiune: 1 GB e mai mult decât suficient.
- Setează variabila de mediu `STATE_FILE=/var/data/state.json`
  (deja inclusă în `render.yaml`, dacă folosești Blueprint-ul).

Cu discul atașat, chiar dacă serviciul repornește la mijlocul unui
live, la următorul request scorurile și susținătorii sunt reîncărcați
exact de unde au rămas (doar starea conexiunii TikTok trebuie refăcută
manual, apăsând din nou „Conectează-te la live" din `/admin`).

**3. Nu redeploya în timpul live-ului.**
Orice push nou pe GitHub (dacă ai activat auto-deploy) repornește
serviciul. Fă update-urile de cod **înainte sau după** live, niciodată
în timpul lui.

**Rezumat ce să cumperi:** planul **Starter** (obligatoriu, ~7$/lună)
+ un **Disk** de 1 GB atașat lui (câțiva cenți/lună). Costul total e
proporțional cu zilele cât rulează serviciul (Render calculează pe
secundă), facturat automat pe card, la începutul lunii următoare.

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

### Alte variabile utile (opționale)

```
MEGA_GIFT_THRESHOLD=99     # peste cate diamante devine cadou "legendar"
RARE_THRESHOLD=10          # de la cate diamante devine "rar"
EPIC_THRESHOLD=30          # de la cate diamante devine "epic"
EULERSTREAM_API_KEY=...    # cheie optionala pentru limite mai mari TikTokLive
```

### Cheie opțională Euler Stream (limite mai mari)

TikTokLive folosește un server de semnare gratuit (Euler Stream) cu
limite comunitare — suficiente de obicei pentru un singur live
personal. Dacă vrei limite mai mari, îți poți face o cheie gratuită pe
[eulerstream.com](https://www.eulerstream.com/) și o adaugi în Render
la **Environment → Environment Variables**.

---

## 4. Două pagini, roluri diferite

- **`/`** — pagina de afișaj: titlu, top 5 susținători, hartă, banner
  cu îndemn. Fără niciun buton, fără clasament complet — doar poziția
  se vede pe hartă prin numărul de rang și culoare. Asta e link-ul pe
  care îl deschizi pe ecranul filmat.
- **`/admin`** — panoul de control: conectare TikTok, mod test (cu
  toate cele 4 rarități), reset, plus **clasamentul complet** (toate
  județele + toți susținătorii, cu puncte exacte). Protejat cu parolă
  (`ADMIN_PASSWORD`). Îl deschizi separat, pe telefon sau alt monitor,
  niciodată pe ecranul filmat.

## 5. Cum funcționează scorul

- Cineva scrie în chat `CJ`, `Cluj`, `cluj` (fără diacritice merge la
  fel) → județul Cluj primește **+5 puncte** (configurabil din
  `COMMENT_POINTS`), persoana urcă 5 puncte în clasamentul personal de
  susținători, și apare o mică animație cu numele ei chiar lângă județ
  (nu cardul mare — acela e doar la cadouri).
- Anti-spam **pe bază de timp**: între două comentarii punctate ale
  **aceleiași persoane** trebuie să treacă minim
  `COMMENT_COOLDOWN_SECONDS` (implicit **30 secunde**) — asta dă
  automat un maxim de 10 comentarii punctate la fiecare 5 minute per
  persoană, ca nimeni să nu poată umfla artificial un județ scriind
  codul întruna. Comentariile din pauză tot actualizează "ultimul
  județ" al persoanei (pentru atribuirea cadourilor), doar nu mai
  adaugă puncte și nu mai declanșează animația.
- Dacă acea persoană trimite și un **cadou**, se calculează valoarea
  lui în "diamante" TikTok, se dublează (**×2**) și se adaugă la
  ultimul județ pe care l-a scris în chat, plus la punctajul ei
  personal.
- **Dacă cineva dă un cadou înainte să scrie vreun județ** (ex. tocmai
  a intrat pe live și dă cadou din prima), cadoul nu se pierde — rămâne
  "în așteptare" pentru acea persoană. De îndată ce scrie un județ
  valid, cadoul e aplicat automat pe acel județ, cu tot cu animație,
  exact ca și cum ar fi venit normal.
- Fiecare cadou primește o **raritate**, in functie de valoarea brută
  (înainte de ×2): sub 10 = **comun**, 10-29 = **rar**, 30-99 =
  **epic**, peste 99 = **legendar**. Pragurile sunt configurabile din
  variabilele de mediu de mai sus.
- La orice cadou (indiferent de raritate) apare pe ecran o "fighter
  card" cu inițialele persoanei, numele ei, județul susținut și
  punctele câștigate — stilul cardului (culoare, mărime, efecte)
  variază după raritate; la **legendar** apare animația cea mai mare,
  cu ecran întunecat și raze de lumină.
- **Top 5 județe** de pe hartă au o culoare solidă distinctă în funcție
  de loc: auriu (#1), argintiu (#2), portocaliu (#3), cyan (#4), mov
  (#5) — restul județelor rămân gri-uniform, cu numărul de loc afișat
  clar, cu cifre mari, negre, pe fundal deschis (contrast maxim).
- **Top 5 susținători** (persoanele cu cele mai multe puncte adunate)
  apar mereu într-un panou deasupra hărții, cu insignă de scut și
  coroană pentru primul loc.
- **București** e prea mic pe harta reală ca să se vadă ceva pe el,
  așa că are propriul cerc, separat, în colțul hărții, cu aceeași
  colorare și logică de rang ca restul.
- Întreaga pagină de afișaj e în **format 9:16** (vertical) — se
  ajustează automat, cu bare negre pe laterale dacă fereastra nu are
  deja acest raport, gata pentru filmat pe telefon sau capturat direct
  ca sursă verticală în OBS.
- Toate actualizările (hartă, susținători, animații) apar instant
  pentru toată lumea care are pagina deschisă, prin WebSocket.

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
├── scoring.py                # regulile de scor (plafon comentarii, cadou "in asteptare", raritate)
├── tiktok_bridge.py             # conectarea la TikTokLive (apeleaza scoring.py)
├── counties.py                    # cele 42 de judete + logica de identificare
├── game_state.py                    # scoruri judete + sustinatori + persistenta pe disc
├── connection_manager.py              # broadcast WebSocket catre browsere
├── requirements.txt
├── Procfile                            # comanda de pornire pentru Render
├── render.yaml                           # configurare automata Render (plan + disc)
├── .env.example
└── static/
    ├── index.html                        # pagina de afisaj (format 9:16, fara controale)
    ├── admin.html                          # pagina de admin (login + controale + clasament complet)
    ├── admin.js                              # logica paginii de admin
    ├── admin.css                               # stiluri specifice paginii de admin
    ├── style.css                                 # design comun (letterbox 9:16, harta, fighter card)
    ├── app.js                                      # logica paginii de afisaj (WebSocket, harta, sustinatori)
    └── data/romania.js                               # coordonatele SVG ale celor 42 de judete
```

## 7. Idei de extins mai departe

- Migrare de la fișier JSON local la o bază de date mică (Postgres pe
  Render, gratuit la nivel de bază) dacă vrei clasament pe termen
  lung, nu doar per-live.
- Un mod "rundă cu timp" (ex. 3 ore) cu reset automat.
- Sunet la fiecare cadou / cadou legendar (fișier audio redat din browser).
- Poza reală de profil TikTok în loc de inițiale pe fighter card
  (biblioteca TikTokLive are o metodă `get_avatar_url`, dar necesită
  testare suplimentară pentru avatare ale altor useri, nu doar ale
  streamerului).
