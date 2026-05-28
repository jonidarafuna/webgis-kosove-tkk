# Publikimi si Genita Selmani (GitHub Pages)

Shembull i Genitës: https://genitaselmani.github.io/the-village-webgis/

Ti do të kesh diçka të ngjashme:

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
4. Dy-klik **`web/EKSPORTO-MONUMENTE.bat`**.

Duhet të shohësh: `arkeologjike.geojson`, `arkitekturore.geojson`, `luajtshme.geojson` në `web/data/monuments/`.

---

## Hapi 2 — Ngarko në GitHub

Në PowerShell (ndrysho rrugën nëse duhet):

```powershell
cd "c:\Users\rafun\Desktop\UNI\Master\Viti II\Semestri III\Ueb GIS\Detyra\Detyra\webgis-kosove-tkk"
git add web/data/monuments
git commit -m "GeoJSON monumentesh per GitHub Pages"
git push
```

---

## Hapi 3 — Aktivizo GitHub Pages

1. Hap: https://github.com/jonidarafuna/webgis-kosove-tkk/settings/pages
2. **Build and deployment** → Source: **Deploy from a branch**
3. Branch: **main**, Folder: **/web**
4. Save

Pas 1–3 minuta, faqja është live te linku më sipër.

---

## Hapi 4 — Në telefon (si app)

1. Hap linkun në Chrome/Safari.
2. **Add to Home Screen** / **Shto në ekranin kryesor**.
3. Hap nga ikona — funksionon pa Wi‑Fi të PC-së.

---

## Për dokumentimin (PDF)

- **Kapitulli 8:** linku publik + repo GitHub.
- **Kapitulli 7.2:** screenshot nga telefoni me linkun `github.io`.
- Shkruaj që versioni publik përdor **GeoJSON statik** (si shumë WebGIS universitare), ndërsa zhvillimi lokal përdor **WFS/WMS GeoServer**.

---

## Nëse faqja është bosh

- A ke bërë **Hapi 1** dhe **push** të `web/data/monuments/*.geojson`?
- Në Settings → Pages, a është folderi **/web**?

---

## Përditësim i të dhënave

Kur ndryshon monumentet në GeoServer: përsërit Hapi 1 + Hapi 2.
