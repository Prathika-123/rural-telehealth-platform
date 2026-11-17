# Rural Telehealth and Medicine Availability Platform

Status: **Phases 1 to 4 written. The Java backend has not yet been compiled or run; the frontend has been tested in a simulated browser (jsdom), not yet in a real one.** See "Verification status" below.

Frontend: plain HTML5, CSS3 and JavaScript (no framework, no build step, no libraries). Backend: Java 21, Spring Boot 3, MySQL.
Docker, Kubernetes and GitHub are intentionally out of scope for now.

## Prerequisites
- JDK 21, Maven 3.9+
- MySQL 8.0.16 or newer (CHECK constraints such as `quantity >= 0` are enforced from this version)

## Configuration (environment variables, nothing is hardcoded)
| Variable | Required | Purpose |
|---|---|---|
| `DB_USERNAME`, `DB_PASSWORD` | yes | MySQL login |
| `JWT_SECRET` | yes | Signing key, at least 32 characters (`openssl rand -base64 48`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | recommended | Creates the first admin if none exists |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | no | Default `localhost`, `3306`, `rural_health` |
| `JWT_EXPIRATION_MINUTES`, `CORS_ALLOWED_ORIGINS`, `DDL_AUTO` | no | Defaults: `60`, localhost origins, `update` |
| `SEARCH_DEFAULT_RADIUS_KM`, `SEARCH_MAX_RADIUS_KM`, `STALE_AFTER_DAYS`, `LOW_STOCK_THRESHOLD` | no | Defaults: `10`, `50`, `7`, `10` |
| `CACHE_TYPE`, `REDIS_HOST`, `REDIS_PORT` | no | Default `simple` (in-memory). Use `CACHE_TYPE=redis` when Redis is running |
| `APP_TIMEZONE` | no | Time zone used for doctor timetables. Default `Asia/Kolkata` |
| `SAMPLE_DATA_PASSWORD` | only for sample data | Password for the demo accounts (min 8 chars) |

Linux/macOS:
```
export DB_USERNAME=root DB_PASSWORD=yourpass JWT_SECRET="$(openssl rand -base64 48)"
export ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMe123
```
Windows PowerShell: `$env:DB_USERNAME="root"; $env:DB_PASSWORD="yourpass"; ...`

## Run
```
cd backend
mvn spring-boot:run
```
Hibernate creates the tables on first start. Alternatively run `database/schema.sql` yourself and start with `DDL_AUTO=none`.

## Run the tests (no MySQL needed, they use in-memory H2)
```
cd backend
mvn test
```

## Try the API
```
curl -X POST localhost:8080/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Asha","email":"asha@example.com","password":"Strong123","role":"USER","language":"kn"}'

curl -X POST localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"asha@example.com","password":"Strong123"}'

curl localhost:8080/api/v1/users/me -H "Authorization: Bearer <token>"
curl "localhost:8080/api/v1/admin/users?page=0&size=10" -H "Authorization: Bearer <admin-token>"
```

## Phase 1 endpoints
| Method and path | Access |
|---|---|
| `POST /api/v1/auth/register` (roles USER, PHARMACY, HEALTHCARE_PROVIDER only) | Public |
| `POST /api/v1/auth/login` | Public |
| `GET, PUT /api/v1/users/me`, `PUT /api/v1/users/me/language` | Logged in |
| `GET /api/v1/admin/users?role=&page=&size=` | ADMIN |
| `PATCH /api/v1/admin/users/{id}/enabled` | ADMIN |

Errors always look like `{timestamp, status, code, message, fieldErrors?}`.

## Demo data (optional, fictional)
```
export SAMPLE_DATA_PASSWORD=ChooseSomething123
SPRING_PROFILES_ACTIVE=sample mvn spring-boot:run
```
Creates fictional "Sample ..." pharmacies, centres, medicines and doctors ("Dr. Sample ...") around Kundapura and Udupi (idempotent, safe to restart; doctors are added even if you loaded the Phase 2 data earlier).
**Everything in it is made up. It is not real healthcare data.** Accounts (all use `SAMPLE_DATA_PASSWORD`):
`sample.user@example.com`, `sample.pharmacy1..4@example.com` (pharmacy 4 is unverified on purpose),
`sample.provider1..2@example.com`. Try a search near Kundapura:
```
curl "localhost:8080/api/v1/medicines/search?q=Paracetamol&lat=13.6264&lng=74.6930&radiusKm=40"
curl "localhost:8080/api/v1/centres/nearby?lat=13.6264&lng=74.6930&radiusKm=40&type=HOSPITAL"
```

## Phase 2 endpoints
| Method and path | Access |
|---|---|
| `GET /api/v1/medicines/search?q=&strength=&lat=&lng=&radiusKm=&page=&size=` | Public |
| `GET /api/v1/medicines/suggest?q=` | Public |
| `GET /api/v1/pharmacies/{id}`, `GET /api/v1/pharmacies/{id}/medicines` (verified pharmacies only) | Public |
| `POST /api/v1/pharmacies/register`, `GET, PUT /api/v1/pharmacies/me` | PHARMACY |
| `GET, POST /api/v1/pharmacies/me/inventory`, `PUT, DELETE .../{id}`, `PATCH .../{id}/unavailable` | PHARMACY (own rows only) |
| `GET /api/v1/centres/nearby?lat=&lng=&radiusKm=&type=`, `GET /api/v1/centres/{id}`, `GET /api/v1/centres/services` | Public |
| `POST /api/v1/centres`, `PUT /api/v1/centres/{id}`, `GET /api/v1/centres/mine` | HEALTHCARE_PROVIDER (own centres only) |
| `GET, POST, PUT, DELETE /api/v1/admin/medicines` | ADMIN |
| `GET /api/v1/admin/pharmacies`, `PATCH .../{id}/verify` and the same for `/admin/centres` | ADMIN |
| `POST /api/v1/admin/services` | ADMIN |

Search response `status` is `RESULTS`, `NO_PHARMACY_NEARBY` or `MEDICINE_NOT_FOUND`.

## How the main rules work
- **Only VERIFIED pharmacies and centres are public.** New registrations are PENDING until an admin verifies them.
  Changing a pharmacy's licence number or location, or a centre's location or type, sends it back to PENDING.
- **Medicine search:** match name (and strength) and keep rows that are available, quantity > 0 and verified, inside a
  bounding box (indexed SQL), then exact Haversine distance, radius filter, sort nearest first, paginate.
  Typing "Paracetamol 500mg" is split into name and strength automatically.
- **Honest stock information:** the public sees IN_STOCK / LOW_STOCK only, never exact counts. Every row carries
  `lastUpdatedAt` and a `stale` flag (not updated for 7+ days, configurable). The owner's exact quantity is private.
- **Location is never stored or cached.** Coordinates are used for one request and discarded. For that reason, and so
  stock is never served out of date, search results are not cached. Redis/in-memory caching is used only for the
  location-free medicine autocomplete, and is cleared whenever the catalogue changes. If Redis is down, the app logs a
  warning and reads from MySQL instead of failing.
- **Negative stock is impossible:** request validation, entity validation and a database CHECK constraint.

## Phase 3 endpoints
| Method and path | Access |
|---|---|
| `GET /api/v1/doctors/search?name=&specialization=&centreId=&lat=&lng=&radiusKm=&availableNow=&page=&size=` | Public |
| `GET /api/v1/doctors/{id}` (details, timetable, computed availability) | Public |
| `GET /api/v1/doctors/mine` | HEALTHCARE_PROVIDER |
| `POST /api/v1/doctors`, `PUT, DELETE /api/v1/doctors/{id}` | HEALTHCARE_PROVIDER (own centres only) |
| `PUT /api/v1/doctors/{id}/schedules` (replaces the weekly timetable) | HEALTHCARE_PROVIDER |
| `PATCH /api/v1/doctors/{id}/availability` (temporary override with expiry) | HEALTHCARE_PROVIDER |
| `GET /api/v1/symptoms?lang=`, `GET /api/v1/symptoms/{id}?lang=`, `GET /api/v1/symptoms/emergency?lang=` | Public |

## How doctor availability works
Availability is never stored. It is computed on every request, in the configured time zone:
1. An unexpired manual override set by the clinic wins (`source: MANUAL_OVERRIDE`). An override must have an expiry, at most 7 days ahead.
2. Otherwise the weekly timetable decides (`source: SCHEDULE`). A slot includes its start time and excludes its end time.
3. A doctor with no timetable is shown as unavailable with `source: NO_SCHEDULE`. Availability is never guessed.
Each response also carries `nextSlot` and `lastUpdatedAt`, so the screen can say when the doctor is next in and how fresh the data is.
Timetable rules: a slot must end after it starts, slots on one day must not overlap (even at different centres), no overnight slots.
A provider can only schedule a doctor at centres they manage. Doctors at unverified centres are hidden from the public.

## Symptom information: IMPORTANT
Content is in `backend/src/main/resources/symptoms/symptoms-{en,kn,hi}.json`. It is educational only: no diagnosis, no medicine names, no doses.
**It is a draft written from widely published general advice. It has NOT been reviewed by a clinician, and the Kannada and Hindi text has NOT been reviewed by a native speaker.**
Every file and every API response carries `reviewStatus: DRAFT_NOT_MEDICALLY_REVIEWED`, and the frontend must show it. Before any real-world use:
- have a qualified medical professional check every statement against current official guidance, then update `reviewStatus`;
- have native speakers check the Kannada and Hindi wording;
- confirm the emergency numbers (112, and 108 for ambulances) for your region;
- decide whether mentioning oral rehydration solution (ORS) under diarrhoea fits your policy on naming products.
The application refuses to start if any language is missing a symptom, so a half-translated page can never be served.

## Languages (frontend)
`frontend/js/i18n/{en,kn,hi}.json` hold all interface text and the translated backend error messages (`error.<CODE>`).
`frontend/js/i18n.js` loads them, falls back to English for a missing key, remembers the choice in `localStorage`, and exposes
`I18n.t(key, params)`, `I18n.error(code, serverMessage)`, `I18n.speechLocale()` (for the Web Speech API) and `I18n.mountSelector(select)`.
HTML uses `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` and `data-i18n-aria-label` attributes.
Run the translation tests with `node --test frontend/tests/i18n.test.js`.

## Phase 4: the frontend
Start the backend (see "Run"), then open **http://localhost:8080/**. Spring Boot serves the `frontend/` folder directly, so there is no CORS setup and no build step.
To host the frontend elsewhere, edit `frontend/js/config.js` (`apiBase`) and add that origin to `CORS_ALLOWED_ORIGINS`.

| Page | File | Who |
|---|---|---|
| Landing | `index.html` | everyone |
| Registration, login | `register.html`, `login.html` | everyone |
| User dashboard, profile and settings | `dashboard.html`, `profile.html` | logged in |
| Medicine search and availability results (one page) | `medicine-search.html` | everyone |
| Pharmacy details | `pharmacy-details.html?id=` | everyone |
| Healthcare centre locator | `centres.html` | everyone |
| Doctor search, doctor details | `doctors.html`, `doctor-details.html?id=` | everyone |
| Symptom information with emergency guidance | `symptoms.html` | everyone |
| Voice assistant | `voice.html` | everyone |
| Pharmacy dashboard, inventory management | `pharmacy-dashboard.html`, `inventory.html` | PHARMACY |
| Healthcare provider dashboard (centres, doctors, timetables, availability) | `provider-dashboard.html` | HEALTHCARE_PROVIDER |
| Admin dashboard (statistics, stock activity, users and providers, verification, medicine catalogue) | `admin.html` | ADMIN |

That is 16 files for the 17 pages in the brief: the medicine search page and the results page are one page, so results appear under the search box without a reload.

How it is built:
- `js/ui.js` builds elements with `textContent` only, so text from the server can never inject markup. `js/api.js` is the REST client, `js/auth.js` the session, `js/layout.js` the shell, `js/components.js` the shared parts (location panel, microphone button, availability block).
- **Maps** (`js/map.js`) are written in plain JavaScript: OpenStreetMap tiles, drag to pan, + / - buttons, wheel and keyboard zoom, markers with popups, and click-to-choose-a-place. No Leaflet. It is a deliberate trade-off against the "HTML, CSS, JavaScript only" rule. Pinch-to-zoom is not implemented. OpenStreetMap's public tile server is for light use and needs the attribution the map shows; for heavy traffic switch `tileUrl` in `config.js` to a tile provider.
- **Location**: used per request and kept only in the browser tab's `sessionStorage`; never saved to the account. If permission is denied or GPS is unavailable, the page opens the map so the person can choose a place instead.
- **Voice** (`js/voice.js`): speech to text and read-aloud use the browser's Web Speech API. Recognition works in Chrome and Edge and sends audio to the browser vendor's service (the pages say so). If the browser has no recognition, no microphone button is drawn, only a note, and typing works everywhere. Read-aloud is offered only when the device really has a voice for the chosen language, because Kannada voices are often missing; otherwise the page says so rather than speaking in a wrong voice. The spoken words are shown in a box and confirmed with Search; they are never submitted automatically.
- **Sample data** is labelled in the pages ("Sample data" badge on every record named "Sample ..." and a footer note while `demoMode` is true in `config.js`).
- Icons are emoji, so there are no image files. Fonts are system fonts with Kannada and Devanagari fallbacks (no external font requests).
- **Admin "manage healthcare providers"** is the Users tab filtered by role plus the Centres tab (verification). Admin editing of individual doctors is not built.

### Running the frontend tests
```
cd frontend-tests
npm install        # only installs jsdom, used by the tests
npm test
```
The tests live outside `frontend/` on purpose, because Spring serves that folder publicly.

## Verification status (please read)
The development sandbox has no access to Maven Central, so **`mvn test` has not been run for any phase**.

Actually executed:
- Backend logic that has no Spring dependency: Haversine and bounding box (16 checks), doctor availability and timetable rules (20 scenarios). All pass.
- **Frontend: 46 tests, all passing.** They load every real page with its real scripts and the real translation files into jsdom (a simulated browser), with only the backend API stubbed. They cover login and registration, role guards, medicine search (including a markup-injection attempt), the location fallback to the map, voice with a fake recognition engine, doctors and centres, symptoms using the real content files, profile, the pharmacy, inventory, provider and admin workflows, translations in all three languages, and an accessibility audit (named controls, one heading per page, landmarks, ARIA references) on all 16 pages in English and Kannada.
- Running these tests found and fixed real defects: transcripts keeping a trailing full stop, a map click computing the wrong place when the map size was unknown, a failed page load wiping out the whole page including its heading, and detail pages with no heading when loading failed.

NOT verified:
- **No real browser has been used.** Visual layout and CSS, the map's real-world touch behaviour, real speech recognition and read-aloud, and real geolocation are untested. Colour contrast has not been measured. Please open every page on a phone-sized screen and on a desktop.
- The Java side beyond syntax checks: 66 JUnit tests, Spring startup, Hibernate on MySQL and the JPQL queries.
- The Kannada and Hindi text has not been reviewed by native speakers, and the symptom content has not been reviewed by a clinician.
