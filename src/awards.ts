/**
 * Награды, индивидуальные достижения и сборные:
 * - Лучший игрок матча (MOTM / MVP)
 * - Послематчевое интервью лучшего игрока
 * - Сборная тура (11 лучших игроков по схеме 4-3-3) и игрок тура
 * - Сборная месяца и игрок месяца
 * - Сборная сезона, лучший игрок сезона, тренер сезона и бомбардир
 */

export interface MatchPlayerRating {
  pid: string;
  name: string;
  pos: string;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  side: 'home' | 'away';
  rating: number; // 4.0 - 10.0
  min: number;
  goals: number;
  assists: number;
  saves: number;
  tackles: number;
  shots: number;
  xg: number;
  cleanSheet: number;
  yc: number;
  rc: number;
  highlight: string;
}

export interface MatchMotm {
  pid: string;
  name: string;
  pos: string;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  rating: number;
  interview: {
    headline: string;
    quote: string;
    tacticsComment: string;
    mood: 'euphoric' | 'satisfied' | 'calm' | 'frustrated';
  };
}

export interface TeamOfPeriod {
  title: string;
  periodLabel: string;
  comp: string;
  formation: string; // '4-3-3'
  playerOfThePeriod: MatchPlayerRating;
  coachOfThePeriod: {
    name: string;
    teamName: string;
    teamLogo?: string;
    reason: string;
  };
  lineup: {
    gk: MatchPlayerRating;
    def: MatchPlayerRating[]; // 4 players
    mid: MatchPlayerRating[]; // 3 players
    fwd: MatchPlayerRating[]; // 3 players
  };
  bench: MatchPlayerRating[];
}

/**
 * Расчет индивидуальных оценок игроков за матч
 */
export function computeMatchRatings(m: any, f: any, HName: string, AName: string): MatchPlayerRating[] {
  if (!m || !m.stats || !m.stats.players) return [];

  const homeWin = f.hg > f.ag;
  const awayWin = f.ag > f.hg;
  const draw = f.hg === f.ag;

  const ratings: MatchPlayerRating[] = [];

  for (const [pid, s] of Object.entries<any>(m.stats.players)) {
    if (!s || (s.min || 0) < 10) continue; // Сыграл менее 10 минут

    const isHome = s.side === 'home';
    const won = isHome ? homeWin : awayWin;
    const lost = isHome ? awayWin : homeWin;
    const teamName = isHome ? HName : AName;
    const oppName = isHome ? AName : HName;
    const pos = m.ctx?.pos?.[pid] || 'ПЗ';

    let r = 6.0; // Базовая оценка

    // Минуты на поле
    if (s.min >= 75) r += 0.2;

    // Результат команды
    if (won) r += 0.4;
    else if (lost) r -= 0.3;

    // Голы и ассисты
    if (pos === 'ВР' || pos === 'ЗАЩ') {
      r += (s.g || 0) * 1.5;
    } else {
      r += (s.g || 0) * 1.15;
    }
    r += (s.a || 0) * 0.75;

    // Удары и xG
    r += (s.xg || 0) * 0.4;
    if (s.sh > 3) r += 0.2;

    // Сейвы и сухие матчи вратаря
    if (pos === 'ВР') {
      r += (s.sv || 0) * 0.35;
      if (s.cs) r += 0.9;
      const goalsConceded = isHome ? f.ag : f.hg;
      if (goalsConceded > 2) r -= (goalsConceded - 2) * 0.4;
    }

    // Отборы и сухие матчи защитника
    if (pos === 'ЗАЩ') {
      r += (s.tk || 0) * 0.25;
      if (s.cs && s.min >= 60) r += 0.6;
    }

    // Дисциплина
    if (s.yc) r -= 0.4;
    if (s.rc) r -= 2.0;

    // Фолы
    if ((s.ff || 0) > 3) r -= 0.2;
    if ((s.fa || 0) > 3) r += 0.2;

    // Ограничиваем диапазон 4.0 - 10.0
    const finalRating = Math.max(4.0, Math.min(10.0, +r.toFixed(1)));

    // Формируем яркое действие
    let highlight = '';
    if (s.g >= 3) highlight = `Хет-трик (${s.g} гола)`;
    else if (s.g === 2) highlight = `Дубль в матче`;
    else if (s.g === 1 && s.a >= 1) highlight = `Гол + голевая передача`;
    else if (s.g === 1) highlight = `Забитый мяч`;
    else if (s.a >= 2) highlight = `Ассистентский дубль (${s.a} паса)`;
    else if (s.a === 1) highlight = `Голевая передача`;
    else if (pos === 'ВР' && s.sv >= 5) highlight = `${s.sv} ключевых сейвов`;
    else if (pos === 'ВР' && s.cs) highlight = `Сухой матч`;
    else if (pos === 'ЗАЩ' && s.tk >= 4) highlight = `${s.tk} успешных отбора`;
    else highlight = `Надежная игра в основе (${s.min}')`;

    ratings.push({
      pid,
      name: s.n || 'Игрок',
      pos,
      teamId: s.t,
      teamName,
      side: s.side,
      rating: finalRating,
      min: s.min,
      goals: s.g || 0,
      assists: s.a || 0,
      saves: s.sv || 0,
      tackles: s.tk || 0,
      shots: s.sh || 0,
      xg: s.xg || 0,
      cleanSheet: s.cs || 0,
      yc: s.yc || 0,
      rc: s.rc || 0,
      highlight
    });
  }

  // Сортируем по убыванию рейтинга
  ratings.sort((a, b) => b.rating - a.rating || (b.goals + b.assists) - (a.goals + a.assists) || b.min - a.min);

  return ratings;
}

