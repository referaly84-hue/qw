/**
 * Кубок России по футболу (Сезон 2026/2027)
 * Официальный регламент турнира с Путем РПЛ и Путем регионов
 *
 * 🏆 СТАДИИ ТУРНИРА:
 * 1. Групповой этап и отборочные раунды (лето-осень 2026):
 *    - Путь РПЛ: 16 клубов РПЛ в 4 группах по 4 команды (A, B, C, D), 6 туров (48 матчей).
 *      В расписании пишется «Путь РПЛ · 1-й тур» (без разбивки на группы в названии тура).
 *      В каждом туре ровно 8 матчей (Вт 2, Ср 4, Чт 2).
 *      Матчи групп распределяются вразнобой (случайный порядок групп по слотам).
 *      1-2 места -> верхняя сетка плей-офф Пути РПЛ (с правом на ошибку)
 *      3 место -> нижняя сетка Пути регионов (на выбывание)
 *      4 место -> выбывает
 *    - Путь регионов: 6 отборочных раундов на выбывание (по 1 матчу).
 *      Жеребьёвка раундов 2–6 проводится ДИНАМИЧЕСКИ по итогам сыгранных матчей:
 *      1-й раунд: 16 матчей (Медиалига и 2-я лига Б)
 *      2-й раунд: 16 победителей 1-го раунда vs 16 команд 2-й лиги
 *      3-й раунд: 16 победителей 2-го раунда vs 16 команд 2-й лиги А
 *      4-й раунд: Вступают 18 клубов Первой лиги! Команды ФНЛ играют НЕ между собой,
 *                 а выходят на победителей 3-го раунда (клуб низшей лиги принимает клуб ФНЛ дома!)
 *      5-й раунд: 16 победителей 4-го раунда играют между собой (8 матчей)
 *      6-й раунд: 8 победителей 5-го раунда играют между собой (4 матча)
 *                 4 победителя выходят в весеннюю стадию против 3-х мест групп РПЛ!
 * 2. Плей-офф (весна 2027):
 *    - Путь РПЛ: 1/8, 1/4, 1/2 финала — двухматчевые серии дома и в гостях.
 *    - Путь регионов: матчи на вылет из 1 игры. В паре с клубом РПЛ хозяин — клуб не из РПЛ.
 * 3. Суперфинал (6 июня 2027): 1 матч на нейтральном поле (Лужники, Москва).
 */

export interface CupGroupTeamRow {
  id: string;
  name: string;
  pos: number;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  zone: 'top' | 'playoff' | 'bad';
  zoneLabel: string;
}

export interface CupGroup {
  id: string; // 'A', 'B', 'C', 'D'
  name: string;
  teams: string[];
  table: CupGroupTeamRow[];
}

export interface CupState2026 {
  season: string;
  stage: 'groups_and_qual' | 'playoff_spring' | 'final';
  finalDate: string; // '2027-06-06'
  rplGroups: Record<string, CupGroup>; // A, B, C, D
  rplWeeks: { tue: string; wed: string; thu: string }[];
  regWeeks: { tue: string; wed: string; thu: string }[];
  regionsQualRounds: {
    round: number;
    title: string;
    completed: boolean;
    drawn: boolean;
  }[];
  regionsPools: {
    round2Incoming: string[]; // Новые клубы 2-й лиги для 2-го раунда
    round3Incoming: string[]; // Новые клубы 2-й лиги А для 3-го раунда
    fnlIncoming: string[];    // 18 клубов Первой лиги для 4-го раунда
  };
  playoff: {
    rplBracket: {
      r16: any[]; // 1/8 финала (двухматчевые)
      qf: any[];  // 1/4 финала (двухматчевые)
      sf: any[];  // 1/2 финала (двухматчевые)
    };
    regionsBracket: {
      r16: any[];
      qf: any[];
      sf: any[];
      final: any[]; // финал пути регионов
    };
    superFinal: any | null; // Финал 6 июня 2027
  };
}

export const DEFAULT_REG_WEEKS = [
  { tue: '2026-07-21', wed: '2026-07-22', thu: '2026-07-23' }, // Раунд 1
  { tue: '2026-08-04', wed: '2026-08-05', thu: '2026-08-06' }, // Раунд 2
  { tue: '2026-08-18', wed: '2026-08-19', thu: '2026-08-20' }, // Раунд 3
  { tue: '2026-09-15', wed: '2026-09-16', thu: '2026-09-17' }, // Раунд 4 (старт Первой лиги)
  { tue: '2026-09-29', wed: '2026-09-30', thu: '2026-10-01' }, // Раунд 5
  { tue: '2026-10-27', wed: '2026-10-28', thu: '2026-10-29' }  // Раунд 6
];

