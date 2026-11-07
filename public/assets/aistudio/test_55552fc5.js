// Быстрый самотест: node test.js  (без ключей нейросети, на запасном генераторе)
process.env.DATA_DIR = require('os').tmpdir() + '/virt-rpl-test-' + Date.now();
process.env.START = '1'; process.env.PORT = 3999; process.env.ADMIN_CODE = 'TEST-ADMN';
const { db } = require('./server.js');
const B = 'http://localhost:3999/api'; let tok = '';
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', 'x-token': tok }, body: b ? JSON.stringify(b) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + JSON.stringify(j)); return j; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await sleep(400);
  tok = (await call('POST', '/login', { code: 'TEST-ADMN' })).token;
  await call('POST', '/admin/settings', { secPerMin: 0.01, breakSec: 0.01 });
  const ov = await call('GET', '/admin/overview'); const rpl = ov.teams.filter(t => t.comp === 'rpl'); console.log('РПЛ команд', rpl.length, 'коды есть', rpl.every(t => t.code));
  const pos = ['ВР', 'ЦЗ', 'ЦЗ', 'ЛЗ', 'ПЗ', 'ОП', 'ЦП', 'ЦП', 'ЛВ', 'ПВ', 'ЦФ', 'ВР', 'ЦЗ', 'ЦП', 'ЦФ', 'ПВ'];
  for (const t of rpl.slice(0, 2)) { const names = pos.map((x, i) => `${t.name} Игрок${i + 1}`).join('\n'); const r = await call('POST', '/admin/import', { teamId: t.id, names }); console.log('импорт', t.name, r.added); }
  const pl = await call('GET', '/admin/players'); for (const p of pl) { const i = +p.name.match(/(\d+)$/)[1] - 1; await call('POST', '/admin/player', { id: p.id, pos: pos[i] }); }
  const sea = await call('POST', '/admin/season', { start: '2026-11-07', name: '2026/27' }); console.log('матчей в сезоне', sea.fixtures);
  const fx = await call('GET', '/fixtures?comp=rpl'); console.log('RPL тур1:', fx.filter(f => f.round === 1).map(f => `${f.homeName}-${f.awayName} ${f.date} ${f.time}`).slice(0, 3));
  const m = fx.find(f => f.full); console.log('есть полный матч между командами с составом:', !!m, m && m.homeName + '-' + m.awayName);
  console.log('derby флаги тур1:', fx.filter(f => f.round === 1 && f.derby).length);
  const run = await call('POST', '/admin/run', { fid: m.id }); console.log('запуск', run);
  for (let i = 0; i < 90; i++) { await sleep(1000); const x = (await call('GET', '/fixtures?comp=rpl')).find(z => z.id === m.id); if (x.status === 'done') break; }
  const md = await call('GET', '/match/' + m.id); console.log('статус', md.fixture.status, 'счёт', md.fixture.hg + ':' + md.fixture.ag, 'событий', md.events.length);
  console.log('владение', md.stats.poss, 'удары', md.stats.teams.home.sh, md.stats.teams.away.sh, 'xG', md.stats.teams.home.xg, md.stats.teams.away.xg, 'угл', md.stats.teams.home.co, md.stats.teams.away.co, 'игроков', Object.keys(md.stats.players).length);
  console.log('пример события', md.events.slice(1, 3).map(e => `${e.min}' [${e.type}] ${e.text}`));
  const tb = await call('GET', '/table/rpl'); console.log('таблица топ-2', tb.slice(0, 2).map(r => `${r.name} ${r.pts} ${r.gf}-${r.ga}`));
  const ld = await call('GET', '/leaders?comp=rpl'); console.log('лидеры: игроков', ld.players.length, 'команд', ld.teams.length, 'бомбардир', ld.players.sort((a, b) => b.g - a.g)[0]);
  const lu = await call('GET', '/admin/lineups/' + m.id); console.log('автосостав', lu.home.starters.length, lu.home.formation);
  process.exit(0);
})().catch(e => { console.error('ТЕСТ УПАЛ:', e.message); process.exit(1); });
