# Publikimi hap pas hapi (Oracle Cloud Always Free)

Që aplikacioni të punojë **pa PC-në tënde**, duhen **faqja + GeoServer** në internet 24/7.

Koha e parë: rreth **2–4 orë**. Pas instalimit, vetëm `docker compose up -d`.

---

## Para se të fillosh (në PC)

- [ ] `HAPNI.bat` funksionon, monumentet shfaqen
- [ ] GeoServer ON, workspace **`tkk`** me shtresat
- [ ] Llogari email (për Oracle)
- [ ] (Rekomandohet) Projekti në **GitHub** — `git push`

---

## PJESA 1 — Llogari dhe server Oracle

### Hapi 1.1 — Regjistrim

1. Hap: https://www.oracle.com/cloud/free/
2. **Start for free** → krijo llogari
3. Zgjidh **Home Region** (p.sh. Frankfurt) — **nuk ndryshon** lehtë pas krijimit
4. Mos aktivizo trial me pagesë nëse nuk e kupton

### Hapi 1.2 — Krijo VM (Compute Instance)

1. Hyr në **Oracle Cloud Console**
2. Menu → **Compute** → **Instances** → **Create instance**
3. Emër: `webgis-tkk`
4. **Image:** Ubuntu 22.04 (Always Free eligible)
5. **Shape:** kliko **Change shape** → filtro **Ampere** / **Always Free-eligible**
   - Zgjidh p.sh. **VM.Standard.A1.Flex** — 4 OCPU, 24 GB RAM (falas)
6. **Networking:** krijo VCN nëse të kërkon (default OK)
7. **SSH keys:**
   - Zgjidh **Generate a key pair for me** → shkarko `*.key` (ruaje mirë!)
   - Ose ngarko çelësin tënd publik nëse e di si funksionon SSH
8. **Boot volume:** default
9. **Create**

### Hapi 1.3 — IP publike

Pas 1–2 min, te instance shfaqet **Public IP** (p.sh. `123.45.67.89`).  
Shkruaje — do ta përdorësh kudo.

### Hapi 1.4 — Hap portin 5500 (firewall Oracle)

1. Te instance → link **Subnet** (ose VCN → Security Lists)
2. Hap **Security List** që përdoret
3. **Add Ingress Rules:**

| Source CIDR | Protocol | Port |
|-------------|----------|------|
| `0.0.0.0/0` | TCP | 22 |
| `0.0.0.0/0` | TCP | 5500 |

(Porti 22 për SSH; 5500 për WebGIS.)

4. Ruaj

### Hapi 1.5 — Firewall brenda Ubuntu (herën e parë në SSH)

Do e bëjmë në Hapi 3 me komanda.

---

## PJESA 2 — Lidhu me serverin (nga Windows)

### Hapi 2.1 — SSH me PowerShell

Ruaj çelësin në p.sh. `C:\Users\emri\.ssh\oracle.key`

```powershell
ssh -i "C:\Users\emri\.ssh\oracle.key" ubuntu@IP_PUBLIKE
```

(Ndrysho `IP_PUBLIKE` dhe shtegun e çelësit.)

Herën e parë: pyetje "Are you sure?" → shkruaj `yes`.

---

## PJESA 3 — Instalo Docker në server