/**
 * Определение лучшего игрока матча (MOTM) и генерация послематчевого интервью
 */
export function getMatchMotm(m: any, f: any, HName: string, AName: string, coachHome?: any, coachAway?: any): MatchMotm | null {
  const ratings = computeMatchRatings(m, f, HName, AName);
  if (!ratings.length) return null;

  const best = ratings[0];
  const isHome = best.side === 'home';
  const coach = isHome ? coachHome : coachAway;
  const oppCoach = isHome ? coachAway : coachHome;
  const myTeam = best.teamName;
  const oppTeam = isHome ? AName : HName;

  const won = (isHome && f.hg > f.ag) || (!isHome && f.ag > f.hg);
  const draw = f.hg === f.ag;

  let headline = `«${best.name}: залог успеха — выполнение плана на игру»`;
  let quote = '';
  let tacticsComment = '';
  let mood: 'euphoric' | 'satisfied' | 'calm' | 'frustrated' = won ? 'euphoric' : (draw ? 'calm' : 'frustrated');

  if (best.goals >= 2) {
    headline = `«${best.name}: посвящаю этот дубль нашим преданным болельщикам!»`;
    quote = `Эмоции фантастические! Мяч сегодня отлично слушался, партнеры выкатывали передачи прямо под удар. Мы провели колоссальную работу на предматчевых тренировках, и это дало результат.`;
  } else if (best.goals === 1 && won) {
    headline = `«${best.name}: мой гол — это заслуга всей команды»`;
    quote = `Самое главное сегодня — три очка в копилку клуба. Знали, что ${oppTeam} будет биться за каждый метр поля, но мы выдержали темп и реализовали свой шанс.`;
  } else if (best.pos === 'ВР' && (best.saves >= 4 || best.cleanSheet)) {
    headline = `«${best.name}: когда защитники страхуют, ловить кураж намного легче»`;
    quote = `Тяжелейший матч для вратаря. Нападающие соперника постоянно нагружали штрафную и опасно били из любых позиций. Рад, что выручил парней и сохранил ворота в неприкосновенности.`;
  } else if (best.assists >= 1) {
    headline = `«${best.name}: вскрывать такую плотную оборону всегда приятно»`;
    quote = `Тренер перед выходом на поле прямо сказал: ищи свободные коридоры между линиями. Увидел рывок партнера, вложил мяч в ногу — остальное было делом техники.`;
  } else if (won) {
    headline = `«${best.name}: мы доказали, что сильнее и готовы бороться за самые высокие места»`;
    quote = `Победа получилась трудовой. Мы не уступили ни в одном единоборстве и перетерпели все попытки соперника переломить игру.`;
  } else {
    headline = `«${best.name}: результат оставляет осадок, но мы сделали всё возможное»`;
    quote = `Хотелось большего, игра давалась, но реализация немного подвела. Сделаем выводы и в следующем туре выйдем ещё более заряженными.`;
  }

  // Комментарий о тренере и тактике
  if (coach) {
    if (coach.style === 'bus') {
      tacticsComment = `«Установка ${coach.name} была предельно понятна: сыграть строго, компактно у своей штрафной и перекрыть все свободные зоны. Мы "поставили автобус", когда это требовалось, и не дали сопернику ничего создать».`;
    } else if (coach.style === 'attack') {
      tacticsComment = `«${coach.name} с первых минут заряжал нас на атаку. Нам не разрешали прижиматься назад даже при комфортном счёте — требовали бежать вперёд, бить и прессинговать до финального свистка».`;
    } else if (coach.style === 'press') {
      tacticsComment = `«Прессинг отнял много сил, но установка тренера сработала на 100%. Мы буквально задушили ${oppTeam} в центре поля и заставили их ошибаться».`;
    } else if (coach.style === 'possession') {
      tacticsComment = `«Мы владели мячом и диктовали свой ритм. ${coach.name} учит нас терпению — расшатывать чужие оборонительные редуты коротким пасом до верного момента».`;
    } else {
      tacticsComment = `«План на контратаки сработал великолепно. Тренер разобрал слабые зоны соперника, и наши быстрые выпады стали для них полной неожиданностью».`;
    }
  } else {
    tacticsComment = `«Тренерский штаб идеально подготовил нас тактически к этой игре».`;
  }

  return {
    pid: best.pid,
    name: best.name,
    pos: best.pos,
    teamId: best.teamId,
    teamName: best.teamName,
    rating: best.rating,
    interview: {
      headline,
      quote,
      tacticsComment,
      mood
    }
  };
}

