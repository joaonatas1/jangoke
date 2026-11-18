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

// Ordem da fila:
// 1) a primeira pessoa de cada mesa que ainda não cantou vem primeiro;
// 2) o restante segue a ordem de chegada;
// 3) ausentes ficam no fim.
// Quem canta é escolhido manualmente, no botão COMEÇAR de cada cartão.
export function ordenarFila(db) {
  const byEntry = (a, b) => a.addedAt - b.addedAt;
  const mesasQueCantaram = new Set(db.performances.map(p => mesaDe(db, p.clientId)));
  const presentes = db.queue.filter(q => !q.absent).sort(byEntry);
  const ausentes = db.queue.filter(q => q.absent).sort((a, b) => (a.absentAt || 0) - (b.absentAt || 0));

  const novas = [];
  const mesasVistas = new Set();
  presentes.forEach(q => {
    const m = mesaDe(db, q.clientId);
    if (!mesasQueCantaram.has(m) && !mesasVistas.has(m)) { mesasVistas.add(m); novas.push(q); }
  });
  const resto = presentes.filter(q => !novas.includes(q));
  return [...novas, ...resto, ...ausentes];
}

// Ranking: maior nota primeiro; em empate, quem cantou antes fica na frente
export function ordenarRanking(db) {
  return [...db.performances].sort((a, b) => b.score - a.score || a.at - b.at);
}