export const DEFAULT_RPL_WEEKS = [
  { tue: '2026-07-28', wed: '2026-07-29', thu: '2026-07-30' }, // Тур 1
  { tue: '2026-08-11', wed: '2026-08-12', thu: '2026-08-13' }, // Тур 2
  { tue: '2026-08-25', wed: '2026-08-26', thu: '2026-08-27' }, // Тур 3
  { tue: '2026-09-22', wed: '2026-09-23', thu: '2026-09-24' }, // Тур 4
  { tue: '2026-10-20', wed: '2026-10-21', thu: '2026-10-22' }, // Тур 5
  { tue: '2026-11-03', wed: '2026-11-04', thu: '2026-11-05' }  // Тур 6
];

/**
 * Вспомогательная функция раскладки матчей в мидвик (со вторника по четверг)
 */
export function scheduleMidweekFixtures(
  pairs: [any, any][],
  weekDates: { tue: string; wed: string; thu: string },
  season: string,
  roundNum: number,
  roundTitle: string,
  uidFn: () => string
): any[] {
  const fixtures: any[] = [];
  const n = pairs.length;

  pairs.forEach(([homeTeam, awayTeam], idx) => {
    let date = weekDates.wed;
    let time = '17:30';

    if (n === 8) {
      // Стандартный тур из 8 матчей: Вт 2, Ср 4, Чт 2
      if (idx < 2) {
        date = weekDates.tue;
        time = idx === 0 ? '16:00' : '18:30';
      } else if (idx < 6) {
        date = weekDates.wed;
        time = ['14:00', '16:30', '18:30', '20:00'][idx - 2];
      } else {
        date = weekDates.thu;
        time = idx === 6 ? '16:00' : '18:30';
      }
    } else if (n >= 14 && n <= 18) {
      // 16 (или 17) матчей: Вт 4, Ср 8, Чт 4
      if (idx < 4) {
        date = weekDates.tue;
        time = ['15:00', '17:00', '19:00', '20:45'][idx % 4];
      } else if (idx < 12) {
        date = weekDates.wed;
        time = ['14:00', '15:00', '16:30', '17:30', '18:30', '19:30', '20:00', '20:45'][(idx - 4) % 8];
      } else {
        date = weekDates.thu;
        time = ['15:00', '17:00', '19:00', '20:45'][(idx - 12) % 4];
      }
    } else if (n === 4) {
      // 6-й раунд (4 матча): Вт 1, Ср 2, Чт 1
      if (idx === 0) {
        date = weekDates.tue;
        time = '18:00';
      } else if (idx === 1 || idx === 2) {
        date = weekDates.wed;
        time = idx === 1 ? '17:30' : '20:00';
      } else {
        date = weekDates.thu;
        time = '18:00';
      }
    } else {
      const slot = idx % 3;
      date = slot === 0 ? weekDates.tue : (slot === 1 ? weekDates.wed : weekDates.thu);
      time = ['15:00', '17:30', '19:30', '20:30'][Math.floor(idx / 3) % 4];
    }

    fixtures.push({
      id: uidFn(),
      season,
      comp: 'cup',
      cupPath: 'regions_qual',
      qualRound: roundNum,
      round: 100 + roundNum,
      label: roundTitle,
      date,
      time,
      home: typeof homeTeam === 'string' ? homeTeam : homeTeam.id,
      away: typeof awayTeam === 'string' ? awayTeam : awayTeam.id,
      status: 'scheduled',
      hg: null,
      ag: null,
      pos: 0
    });
  });

  return fixtures;
}

/**
 * Динамическая жеребьёвка следующего раунда Пути регионов на основе победителей предыдущего раунда.
 * Гарантирует, что команды Первой лиги вступают в 4-м раунде и играют против победителей 3-го раунда,
 * причем команды низших лиг принимают клубы ФНЛ на своем поле.
 */
