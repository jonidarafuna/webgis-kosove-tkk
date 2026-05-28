# Si ta bësh aplikacion real (pa HAPNI.bat në PC)

Që përdoruesit të tjerë ta përdorin **24/7**, duhen **dy shërbime gjithmonë online**:

1. **Faqja** (`node serve.js` — folderi `web`)
2. **GeoServer** me workspace `tkk` (shtresat WMS/WFS)

Pa GeoServer në internet, harta do të jetë bosh për të gjithë.

---

## Çfarë NUK mjafton

| Mënyra | Pse nuk mjafton vetvetiu |
|--------|---------------------------|
| Vetëm GitHub Pages | Nuk ekzekuton `serve.js`, nuk ka GeoServer |
| Vetëm PWA / “Shto në ekran” | Ende lidhet me PC-në tënde |
| Vetëm Wi‑Fi + IP lokale | Funksionon vetëm kur je në shtëpi |

---

## Opsioni A — Një server (rekomandohet)

VPS i lirë (Hetzner, DigitalOcean, Oracle Cloud free tier) ose server i universitetit.

### Hapat

1. **Instalo** në server: [Docker](https://docs.docker.com/engine/install/) + Docker Compose.

2. **Eksporto GeoServer-in lokal:**
   - Hap GeoServer → **Workspace `tkk`** duhet të ekzistojë me shtresat.
   - Kopjo folderin `data_dir` nga instalimi lokal GeoServer, **ose**
   - GeoServer Admin → **Backup** / eksport workspace (sipas versionit tënd).

3. **Ngarko projektin** në server (git clone ose ZIP).

4. **Vendos të dhënat GeoServer** (herën e parë):
   - Nis: `docker compose up -d geoserver`
   - Hyr në `http://IP-SERVER:8080/geoserver` (admin / fjalëkalimi nga compose)
   - Importo workspace `tkk` ose zëvendëso volumin `geoserver_data` me `data_dir` tënd

5. **Nis gjithçka:**
   ```bash
   cd webgis-kosove-tkk
   docker compose up -d --build
   ```

6. **Hap në shfletues:** `http://IP-SERVER:5500`

7. **(Opsionale)** Emër domain + HTTPS (Let’s Encrypt / Caddy / Nginx) — për link “zyrtar” në dokumentim.

### Variabla mjedisi (pa Docker)

```bash
cd web
npm start
# ose
GEOSERVER_URL=http://127.0.0.1:8080 PORT=5500 node serve.js
```

---

## Opsioni B — Faqja në cloud, GeoServer diku tjetër

Nëse universiteti / institucioni jep **URL publik GeoServer**:

1. Hosto vetëm `web` (Railway, Render, Fly.io, VPS):
   - **Start command:** `npm start`
   - **Root:** folderi `web`
   - **Env:** `GEOSERVER_URL=https://geoserver-institucioni.org`

2. GeoServer duhet të lejojë **CORS** ose të përdorësh proxy (`serve.js` e bën proxy në `/geoserver/...`).

---

## Pas publikimit — “si aplikacion” në telefon

Kur ke **HTTPS** (p.sh. `https://tkk.example.com`):

1. Hap linkun në Chrome (Android) ose Safari (iPhone)
2. **Shto në ekranin kryesor** (PWA — `manifest.json` është gati)
3. Përdoruesit nuk kanë nevojë për `HAPNI.bat`

---

## Kontroll i shpejtë

| URL | Duhet të kthejë |
|-----|------------------|
| `https://domeni/api/health` | JSON me `ok: true` |
| `https://domeni/geoserver/tkk/wms?service=WMS&request=GetCapabilities` | XML GeoServer |

---

## Për dokumentimin (kapitulli 8)

- **URL publik:** `https://...`
- **Arkitektura:** shfletues → `serve.js` → GeoServer + proxy DTK
- **Mobil (7.2):** layout responsiv + screenshot telefon me linkun publik

---

## Ndihmë

Nëse nuk ke server, pyet profesorin për:
- hostim të GeoServer-it të universitetit, ose
- një VM për detyrën.

Pa server ose GeoServer publik, aplikacioni “real” për publikun nuk është i mundur vetëm nga laptopi.
