-- ============================================================
-- KRS Projektwahl 2026 — Beispielprojekt „Makerspace"
-- ------------------------------------------------------------
-- In Supabase Dashboard → SQL Editor → New query → einfügen →
-- RUN. Das INSERT ist idempotent: existiert bereits ein
-- Projekt mit dem Titel „Makerspace", wird kein Duplikat
-- angelegt (WHERE NOT EXISTS).
--
-- lehrer_id = Norbert Kotzan (users.id aus Deployment-Memo).
-- Bei Bedarf anpassen. Zum Prüfen:
--   select id, name, email from users
--   where email = 'kotzan@realschule-schriesheim.de';
-- ============================================================

insert into projekte (
  titel,
  kurzbeschreibung,
  lehrer_id,
  max_plaetze,
  min_teilnehmer,
  min_klasse,
  max_klasse,
  status
)
select
  'Makerspace',
  'Im Makerspace bauen wir eigene Projekte mit 3D-Druckern, Lötstation, Mikrocontrollern (Arduino, Micro:bit) und Handwerkzeugen. Ob Roboter, Lampe, Schild oder Musikinstrument – hier entsteht aus deiner Idee ein greifbares Werkstück. Ihr arbeitet in kleinen Teams, lernt den Umgang mit Werkzeugen und nehmt am Ende euer eigenes Projekt mit nach Hause.',
  '952bc971-14d9-5ae3-b0cd-511f37847295'::uuid,  -- Norbert Kotzan
  16,     -- max. 16 Teilnehmer:innen (Sicherheitsgrenze Werkstatt)
  8,      -- min. 8, sonst läuft das Projekt nicht
  7,      -- ab Klasse 7 (Umgang mit Werkzeugen)
  9,      -- bis Klasse 9
  'aktiv'
where not exists (
  select 1 from projekte where titel = 'Makerspace'
)
returning id, titel, status, max_plaetze, min_klasse, max_klasse;

-- Falls der obige Insert 0 Zeilen zurückliefert (= bereits vorhanden),
-- zeigt der folgende Select das bestehende Projekt:
select id, titel, status, max_plaetze, min_klasse, max_klasse
from projekte
where titel = 'Makerspace';
