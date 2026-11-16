// Regras da fila e do ranking. Usado pelo site principal (index.html) e pela página de visualização (ver.html).
export const TEMPO_ESPERA_MS = 30 * 60 * 1000;
export const TOLERANCIA_MUSICAS = 1;

export function songsSung(db, clientId) {
  return db.performances.filter(p => p.clientId === clientId).length;
}

export function mesaDe(db, clientId) {
  const c = db.clients.find(x => x.id === clientId);
  return c && c.mesa ? String(c.mesa) : 'sem-mesa';
}

// Ordem da fila (nesta ordem de prioridade):
// 1) quem está no palco;
// 2) quem espera há 30 minutos ou mais (o mais antigo primeiro);
// 3) a primeira pessoa de cada mesa que ainda não cantou;
// 4) rodadas: entre quem tem a menor quantidade de músicas (com tolerância de 1),
//    alterna as mesas: a mesa que cantou há mais tempo vai primeiro;
// 5) ausentes, por último.
export function ordenarFila(db, now = Date.now()) {
  const byEntry = (a, b) => a.addedAt - b.addedAt;
  const out = [];

  // Mesas que já tiveram alguém cantando
  const mesasQueCantaram = new Set(db.performances.map(p => mesaDe(db, p.clientId)));
  // Última vez que cada mesa cantou (0 = nunca); vai sendo atualizado conforme a ordem é montada
  const mesaLast = {};
  db.performances.forEach(p => {
    const m = mesaDe(db, p.clientId);
    mesaLast[m] = Math.max(mesaLast[m] || 0, p.at);
  });
  let virtual = 1e15;
  const place = q => { out.push(q); mesaLast[mesaDe(db, q.clientId)] = virtual++; };

  const onStage = db.queue.filter(q => q.onStage);
  const absent = db.queue.filter(q => q.absent && !q.onStage).sort((a, b) => (a.absentAt || 0) - (b.absentAt || 0));
  let rest = db.queue.filter(q => !q.onStage && !q.absent);

  onStage.forEach(place);

  // 2) espera longa
  const longWait = rest.filter(q => now - (q.waitSince || q.addedAt) >= TEMPO_ESPERA_MS).sort(byEntry);
  longWait.forEach(place);
  rest = rest.filter(q => !out.includes(q));

  // 3) primeira pessoa de cada mesa nova
  const novasVistas = new Set();
  [...rest].sort(byEntry).forEach(q => {
    const m = mesaDe(db, q.clientId);
    if (!mesasQueCantaram.has(m) && !novasVistas.has(m)) { novasVistas.add(m); place(q); }
  });
  rest = rest.filter(q => !out.includes(q));

  // 4) rodadas por quantidade de músicas, alternando as mesas
  while (rest.length) {
    const min = Math.min(...rest.map(q => songsSung(db, q.clientId)));
    const band = rest.filter(q => songsSung(db, q.clientId) <= min + TOLERANCIA_MUSICAS).sort(byEntry);
    while (band.length) {
      let best = 0;
      for (let i = 1; i < band.length; i++) {
        const la = mesaLast[mesaDe(db, band[i].clientId)] || 0;
        const lb = mesaLast[mesaDe(db, band[best].clientId)] || 0;
        if (la < lb) best = i;
      }
      place(band.splice(best, 1)[0]);
    }
    rest = rest.filter(q => !out.includes(q));
  }

  // 5) ausentes
  absent.forEach(q => out.push(q));
  return out;
}

// Ranking: maior nota primeiro; em empate, quem cantou antes fica na frente
export function ordenarRanking(db) {
  return [...db.performances].sort((a, b) => b.score - a.score || a.at - b.at);
}
