/* Deployment settings. Edit this file; nothing else needs to change. */
window.RHP_CONFIG = {
  // '' = same origin (Spring Boot serves this folder). If the frontend is hosted elsewhere
  // (for example VS Code Live Server on :5500) use 'http://localhost:8080' and add that origin to CORS_ALLOWED_ORIGINS.
  apiBase: '',
  // Shows a "demo data" note in the footer. Set to false once only real, verified records are loaded.
  demoMode: true,
  // Where maps open before the user's location is known (Kundapura). Change for your region.
  defaultCenter: { lat: 13.6264, lng: 74.6930 },
  // OpenStreetMap's public tile server is for light use and requires the attribution shown on the map.
  // For heavy production traffic use a tile provider or your own tile server.
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  timeZone: 'Asia/Kolkata'
};