/**
 * Сборная тура (Team of the Round / 11 игроков по схеме 4-3-3)
 */
export function buildTeamOfRound(
  roundLabelText: string,
  comp: string,
  fixtures: any[],
  matchesMap: Record<string, any>,
  teamsMap: Record<string, any>
): TeamOfPeriod | null {
  const roundFixtures = fixtures.filter(f => f.comp === comp && (f.label === roundLabelText || `${f.round}-й тур` === roundLabelText || String(f.round) === roundLabelText) && f.status === 'done');
  if (!roundFixtures.length) return null;

  const allRatings: MatchPlayerRating[] = [];

  for (const f of roundFixtures) {
    const m = matchesMap[f.id];
    if (!m || !m.stats) continue;
    const H = teamsMap[f.home]?.name || f.home;
    const A = teamsMap[f.away]?.name || f.away;
    const list = computeMatchRatings(m, f, H, A);
    for (const r of list) {
      r.teamLogo = teamsMap[r.teamId]?.logo;
      allRatings.push(r);
    }
  }

  if (allRatings.length < 11) return null;

  // Группируем по позициям
  const gks = allRatings.filter(p => p.pos === 'ВР').sort((a, b) => b.rating - a.rating);
  const defs = allRatings.filter(p => p.pos === 'ЗАЩ').sort((a, b) => b.rating - a.rating);
  const mids = allRatings.filter(p => p.pos === 'ПЗ').sort((a, b) => b.rating - a.rating);
  const fwds = allRatings.filter(p => p.pos === 'НАП').sort((a, b) => b.rating - a.rating);

  const pickedGk = gks[0] || allRatings[0];
  const pickedDefs = defs.slice(0, 4);
  const pickedMids = mids.slice(0, 3);
  const pickedFwds = fwds.slice(0, 3);

  // На случай если на какой-то позиции не хватило
  const usedPids = new Set([pickedGk.pid, ...pickedDefs.map(p => p.pid), ...pickedMids.map(p => p.pid), ...pickedFwds.map(p => p.pid)]);
  const remaining = allRatings.filter(p => !usedPids.has(p.pid)).sort((a, b) => b.rating - a.rating);

  while (pickedDefs.length < 4 && remaining.length) {
    const p = remaining.shift()!;
    pickedDefs.push(p);
    usedPids.add(p.pid);
  }
  while (pickedMids.length < 3 && remaining.length) {
    const p = remaining.shift()!;
    pickedMids.push(p);
    usedPids.add(p.pid);
  }
  while (pickedFwds.length < 3 && remaining.length) {
    const p = remaining.shift()!;
    pickedFwds.push(p);
    usedPids.add(p.pid);
  }

  const starting11 = [pickedGk, ...pickedDefs, ...pickedMids, ...pickedFwds];
  const bestOfAll = [...starting11].sort((a, b) => b.rating - a.rating)[0];

  // Тренер тура: тренер команды с наибольшей разницей голов или яркой победой
  const winningFx = [...roundFixtures].sort((a, b) => Math.abs(b.hg - b.ag) - Math.abs(a.hg - a.ag))[0];
  const winTeamId = winningFx ? (winningFx.hg >= winningFx.ag ? winningFx.home : winningFx.away) : roundFixtures[0]?.home;
  const winTeam = teamsMap[winTeamId];

  return {
    title: `Сборная ${roundLabelText}`,
    periodLabel: roundLabelText,
    comp,
    formation: '4-3-3',
    playerOfThePeriod: bestOfAll,
    coachOfThePeriod: {
      name: winTeam?.coach?.name || 'Главный тренер',
      teamName: winTeam?.name || 'Команда тура',
      teamLogo: winTeam?.logo,
      reason: `Тактический триумф и доминирование над соперником в туре`
    },
    lineup: {
      gk: pickedGk,
      def: pickedDefs,
      mid: pickedMids,
      fwd: pickedFwds
    },
    bench: remaining.slice(0, 5)
  };
}

/**
 * Сборная месяца (Team of the Month)
 */
