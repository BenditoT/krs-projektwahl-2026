/**
 * KRS Projektwahl — Verteilungs-Algorithmus
 * 
 * Algorithmus: Random Serial Dictatorship (RSD) mit Seed
 * Fairness-garantiert, strategiesicher, reproduzierbar.
 * 
 * Verwendung:
 *   const algo = new VerteilungsAlgorithmus();
 *   const ergebnis = algo.verteile({
 *     schueler: [...],  // Array von Schüler-Objekten mit code, klassenstufe, wahlen
 *     projekte: [...],  // Array von Projekt-Objekten mit id, max_plaetze, min_klasse, max_klasse
 *     seed: 'optional-seed-string'
 *   });
 */

class VerteilungsAlgorithmus {
  
  /**
   * Erzeugt einen deterministischen Zufallsgenerator (PRNG) aus einem Seed.
   * Wichtig: JS Math.random ist NICHT seedbar, deshalb eigene Implementierung.
   * Uses the "Mulberry32" PRNG algorithm — einfach und ausreichend.
   */
  _createPRNG(seedString) {
    // String → int Hash
    let h = 1779033703 ^ seedString.length;
    for (let i = 0; i < seedString.length; i++) {
      h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let seed = h ^ (h >>> 16);
    
    // Mulberry32
    return function() {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  
  /**
   * Fisher-Yates Shuffle mit seeded PRNG
   */
  _shuffle(array, prng) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  /**
   * Generiert einen Default-Seed aus aktuellem Zeitpunkt
   */
  _generateSeed() {
    return `krs-${new Date().toISOString()}-${Math.random().toString(36).substr(2, 6)}`;
  }
  
  /**
   * Pre-Flight-Check: Validiert Input vor der Verteilung
   * Gibt Warnungen und Fehler zurück, ohne zu verteilen
   */
  preFlightCheck({ schueler, projekte }) {
    const ergebnis = {
      ok: true,
      warnungen: [],
      fehler: []
    };
    
    // 1. Plausibilität
    const summePlaetze = projekte.reduce((sum, p) => sum + p.max_plaetze, 0);
    const anzahlSchueler = schueler.length;
    
    if (summePlaetze < anzahlSchueler) {
      ergebnis.fehler.push({
        code: 'nicht_genug_plaetze',
        message: `Nur ${summePlaetze} Plätze für ${anzahlSchueler} Schüler — ${anzahlSchueler - summePlaetze} Plätze fehlen!`
      });
      ergebnis.ok = false;
    }
    
    // 2. Haben alle Schüler Wahlen abgegeben?
    const ohneWahlen = schueler.filter(s => !s.wahlen || !s.wahlen.erstwahl_id);
    if (ohneWahlen.length > 0) {
      ergebnis.warnungen.push({
        code: 'schueler_ohne_wahlen',
        message: `${ohneWahlen.length} Schüler haben keine Wahlen abgegeben`,
        details: ohneWahlen.map(s => s.code)
      });
    }
    
    // 3. Überbuchte Projekte (Erstwahl > Kapazität)
    const erstWahlCounts = {};
    schueler.forEach(s => {
      if (s.wahlen?.erstwahl_id) {
        erstWahlCounts[s.wahlen.erstwahl_id] = (erstWahlCounts[s.wahlen.erstwahl_id] || 0) + 1;
      }
    });
    
    const ueberbucht = projekte.filter(p => (erstWahlCounts[p.id] || 0) > p.max_plaetze);
    if (ueberbucht.length > 0) {
      ergebnis.warnungen.push({
        code: 'projekte_ueberbucht',
        message: `${ueberbucht.length} Projekte sind als Erstwahl überbucht`,
        details: ueberbucht.map(p => ({
          titel: p.titel,
          plaetze: p.max_plaetze,
          erstwahl: erstWahlCounts[p.id]
        }))
      });
    }
    
    // 4. Unterbuchte Projekte (weniger Wünsche als min_teilnehmer)
    const allWahlCounts = {};
    schueler.forEach(s => {
      if (s.wahlen?.erstwahl_id) allWahlCounts[s.wahlen.erstwahl_id] = (allWahlCounts[s.wahlen.erstwahl_id] || 0) + 1;
      if (s.wahlen?.zweitwahl_id) allWahlCounts[s.wahlen.zweitwahl_id] = (allWahlCounts[s.wahlen.zweitwahl_id] || 0) + 1;
      if (s.wahlen?.drittwahl_id) allWahlCounts[s.wahlen.drittwahl_id] = (allWahlCounts[s.wahlen.drittwahl_id] || 0) + 1;
    });
    
    const unterbucht = projekte.filter(p => {
      const gesamtWuensche = allWahlCounts[p.id] || 0;
      return gesamtWuensche < (p.min_teilnehmer || 0);
    });
    if (unterbucht.length > 0) {
      ergebnis.warnungen.push({
        code: 'projekte_unterbucht',
        message: `${unterbucht.length} Projekte haben weniger Wünsche als Mindest-Teilnehmer`,
        details: unterbucht.map(p => ({
          titel: p.titel,
          min_teilnehmer: p.min_teilnehmer,
          wuensche: allWahlCounts[p.id] || 0
        }))
      });
    }
    
    return ergebnis;
  }
  
  /**
   * Hauptverteilung via Random Serial Dictatorship
   * 
   * @param {Object} input
   * @param {Array} input.schueler - [{ code, klassenstufe, wahlen: {erstwahl_id, zweitwahl_id, drittwahl_id} }]
   * @param {Array} input.projekte - [{ id, max_plaetze, min_klasse, max_klasse, titel }]
   * @param {String} input.seed - optional, für Reproduzierbarkeit
   * @returns {Object} { zuteilungen, nicht_zugeteilt, statistik, seed, belegung }
   */
  verteile({ schueler, projekte, seed }) {
    const verwendeterSeed = seed || this._generateSeed();
    const prng = this._createPRNG(verwendeterSeed);
    
    // Nur Schüler mit Wahlen verteilen
    const mitWahlen = schueler.filter(s => s.wahlen?.erstwahl_id);
    const ohneWahlen = schueler.filter(s => !s.wahlen?.erstwahl_id);
    
    // Zufallsreihenfolge mit Seed
    const reihenfolge = this._shuffle(mitWahlen, prng);
    
    // Projekt-Lookup
    const projekteMap = {};
    projekte.forEach(p => { projekteMap[p.id] = p; });
    
    // Belegung tracken
    const belegung = {};
    projekte.forEach(p => { belegung[p.id] = 0; });
    
    // Ergebnisse
    const zuteilungen = [];
    const nichtZugeteilt = [];
    
    // RSD-Hauptschleife
    reihenfolge.forEach((schuelerObj, idx) => {
      const wahlen = [
        { id: schuelerObj.wahlen.erstwahl_id, nr: 1 },
        { id: schuelerObj.wahlen.zweitwahl_id, nr: 2 },
        { id: schuelerObj.wahlen.drittwahl_id, nr: 3 }
      ];
      
      let zugeteilt = false;
      for (const wahl of wahlen) {
        const projekt = projekteMap[wahl.id];
        if (!projekt) continue;
        
        // Klassenstufe passt?
        if (schuelerObj.klassenstufe < projekt.min_klasse || schuelerObj.klassenstufe > projekt.max_klasse) {
          continue;
        }
        
        // Platz frei?
        if (belegung[projekt.id] < projekt.max_plaetze) {
          zuteilungen.push({
            schueler_code: schuelerObj.code,
            projekt_id: projekt.id,
            projekt_titel: projekt.titel,
            wahl_nr: wahl.nr,
            position_in_reihenfolge: idx + 1
          });
          belegung[projekt.id]++;
          zugeteilt = true;
          break;
        }
      }
      
      if (!zugeteilt) {
        nichtZugeteilt.push({
          schueler_code: schuelerObj.code,
          klassenstufe: schuelerObj.klassenstufe,
          wahlen_voll: wahlen.map(w => {
            const p = projekteMap[w.id];
            return {
              wahl_nr: w.nr,
              projekt_titel: p?.titel || 'Unbekannt',
              passt_klassenstufe: p ? (schuelerObj.klassenstufe >= p.min_klasse && schuelerObj.klassenstufe <= p.max_klasse) : false,
              belegung: p ? `${belegung[p.id]}/${p.max_plaetze}` : '?'
            };
          })
        });
      }
    });
    
    // Ohne-Wahlen ebenfalls auflisten
    ohneWahlen.forEach(s => {
      nichtZugeteilt.push({
        schueler_code: s.code,
        grund: 'hat_nicht_gewaehlt'
      });
    });
    
    // Statistik
    const statistik = {
      gesamt_schueler: schueler.length,
      mit_wahlen: mitWahlen.length,
      ohne_wahlen: ohneWahlen.length,
      zugeteilt: zuteilungen.length,
      nicht_zugeteilt: nichtZugeteilt.length - ohneWahlen.length,
      erstwahl: zuteilungen.filter(z => z.wahl_nr === 1).length,
      zweitwahl: zuteilungen.filter(z => z.wahl_nr === 2).length,
      drittwahl: zuteilungen.filter(z => z.wahl_nr === 3).length,
      prozent_erstwahl: mitWahlen.length > 0 ? Math.round((zuteilungen.filter(z => z.wahl_nr === 1).length / mitWahlen.length) * 100) : 0,
      prozent_zweitwahl: mitWahlen.length > 0 ? Math.round((zuteilungen.filter(z => z.wahl_nr === 2).length / mitWahlen.length) * 100) : 0,
      prozent_drittwahl: mitWahlen.length > 0 ? Math.round((zuteilungen.filter(z => z.wahl_nr === 3).length / mitWahlen.length) * 100) : 0
    };
    
    return {
      seed: verwendeterSeed,
      zuteilungen,
      nicht_zugeteilt: nichtZugeteilt,
      belegung,
      projekte_auslastung: projekte.map(p => ({
        id: p.id,
        titel: p.titel,
        belegt: belegung[p.id],
        max: p.max_plaetze,
        min_teilnehmer: p.min_teilnehmer || 0,
        unter_minimum: belegung[p.id] < (p.min_teilnehmer || 0)
      })),
      statistik,
      zeitpunkt: new Date().toISOString()
    };
  }
  
  /**
   * 1:1-Tausch-Erkennung: Finde Paare, die sich gegenseitig gutbringen könnten
   */
  findeEinsZuEinsTauschpartner(tauschwuensche) {
    const paare = [];
    const bereitsVerwendet = new Set();
    
    for (let i = 0; i < tauschwuensche.length; i++) {
      if (bereitsVerwendet.has(tauschwuensche[i].id)) continue;
      
      for (let j = i + 1; j < tauschwuensche.length; j++) {
        if (bereitsVerwendet.has(tauschwuensche[j].id)) continue;
        
        const t1 = tauschwuensche[i];
        const t2 = tauschwuensche[j];
        
        // Perfekter 1:1-Tausch: A will in B's Projekt, B will in A's Projekt
        if (t1.von_projekt_id === t2.nach_projekt_id 
            && t1.nach_projekt_id === t2.von_projekt_id) {
          paare.push({
            tausch1_id: t1.id,
            tausch2_id: t2.id,
            schueler1_code: t1.schueler_code,
            schueler2_code: t2.schueler_code,
            von_projekt: t1.von_projekt_titel,
            nach_projekt: t1.nach_projekt_titel
          });
          bereitsVerwendet.add(t1.id);
          bereitsVerwendet.add(t2.id);
        }
      }
    }
    
    return paare;
  }
}

// Export für ES-Module (Browser)
if (typeof window !== 'undefined') {
  window.VerteilungsAlgorithmus = VerteilungsAlgorithmus;
}

// Export für Node.js (falls Tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VerteilungsAlgorithmus;
}