export function drawNextRegionsRound(
  cupState: CupState2026,
  completedRoundNum: number,
  completedRoundFixtures: any[],
  uidFn: () => string
): any[] {
  const nextRound = completedRoundNum + 1;
  if (nextRound > 6) return [];

  // Определяем победителей сыгранного раунда
  const winners = completedRoundFixtures.map(f => {
    if (f.hg > f.ag) return f.home;
    if (f.ag > f.hg) return f.away;
    if (f.pen) return f.pen.winner === 'home' ? f.home : f.away;
    return f.home;
  });

  const weekDates = cupState.regWeeks[nextRound - 1] || DEFAULT_REG_WEEKS[nextRound - 1];
  const pairs: [string, string][] = [];
  let roundTitle = `Путь регионов · ${nextRound}-й отборочный раунд`;

  if (nextRound === 2) {
    // 2-й раунд: победители 1-го раунда выходят на новые команды 2-й лиги
    const incoming = cupState.regionsPools.round2Incoming || [];
    roundTitle = 'Путь регионов · 2-й отборочный раунд';
    for (let i = 0; i < winners.length; i++) {
      const opp = incoming[i] || (winners[(i + 1) % winners.length]);
      pairs.push([winners[i], opp]);
    }
  } else if (nextRound === 3) {
    // 3-й раунд: победители 2-го раунда играют с новыми командами 2-й лиги А
    const incoming = cupState.regionsPools.round3Incoming || [];
    roundTitle = 'Путь регионов · 3-й отборочный раунд';
    for (let i = 0; i < winners.length; i++) {
      const opp = incoming[i] || (winners[(i + 1) % winners.length]);
      pairs.push([winners[i], opp]);
    }
  } else if (nextRound === 4) {
    // 4-й раунд: Вступают 18 клубов Первой лиги!
    // Команды ФНЛ играют НЕ между собой, а выходят на победителей прошлых раундов!
    // Победители 3-го раунда (низшие лиги) принимают команды ФНЛ дома.
    roundTitle = 'Путь регионов · 4-й раунд (старт Первой лиги)';
    const fnl = [...(cupState.regionsPools.fnlIncoming || [])].sort(() => Math.random() - 0.5);

    const numQualMatches = Math.min(winners.length, fnl.length);
    for (let i = 0; i < numQualMatches; i++) {
      pairs.push([winners[i], fnl[i]]); // Победитель 3-го раунда дома принимает ФНЛ!
    }

    // Оставшиеся клубы ФНЛ (если есть) играют между собой
    for (let j = numQualMatches; j < fnl.length - 1; j += 2) {
      pairs.push([fnl[j], fnl[j + 1]]);
    }
  } else if (nextRound === 5) {
    // 5-й раунд: Победители 4-го раунда играют между собой
    roundTitle = 'Путь регионов · 5-й отборочный раунд';
    const shuffledWinners = [...winners].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffledWinners.length - 1; i += 2) {
      pairs.push([shuffledWinners[i], shuffledWinners[i + 1]]);
    }
  } else if (nextRound === 6) {
    // 6-й раунд: 4 матча за 4 путёвки в весенний плей-офф
    roundTitle = 'Путь регионов · 6-й отборочный раунд';
    const shuffledWinners = [...winners].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffledWinners.length - 1; i += 2) {
      pairs.push([shuffledWinners[i], shuffledWinners[i + 1]]);
    }
  }

  // Обновляем статус раундов в cupState
  const prevRoundInfo = cupState.regionsQualRounds.find(r => r.round === completedRoundNum);
  if (prevRoundInfo) prevRoundInfo.completed = true;

  const nextRoundInfo = cupState.regionsQualRounds.find(r => r.round === nextRound);
  if (nextRoundInfo) nextRoundInfo.drawn = true;

  return scheduleMidweekFixtures(pairs, weekDates, cupState.season, nextRound, roundTitle, uidFn);
}

/**
 * Инициализация структуры Кубка России на новый сезон (FONBET Кубок России 2026/2027)
 */