Në SSH (në server):

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu
```

Dil nga SSH (`exit`) dhe **hy përsëri** që grupi `docker` të aktivizohet.

```bash
sudo ufw allow 22
sudo ufw allow 5500
sudo ufw enable
```

---

## PJESA 4 — Ngarko projektin

### Opsioni A — GitHub (më lehtë)

```bash
cd ~
git clone https://github.com/EMRIYT/webgis-kosove-tkk.git
cd webgis-kosove-tkk
```

(Zëvendëso me URL-në tënde të repo-së.)

### Opsioni B — ZIP nga PC

Në PC (PowerShell), nga folderi prind i projektit:

```powershell
scp -i "C:\Users\emri\.ssh\oracle.key" -r "webgis-kosove-tkk" ubuntu@IP_PUBLIKE:~/
```

---

## PJESA 5 — GeoServer në server (e rëndësishme)

Monumentet vijnë nga GeoServer. Pa workspace **`tkk`**, harta është bosh.

### Metoda 1 — Kopjo `data_dir` nga PC (nëse ke GeoServer lokal)

1. Në PC gjej folderin **data_dir** të GeoServer-it  
   (zakonisht diçka si `C:\Program Files\GeoServer\data_dir` ose ku e ke instaluar)
2. Kompreso `data_dir` në `geoserver-data.zip`
3. Ngarko në server:

```powershell
scp -i "C:\Users\emri\.ssh\oracle.key" geoserver-data.zip ubuntu@IP_PUBLIKE:~/
```

4. Në server:

```bash
cd ~/webgis-kosove-tkk
docker compose up -d geoserver
# prit 2 min
docker compose stop geoserver
```

5. Importo të dhënat (shembull me volum):

```bash
sudo apt install -y unzip
unzip ~/geoserver-data.zip -d /tmp/gsdata
docker run --rm -v webgis-kosove-tkk_geoserver_data:/data -v /tmp/gsdata:/backup alpine sh -c "cp -a /backup/* /data/"
```

(Emri i volumit mund të jetë `webgis-kosove-tkk_geoserver_data` — kontrollo me `docker volume ls`.)

6. Nis përsëri:

```bash
docker compose up -d geoserver
```

### Metoda 2 — Import nga GeoServer Web (UI)

1. Në server: `docker compose up -d geoserver`
2. Hap në PC: `http://IP_PUBLIKE:8080/geoserver` (nëse e ke hapur portin 8080)  
   **ose** vetëm nga server me tunnel SSH:

```powershell
ssh -i "C:\Users\emri\.ssh\oracle.key" -L 8080:localhost:8080 ubuntu@IP_PUBLIKE
```

Pastaj në PC: http://localhost:8080/geoserver — admin / fjalëkalimi default (shiko dokumentacionin e imazhit Docker GeoServer).

3. Importo workspace `tkk` / shtresat si në GeoServer lokal (Backup & Restore ose ri-publikim nga shapefile).

---

## PJESA 6 — Nis WebGIS

Në server:

```bash
cd ~/webgis-kosove-tkk
docker compose up -d --build
docker compose ps
```

Duhet të shohësh `web` dhe `geoserver` **Up**.

---

## PJESA 7 — Testo

1. Në PC: `http://IP_PUBLIKE:5500`
2. Kontrollo monumentet në hartë
3. Në telefon (**me internet mobil**, jo vetëm Wi‑Fi shtëpie): i njëjti link
4. Health: `http://IP_PUBLIKE:5500/api/health`

---

## PJESA 8 — “Si aplikacion” në telefon

Kur linku punon me **http://IP:5500**:

- Android Chrome → menu → **Shto në ekranin kryesor**
- iPhone Safari → Share → **Add to Home Screen**

(Për HTTPS dhe emër më të bukur, shiko PJESA 9.)

---

## PJESA 9 — HTTPS + emër (opsionale, për dokumentim)

1. Blej / përdor domain (ose subdomain falas në disa shërbime)
2. **Cloudflare** (falas) → DNS → IP e serverit
3. Në server instal **Caddy** ose **Nginx** si reverse proxy:
   - `https://tkk.example.com` → `localhost:5500`

Kjo nuk është e detyrueshme për detyrë, por duket profesionale.

---

## PJESA 10 — Çfarë të shkruash në dokumentim

1. **Arkitektura:** Shfletues → `serve.js` (Node) → proxy `/geoserver` → GeoServer  
2. **Deploy:** Oracle Cloud Always Free, Docker Compose  
3. **URL:** `http://IP_PUBLIKE:5500` (ose HTTPS)  
4. **Mobil (7.2):** layout responsiv, screenshot telefon me linkun publik  
5. **GitHub:** linku i repo-së (kapitulli 8)

---

## Probleme të shpeshta

| Simptom | Zgjidhja |
|---------|----------|
| Nuk lidhet fare | Porti 5500 në Security List Oracle + `ufw` |
| Faqja OK, harta bosh | GeoServer pa workspace `tkk` — rishiko PJESËN 5 |
| `502` te `/geoserver` | `docker compose logs geoserver` — a është UP? |
| Shumë ngadalë | VM falas — prit ngarkimin e parë |

---

## Komanda të dobishme (mirëmbajtje)

```bash
cd ~/webgis-kosove-tkk
docker compose logs -f web
docker compose restart
docker compose pull && docker compose up -d --build
```

---

## Nëse Oracle është shumë i vështirë

Pyet profesorin për **server universiteti** ose hostim GeoServer — shpesh është më i shpejtë për detyrë.

---

**Skedarë në projekt:** `docker-compose.yml`, `web/Dockerfile`, `web/package.json`, `DEPLOY-SQ.md`