export function buildTeamOfMonth(
  yearMonth: string, // '2026-08', '2026-09' и т.д.
  comp: string,
  fixtures: any[],
  matchesMap: Record<string, any>,
  teamsMap: Record<string, any>
): TeamOfPeriod | null {
  const monthNames: Record<string, string> = {
    '01': 'Январь', '02': 'Февраль', '03': 'Март', '04': 'Апрель',
    '05': 'Май', '06': 'Июнь', '07': 'Июль', '08': 'Август',
    '09': 'Сентябрь', '10': 'Октябрь', '11': 'Ноябрь', '12': 'Декабрь'
  };

  const [y, mStr] = yearMonth.split('-');
  const label = `${monthNames[mStr] || mStr} ${y}`;

  const monthFx = fixtures.filter(f => f.comp === comp && (f.date || '').startsWith(yearMonth) && f.status === 'done');
  if (!monthFx.length) return null;

  // Агрегируем оценки игроков за месяц
  const playerStats: Record<string, {
    pid: string;
    name: string;
    pos: string;
    teamId: string;
    teamName: string;
    ratings: number[];
    goals: number;
    assists: number;
    saves: number;
    tackles: number;
    shots: number;
    xg: number;
    cleanSheets: number;
    matches: number;
  }> = {};

  for (const f of monthFx) {
    const m = matchesMap[f.id];
    if (!m || !m.stats) continue;
    const H = teamsMap[f.home]?.name || f.home;
    const A = teamsMap[f.away]?.name || f.away;
    const list = computeMatchRatings(m, f, H, A);
    for (const r of list) {
      const cur = playerStats[r.pid] ||= {
        pid: r.pid,
        name: r.name,
        pos: r.pos,
        teamId: r.teamId,
        teamName: r.teamName,
        ratings: [],
        goals: 0,
        assists: 0,
        saves: 0,
        tackles: 0,
        shots: 0,
        xg: 0,
        cleanSheets: 0,
        matches: 0
      };
      cur.ratings.push(r.rating);
      cur.goals += r.goals;
      cur.assists += r.assists;
      cur.saves += r.saves;
      cur.tackles += r.tackles;
      cur.shots += r.shots;
      cur.xg += r.xg;
      cur.cleanSheets += r.cleanSheet;
      cur.matches += 1;
    }
  }

  const allRatings: MatchPlayerRating[] = Object.values(playerStats).map(p => {
    const avgRating = +(p.ratings.reduce((a, b) => a + b, 0) / p.ratings.length).toFixed(2);
    // Бонус за стабильность (чем больше матчей сыграл, тем выше вес)
    const weightedRating = +(avgRating + Math.min(0.3, p.matches * 0.05)).toFixed(1);

    return {
      pid: p.pid,
      name: p.name,
      pos: p.pos,
      teamId: p.teamId,
      teamName: p.teamName,
      teamLogo: teamsMap[p.teamId]?.logo,
      side: 'home' as const,
      rating: weightedRating,
      min: p.matches * 90,
      goals: p.goals,
      assists: p.assists,
      saves: p.saves,
      tackles: p.tackles,
      shots: p.shots,
      xg: +p.xg.toFixed(2),
      cleanSheet: p.cleanSheets,
      yc: 0,
      rc: 0,
      highlight: `${p.matches} матчей, ${p.goals ? p.goals + ' г. ' : ''}${p.assists ? p.assists + ' пас. ' : ''}${p.cleanSheets ? p.cleanSheets + ' сухих' : ''}`.trim() || 'Стабильная игра'
    };
  }).sort((a, b) => b.rating - a.rating);

  if (allRatings.length < 11) return null;

  const gks = allRatings.filter(p => p.pos === 'ВР');
  const defs = allRatings.filter(p => p.pos === 'ЗАЩ');
  const mids = allRatings.filter(p => p.pos === 'ПЗ');
  const fwds = allRatings.filter(p => p.pos === 'НАП');

  const pickedGk = gks[0] || allRatings[0];
  const pickedDefs = defs.slice(0, 4);
  const pickedMids = mids.slice(0, 3);
  const pickedFwds = fwds.slice(0, 3);

  const starting11 = [pickedGk, ...pickedDefs, ...pickedMids, ...pickedFwds];
  const bestOfAll = [...starting11].sort((a, b) => b.rating - a.rating)[0];

  const topTeam = teamsMap[bestOfAll.teamId];

  return {
    title: `Сборная месяца · ${label}`,
    periodLabel: label,
    comp,
    formation: '4-3-3',
    playerOfThePeriod: bestOfAll,
    coachOfThePeriod: {
      name: topTeam?.coach?.name || 'Главный тренер месяца',
      teamName: topTeam?.name || bestOfAll.teamName,
      teamLogo: topTeam?.logo,
      reason: `Серия побед и безупречная тактическая форма подопечных в течение месяца`
    },
    lineup: {
      gk: pickedGk,
      def: pickedDefs,
      mid: pickedMids,
      fwd: pickedFwds
    },
    bench: allRatings.slice(11, 16)
  };
}
