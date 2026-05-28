# GitHub — hap pas hapi (nga zero)

GitHub është **arkivi online** i kodit tënd. Shërben për:

- backup i projektit
- ta klonosh në server (Oracle) me `git clone`
- link në dokumentim (kapitulli 8)
- (opsionale) **GitHub Pages** — vetëm faqe statike *(jo mjaftueshme vetë për WebGIS me GeoServer)*

---

## Çfarë duhet të dish

| GitHub Pages | Server (Oracle + Docker) |
|--------------|---------------------------|
| Falas, link `username.github.io/repo` | VM falas / me pagesë |
| **Nuk** ekzekuton `serve.js` | **Po** — aplikacion i plotë |
| **Nuk** ka GeoServer | GeoServer + monumente |

Për detyrë: vendos **linkun e repo-së** në dokumentim. Për app real 24/7 → **Oracle** (`PUBLIKO-HAP-PAS-HAPI.md`).

---

## PJESA 1 — Llogari GitHub

1. Hap https://github.com/signup
2. Krijo llogari (email, fjalëkalim)
3. Zgjidh planin **Free**

---

## PJESA 2 — Krijo repository (repo)

1. Hyr në https://github.com
2. Kliko **+** → **New repository**
3. Ploteso:
   - **Repository name:** `webgis-kosove-tkk` (ose emër tjetër)
   - **Description:** WebGIS Trashëgimia Kulturore e Kosovës
   - **Public** (që profesori ta shohë pa ftesë)
   - **Mos** shto README / .gitignore / license nga GitHub *(i ke në projekt)*
4. **Create repository**

Mbaj hapur faqen — do të tregojë komanda me URL-në tënde.

---

## PJESA 3 — Instalo Git në Windows (nëse nuk e ke)

1. Shkarko: https://git-scm.com/download/win
2. Instalo (Next → Next, default OK)
3. Hap **PowerShell** ose **Git Bash**

Kontrollo:

```powershell
git --version
```

---

## PJESA 4 — Ngarko projektin (herën e parë)

### Hapi 4.1 — Shko te folderi i projektit

```powershell
cd "C:\Users\rafun\Desktop\UNI\Master\Viti II\Semestri III\Ueb GIS\Detyra\Detyra\webgis-kosove-tkk"
```

(Ndrysho shtegun nëse projekti është diku tjetër.)

### Hapi 4.2 — Inicializo Git

```powershell
git init
git branch -M main
```

### Hapi 4.3 — Konfiguro emrin (vetëm herën e parë në PC)

```powershell
git config --global user.name "Emri Mbiemri"
git config --global user.email "email@shembull.com"
```

(Përdor të njëjtin email si në GitHub.)

### Hapi 4.4 — Shto skedarët

```powershell
git add .
git status
```

Duhet të shohësh skedarët e projektit (jo `node_modules` nëse s’ka).

### Hapi 4.5 — Commit i parë

```powershell
git commit -m "WebGIS Trashëgimia Kulturore e Kosovës — versioni fillestar"
```

### Hapi 4.6 — Lidhu me GitHub (remote)

Zëvendëso `EMRIYT` me username-in tënd GitHub:

```powershell
git remote add origin https://github.com/EMRIYT/webgis-kosove-tkk.git
```

### Hapi 4.7 — Push (ngarko në internet)

```powershell
git push -u origin main
```

- Herën e parë: hap dritare **Sign in** (browser ose token)
- Nëse kërkon **Personal Access Token:**
  1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
  2. **Generate new token** → zgjidh scope **repo**
  3. Kopjo tokenin → përdore si fjalëkalim kur `git push` kërkon password

Pas suksesit, rifresko faqen e repo-së në GitHub — duhet të shohësh folderët `web`, `docker-compose.yml`, etj.

---

## PJESA 5 — Ndryshime të mëvonshme (çdo ditë pune)

```powershell
cd "C:\Users\rafun\Desktop\UNI\Master\Viti II\Semestri III\Ueb GIS\Detyra\Detyra\webgis-kosove-tkk"
git add .
git commit -m "Përshkrim i shkurtër i ndryshimit"
git push
```

---

## PJESA 6 — GitHub Pages (opsionale, për kapitullin 8)

Vetëm nëse profesori kërkon **link faqeje** edhe pa server të plotë.

1. Repo → **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` → folder **`/web`**
4. **Save**

Pas 2–5 min: `https://EMRIYT.github.io/webgis-kosove-tkk/`

**Kujdes:** pa GeoServer online, harta **nuk** ngarkon monumentet. Shkruaj në dokumentim:

> “Faqja demo në GitHub Pages; të dhënat gjeografike kërkojnë GeoServer (deploy në server / Oracle Cloud).”

Për link që punon plotësisht → përdor **Oracle** (`PUBLIKO-HAP-PAS-HAPI.md`).

---

## PJESA 7 — Lidja GitHub → Oracle Server

Pasi ke VM në Oracle (SSH):

```bash
cd ~
git clone https://github.com/EMRIYT/webgis-kosove-tkk.git
cd webgis-kosove-tkk
docker compose up -d --build
```

Çdo ndryshim në PC:

```powershell
git push
```

Në server:

```bash
cd ~/webgis-kosove-tkk
git pull
docker compose up -d --build
```

---

## Çfarë të mos ngarkosh në GitHub

- Fjalëkalime, `.env` me sekrete
- `node_modules/` (i madh)
- ZIP të `data_dir` GeoServer (shumë i madh) — ngarkoje direkt në server me `scp`
- Çelësat SSH `*.key`

Skedari `.gitignore` në projekt i përjashton pjesën më të madhe.

---

## Për dokumentimin (PDF)

| Seksioni | Çfarë të vendosësh |
|----------|-------------------|
| GitHub | `https://github.com/EMRIYT/webgis-kosove-tkk` |
| Demo web (Pages) | `https://EMRIYT.github.io/webgis-kosove-tkk/` *(nëse e aktivizon)* |
| Aplikacion plotë | `http://IP-SERVER:5500` *(pas Oracle)* |

---

## Probleme

| Gabim | Zgjidhja |
|-------|----------|
| `git is not recognized` | Instalo Git për Windows |
| `Permission denied (push)` | Token GitHub ose SSH key |
| `Repository not found` | URL e gabuar ose repo private pa akses |
| Skedar shumë i madh | Mos e fut në Git; përdor `.gitignore` |

---

**Radha e punës:** GitHub (ky dokument) → pastaj Oracle (`PUBLIKO-HAP-PAS-HAPI.md`).