export function initCup2026(
  season: string,
  rplTeams: any[],
  fnlTeams: any[],
  secondLeagueTeams: any[],
  mediaTeams: any[],
  uidFn: () => string,
  calendarDates?: {
    rplWeeks: { tue: string; wed: string; thu: string }[];
    regWeeks: { tue: string; wed: string; thu: string }[];
  }
): { cupState: CupState2026; fixtures: any[] } {
  const fixtures: any[] = [];

  const rplDates = calendarDates?.rplWeeks || DEFAULT_RPL_WEEKS;
  const regDates = calendarDates?.regWeeks || DEFAULT_REG_WEEKS;

  // 1. Формируем 4 группы Пути РПЛ (A, B, C, D по 4 команды)
  const shuffledRpl = [...rplTeams].sort(() => Math.random() - 0.5);
  const groupIds = ['A', 'B', 'C', 'D'];
  const rplGroups: Record<string, CupGroup> = {};

  // Расписание 6 туров для каждой группы из 4 команд (2 матча в туре на группу)
  const groupRoundPairs: Record<string, [number, number][][]> = {};
  groupIds.forEach((gid, gi) => {
    const gTeams = shuffledRpl.slice(gi * 4, (gi + 1) * 4).map(t => t.id);
    rplGroups[gid] = {
      id: gid,
      name: `Группа ${gid}`,
      teams: gTeams,
      table: gTeams.map((tid, idx) => {
        const teamObj = rplTeams.find(t => t.id === tid);
        return {
          id: tid,
          name: teamObj?.name || tid,
          pos: idx + 1,
          p: 0,
          w: 0,
          d: 0,
          l: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          pts: 0,
          zone: idx < 2 ? 'top' : (idx === 2 ? 'playoff' : 'bad'),
          zoneLabel: idx < 2 ? '1/8 Пути РПЛ' : (idx === 2 ? 'В Путь регионов' : 'Вылет из турнира')
        };
      })
    };

    // 6 туров: 1–3 первый круг, 4–6 ответные матчи со сменой хозяев
    groupRoundPairs[gid] = [
      [[0, 1], [2, 3]], // 1 тур
      [[0, 2], [3, 1]], // 2 тур
      [[3, 0], [1, 2]], // 3 тур
      [[1, 0], [3, 2]], // 4 тур
      [[2, 0], [1, 3]], // 5 тур
      [[0, 3], [2, 1]]  // 6 тур
    ];
  });

  // Распределяем матчи туров Пути РПЛ по дням (со вторника по четверг: Вт 2, Ср 4, Чт 2):
  // КЛЮЧЕВОЕ ПРАВИЛО:
  // 1. В расписании не надо путь РПЛ разбивать на группы, строго: «Путь РПЛ · 1-й тур».
  // 2. Группы играют вразнобой (рандом групп по дням тура).
  for (let roundIdx = 0; roundIdx < 6; roundIdx++) {
    const dates = rplDates[roundIdx] || DEFAULT_RPL_WEEKS[roundIdx];
    const roundMatches: { home: string; away: string; gid: string }[] = [];

    // Собираем 8 матчей тура
    for (const gid of groupIds) {
      const pairs = groupRoundPairs[gid][roundIdx];
      const gTeams = rplGroups[gid].teams;
      for (const [hIdx, aIdx] of pairs) {
        roundMatches.push({ home: gTeams[hIdx], away: gTeams[aIdx], gid });
      }
    }

    // Случайное перемешивание порядка матчей для разброса групп по дням (Вт, Ср, Чт)
    const shuffledRoundMatches = [...roundMatches].sort(() => Math.random() - 0.5);

    // Раскладываем ровно: Вт 2, Ср 4, Чт 2
    const slotSchedule = [
      { date: dates.tue, time: '17:30' },
      { date: dates.tue, time: '20:00' },
      { date: dates.wed, time: '15:00' },
      { date: dates.wed, time: '17:30' },
      { date: dates.wed, time: '19:30' },
      { date: dates.wed, time: '20:45' },
      { date: dates.thu, time: '17:30' },
      { date: dates.thu, time: '20:00' }
    ];

    shuffledRoundMatches.forEach((m, slotIdx) => {
      const schedule = slotSchedule[slotIdx] || { date: dates.wed, time: '18:00' };
      fixtures.push({
        id: uidFn(),
        season,
        comp: 'cup',
        cupPath: 'rpl_group',
        groupId: m.gid,
        round: roundIdx + 1,
        label: `Путь РПЛ · ${roundIdx + 1}-й тур`,
        date: schedule.date,
        time: schedule.time,
        home: m.home,
        away: m.away,
        status: 'scheduled',
        hg: null,
        ag: null,
        pos: 0
      });
    });
  }

  // 2. Формируем Путь регионов — НАЧИНАЕТСЯ ТОЛЬКО С 1-ГО РАУНДА!
  // Последующие раунды (2, 3, 4, 5, 6) составляются ДИНАМИЧЕСКИ по мере прохода команд.
  const earlyTeams = [...mediaTeams, ...secondLeagueTeams].sort(() => Math.random() - 0.5);

  const r1Count = earlyTeams.length >= 32 ? 32 : (Math.floor(earlyTeams.length / 2) * 2);
  const r1Teams = earlyTeams.slice(0, r1Count);

  // Пулы команд, вступающих в последующих раундах:
  const r2Incoming = earlyTeams.slice(r1Count, r1Count + 16).map(t => typeof t === 'string' ? t : t.id);
  const r3Incoming = earlyTeams.slice(r1Count + 16, r1Count + 32).map(t => typeof t === 'string' ? t : t.id);
  const fnlIncoming = [...fnlTeams].map(t => typeof t === 'string' ? t : t.id);

  const r1Pairs: [any, any][] = [];
  for (let i = 0; i < r1Teams.length - 1; i += 2) {
    r1Pairs.push([r1Teams[i], r1Teams[i + 1]]);
  }

  // Генерируем ТОЛЬКО 1-й раунд
  const r1Fixtures = scheduleMidweekFixtures(
    r1Pairs,
    regDates[0],
    season,
    1,
    'Путь регионов · 1-й отборочный раунд',
    uidFn
  );
  fixtures.push(...r1Fixtures);

  const cupState: CupState2026 = {
    season,
    stage: 'groups_and_qual',
    finalDate: '2027-06-06',
    rplGroups,
    rplWeeks: rplDates,
    regWeeks: regDates,
    regionsQualRounds: [
      { round: 1, title: '1-й раунд (Медиалига и 2-я лига)', completed: false, drawn: true },
      { round: 2, title: '2-й раунд (Отбор 2-й лиги)', completed: false, drawn: false },
      { round: 3, title: '3-й раунд (Выход на Первую лигу)', completed: false, drawn: false },
      { round: 4, title: '4-й раунд (Вступают 18 клубов Первой лиги)', completed: false, drawn: false },
      { round: 5, title: '5-й раунд Пути регионов', completed: false, drawn: false },
      { round: 6, title: '6-й раунд Пути регионов (Выход в весенний плей-офф)', completed: false, drawn: false }
    ],
    regionsPools: {
      round2Incoming: r2Incoming,
      round3Incoming: r3Incoming,
      fnlIncoming: fnlIncoming
    },
    playoff: {
      rplBracket: { r16: [], qf: [], sf: [] },
      regionsBracket: { r16: [], qf: [], sf: [], final: [] },
      superFinal: null
    }
  };

  return { cupState, fixtures };
}

