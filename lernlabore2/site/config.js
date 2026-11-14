// =====================================================================
// Online-Lernlabore 2.0 – Verbindung zum Server
//
// Diese Datei liegt als site/config.js neben den Webseiten.
// Solange supabaseUrl und supabaseAnonKey leer sind, laufen alle Seiten
// im DEMO-MODUS (fiktive Daten, nichts wird online gespeichert).
//
// WICHTIG: Hier gehört NUR der öffentliche Schlüssel hin („anon public“
// bzw. „Publishable key“). Der geheime „service_role“-/„Secret key“
// darf NIEMALS in diese Datei oder in GitHub!
// =====================================================================
window.LERNLABOR_CONFIG = {
  // z. B. 'https://abcdefghijklmnop.supabase.co'
  supabaseUrl: '',
  // Supabase → Project Settings → API Keys → „anon public“ / „Publishable key“
  supabaseAnonKey: '',
  // 'auto' = online, sobald beide Werte eingetragen sind; 'demo' erzwingt den Demo-Modus
  mode: 'auto',
  // 'tab' = Anmeldung endet beim Schließen des Tabs (empfohlen für geteilte Schulgeräte)
  // 'device' = Anmeldung bleibt bis zum Abmelden bestehen (max. 12 Stunden)
  sessionPersistence: 'tab',
  // Optional sichtbarer Hinweis, z. B. 'TESTSYSTEM – keine echten Schülerdaten'
  environmentLabel: ''
};
