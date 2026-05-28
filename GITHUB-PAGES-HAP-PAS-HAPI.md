# Publikimi në internet (GitHub Pages)

Aplikacioni publik:

**https://jonidarafuna.github.io/webgis-kosove-tkk/**

Pa Oracle, pa kartë bankare, pa PC të ndezur 24/7 — vetëm GitHub (falas).

---

## Çfarë funksionon online?

| Po | Jo (vetëm në PC me GeoServer) |
|----|-------------------------------|
| Harta, monumente, filtra, timeline, mobile | Shtresat WMS rajonet/komunat/kosova |
| Kërkim, detaje, statistikë | Raporti VGI që shkon në server |
| “Add to Home Screen” si app | GeoServer live |

Poligonet administrative mungojnë online — harta bazë (OSM) dhe të gjitha pikat e monumenteve mbeten.

---

## Hapi 1 — Eksporto monumentet (një herë, në PC)

1. Nis **GeoServer** (Start Menu).
2. Dy-klik **`web/HAPNI.bat`** — lëre dritaren hapur.
3. Hap http://localhost:5500 — sigurohu që monumentet shfaqen.
4. Dy-klik **`web/EKSPORTO-MONUMENTE.bat`** (monumentet).
5. Dy-klik **`web/EKSPORTO-KUFIJT.bat`** (kufijtë rajonet/komunat/Kosova).

Skedarët:
- `web/data/monuments/*.geojson`
- `web/data/boundaries/*.geojson`

---

## Hapi 2 — Ngarko në GitHub

Në GitHub Desktop: zgjidh ndryshimet → **Commit to main** → **Push origin**.

Ose në PowerShell:

```powershell
cd "c:\Users\rafun\Desktop\UNI\Master\Viti II\Semestri III\Ueb GIS\Detyra\Detyra\webgis-kosove-tkk"
git add .
git commit -m "GitHub Pages dhe GeoJSON monumentesh"
git push
```

---

## Hapi 3 — Aktivizo GitHub Pages

GitHub **nuk lejon** folderin `/web` te “Deploy from a branch”. Përdoret **GitHub Actions** (`.github/workflows/github-pages.yml`).

1. Bëj **push** (Hapi 2).
2. Hap: https://github.com/jonidarafuna/webgis-kosove-tkk/settings/pages
3. **Build and deployment** → Source: **GitHub Actions**
4. Shko te **Actions** — prit “Deploy WebGIS…” **green** (1–3 min).

---

## Hapi 4 — Në telefon (si app)

1. Hap linkun në Chrome/Safari.
2. **Shto në ekranin kryesor** / Add to Home Screen.
3. Hap nga ikona — funksionon pa Wi‑Fi të PC-së.

---

## Për dokumentimin (PDF)

- **Kapitulli 8:** linku publik + repo GitHub.
- **Kapitulli 7.2:** screenshot nga telefoni me linkun `github.io`.
- Versioni publik = **GeoJSON statik**; zhvillimi lokal = **WFS/WMS GeoServer**.

---

## Nëse faqja është bosh

- A ke bërë **Hapi 1** dhe **push** të `web/data/monuments/*.geojson`?
- A është **GitHub Actions** aktiv te Settings → Pages?
- A është workflow-i **green** te Actions?

---

## Përditësim i të dhënave

Kur ndryshon monumentet në GeoServer: përsërit Hapi 1 + Hapi 2.