/**
 * Пересчет турнирных таблиц групп Пути РПЛ
 */
export function recalculateCupGroups(cupState: CupState2026, fixtures: any[]): void {
  if (!cupState || !cupState.rplGroups) return;

  const cupFx = fixtures.filter(f => f.comp === 'cup' && f.cupPath === 'rpl_group' && f.status === 'done');

  for (const gid of ['A', 'B', 'C', 'D']) {
    const grp = cupState.rplGroups[gid];
    if (!grp) continue;

    const stats: Record<string, { p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }> = {};
    for (const tid of grp.teams) {
      stats[tid] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    }

    const gMatches = cupFx.filter(f => f.groupId === gid);
    for (const f of gMatches) {
      const h = stats[f.home], a = stats[f.away];
      if (!h || !a) continue;

      h.p += 1; a.p += 1;
      h.gf += f.hg; h.ga += f.ag;
      a.gf += f.ag; a.ga += f.hg;
      h.gd = h.gf - h.ga;
      a.gd = a.gf - a.ga;

      if (f.hg > f.ag) {
        h.w += 1; h.pts += 3;
        a.l += 1;
      } else if (f.ag > f.hg) {
        a.w += 1; a.pts += 3;
        h.l += 1;
      } else {
        // В Кубке России при ничьей в основное время пробивается серия пенальти:
        // Победитель по пенальти получает 2 очка, проигравший — 1 очко
        h.d += 1; a.d += 1;
        if (f.pen) {
          if (f.pen.winner === 'home' || f.pen.hg > f.pen.ag) {
            h.pts += 2;
            a.pts += 1;
          } else {
            a.pts += 2;
            h.pts += 1;
          }
        } else {
          h.pts += 1;
          a.pts += 1;
        }
      }
    }

    const sorted = grp.teams.map(tid => {
      const s = stats[tid] || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
      const teamRow = grp.table.find(r => r.id === tid);
      return {
        id: tid,
        name: teamRow?.name || tid,
        pos: 1,
        ...s,
        zone: 'top' as 'top' | 'playoff' | 'bad',
        zoneLabel: ''
      };
    }).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    sorted.forEach((r, idx) => {
      r.pos = idx + 1;
      if (idx < 2) {
        r.zone = 'top';
        r.zoneLabel = '1/8 Пути РПЛ';
      } else if (idx === 2) {
        r.zone = 'playoff';
        r.zoneLabel = 'В Путь регионов';
      } else {
        r.zone = 'bad';
        r.zoneLabel = 'Вылет';
      }
    });

    grp.table = sorted;
  }
}
