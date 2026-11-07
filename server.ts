/**
 * Вирт РПЛ — сервер приложения с поддержкой логотипов команд,
 * симуляции матчей через LLM/фоновый генератор, Live SSE и турнирной таблицы.
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getTeamLogo, getTeamColors, getCompetitionLogo } from './src/logos.ts';
import { LEAGUE_REGULATIONS, getTeamZoneClass, getRplLegionLimit, isLegionnaire, getLegionnaireStatus } from './src/rules.ts';
import { getTeamCoach, computeCoachSynergy, type Coach, STAFF_ROLES, type StaffRole, type StaffMember, generateClubStaff, getAllInitialStaff } from './src/coaches.ts';
import { computeMatchRatings, getMatchMotm, buildTeamOfRound, buildTeamOfMonth } from './src/awards.ts';
import { GoogleGenAI } from '@google/genai';
import { initCup2026, recalculateCupGroups, drawNextRegionsRound } from './src/cup2026.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MDIR = path.join(DATA_DIR, 'matches');
fs.mkdirSync(MDIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');

let SYS_DEFAULT = '';
try {
  SYS_DEFAULT = fs.readFileSync(path.join(__dirname, 'prompt.txt'), 'utf8');
} catch {
  SYS_DEFAULT = 'Ты — футбольный комментатор и спортивный симулятор чемпионата России по футболу (Вирт РПЛ). Сгенерируй реалистичный отрезок матча в формате JSON.';
}

/* ───────── утилиты ───────── */
const uid = () => crypto.randomBytes(5).toString('hex');
const mkCode = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += a[crypto.randomInt(a.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const norm = (s: any) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const addDays = (d: string, n: number) => {
  const t = new Date(d + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 864e5);
const at = (f: any) => new Date(`${f.date}T${f.time}:00`);
const esc = (s: any) => String(s == null ? '' : s).replace(/[&<>]/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));
function rng(seed: any) {
  let a = 0;
  for (const c of String(seed)) a = (a * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function km(a: any, b: any) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, t = (x: number) => x * Math.PI / 180;
  const dLa = t(b.lat - a.lat), dLo = t(b.lon - a.lon);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLo / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) / 10) * 10;
}

/* ───────── начальные данные ───────── */
/* ───────── начальные данные (Сезон 2026/2027) ───────── */
const RPL: [string, string, number, number, string][] = [
  ['Зенит', 'Санкт-Петербург', 59.95, 30.32, 'Газпром Арена'],
  ['Краснодар', 'Краснодар', 45.04, 38.97, 'Парк Краснодар'],
  ['Локомотив', 'Москва', 55.81, 37.74, 'РЖД Арена'],
  ['Спартак', 'Москва', 55.82, 37.44, 'Лукойл Арена'],
  ['ЦСКА', 'Москва', 55.79, 37.53, 'ВЭБ Арена'],
  ['Балтика', 'Калининград', 54.71, 20.51, 'Ростех Арена'],
  ['Динамо Москва', 'Москва', 55.79, 37.56, 'ВТБ Арена'],
  ['Рубин', 'Казань', 55.79, 49.12, 'Ак Барс Арена'],
  ['Ахмат', 'Грозный', 43.32, 45.69, 'Ахмат-Арена'],
  ['Ростов', 'Ростов-на-Дону', 47.22, 39.72, 'Ростов Арена'],
  ['Крылья Советов', 'Самара', 53.2, 50.15, 'Солидарность Арена'],
  ['Оренбург', 'Оренбург', 51.77, 55.1, 'Газовик'],
  ['Акрон', 'Тольятти', 53.5, 49.42, 'Кристалл'],
  ['Динамо Махачкала', 'Махачкала', 42.98, 47.5, 'Анжи-Арена'],
  ['Родина', 'Москва', 55.75, 37.61, 'Спартаковец'],
  ['Факел', 'Воронеж', 51.67, 39.18, 'Факел Арена']
];

const FNL_TEAMS: [string, string, number, number, string][] = [
  ['Арсенал Тула', 'Тула', 54.19, 37.61, 'Арсенал'],
  ['Велес', 'Москва', 55.7, 37.6, 'Спартаковец'],
  ['Волга Ульяновск', 'Ульяновск', 54.32, 48.39, 'Труд'],
  ['Енисей', 'Красноярск', 56.01, 92.87, 'Центральный'],
  ['КАМАЗ', 'Набережные Челны', 55.74, 52.41, 'КАМАЗ'],
  ['Ленинградец', 'Санкт-Петербург', 59.93, 30.3, 'Рощино Арена'],
  ['Нефтехимик', 'Нижнекамск', 55.64, 51.82, 'Нефтехимик'],
  ['Пари НН', 'Нижний Новгород', 56.33, 44.0, 'Стадион Нижний Новгород'],
  ['Ротор', 'Волгоград', 48.73, 44.55, 'Волгоград Арена'],
  ['СКА-Хабаровск', 'Хабаровск', 48.48, 135.07, 'Стадион им. Ленина'],
  ['Сочи', 'Сочи', 43.6, 39.73, 'Фишт'],
  ['Спартак Кострома', 'Кострома', 57.77, 40.93, 'Урожай'],
  ['Текстильщик', 'Иваново', 57.0, 40.97, 'Текстильщик'],
  ['Торпедо Москва', 'Москва', 55.71, 37.65, 'БСА Лужники'],
  ['Урал', 'Екатеринбург', 56.83, 60.57, 'Екатеринбург Арена'],
  ['Уфа', 'Уфа', 54.74, 55.97, 'Нефтяник'],
  ['Челябинск', 'Челябинск', 55.16, 61.4, 'Центральный'],
  ['Шинник', 'Ярославль', 57.63, 39.87, 'Шинник']
];

const LOWER: Record<string, string[]> = {
  '2la_gold': [
    'Сокол', 'Динамо Брянск', 'Алания', 'Родина-2', 'Динамо Киров',
    'Амкар', 'Тюмень', 'Динамо Владивосток', 'Сибирь', 'Спартак Владикавказ'
  ],
  '2la_silver': [
    'Калуга', 'Торпедо Миасс', 'Волгарь', 'Зенит-2', 'Ротор-2',
    'Урал-2', 'Крылья Советов-2', 'Балтика-2', 'Родина-3', 'Динамо Ставрополь'
  ],
  '2lb_1': [
    'Севастополь', 'Нарт Черкесск', 'Победа Хасавюрт', 'Ростов-2', 'Дружба Майкоп',
    'Астрахань', 'Рубин Ялта', 'Ангушт', 'Спартак-Нальчик', 'Динамо-2 Махачкала',
    'Заря Луганск', 'Кызылташ', 'Нефтяник Ахтырский', 'ПСК Динская', 'Чайка-М', 'Шахтер Донецк'
  ],
  '2lb_2': [
    'Муром', 'Динамо Вологда', 'Иркутск', 'Спартак-2', 'Балтика-БФУ',
    'Тверь', 'Торпедо Владимир', 'Череповец', 'Чертаново', 'Звезда',
    'Луки-Энергия', 'Космос Долгопрудный', 'Енисей-2', 'Динамо СПб', 'Искра Смоленск'
  ],
  '2lb_3': [
    'Авангард Курск', 'Салют Белгород', 'Спартак Тамбов', 'Рязань', 'Металлург Липецк',
    'Орел', 'Арсенал-2', 'Родина-М', 'Зенит Пенза', 'СКА-Хабаровск-2',
    'Ротор-2', 'Строгино', 'Квант Обнинск', 'Сатурн Раменское', 'Волна', 'Шумбрат'
  ],
  '2lb_4': [
    'Химик', 'КДВ Томск', 'Оренбург-2', 'Динамо Барнаул', 'Рубин-2',
    'Крылья Советов-2', 'Челябинск-2', 'Акрон-2', 'Урал-2', 'Носта',
    'Легион', 'Ижевск'
  ],
  'media': [
    '2Drots', 'Амкал', 'Броуки (Brokeboys)', 'ФК 10', 'Lit Energy', 'СиндЕкат',
    'СКА Ростов', 'Народная Команда', 'Fight Nights', 'Prime Squad', 'Апсны', 'Матч ТВ'
  ],
  'media_div2': [
    'FC ARS', '«Ф» Москва', 'Альтерон', 'Анжи', 'Горки', 'ФК Vibe', 'ФК ПП', 'ФК ЮНИСОН'
  ]
};

const COMPS = [
  { id: 'rpl', name: 'РПЛ', type: 'league', tier: 1, level: '1-й уровень (16 команд)', logo: '/logos/leagues/rpl.svg' },
  { id: 'supercup', name: 'Суперкубок России', type: 'cup', level: 'Суперкубок · Матч за трофей', logo: '/logos/leagues/supercup.svg' },
  { id: 'cup', name: 'Кубок России', type: 'cup', level: 'Национальный кубок', logo: '/logos/leagues/cup.svg' },
  { id: 'playoff', name: 'Стыковые матчи', type: 'cup', tier: 1, level: 'Переходные стыки лиг', logo: '/logos/leagues/rpl.svg' },
  { id: 'fnl', name: 'Первая лига', type: 'league', tier: 2, level: '2-й уровень (18 команд)', logo: '/logos/leagues/fnl.svg' },
  { id: '2la_gold', name: 'Вторая лига А · Золото', type: 'league', tier: 3, cat: '2la', level: '3-й уровень (10 команд)', logo: '/logos/leagues/2la.svg' },
  { id: '2la_silver', name: 'Вторая лига А · Серебро', type: 'league', tier: 3, cat: '2la', level: '3-й уровень (10 команд)', logo: '/logos/leagues/2la.svg' },
  { id: '2lb_1', name: 'Вторая лига Б · Группа 1 (Юг)', type: 'league', tier: 4, cat: '2lb', level: '4-й уровень (16 команд)', logo: '/logos/leagues/2lb.svg' },
  { id: '2lb_2', name: 'Вторая лига Б · Группа 2 (Запад)', type: 'league', tier: 4, cat: '2lb', level: '4-й уровень (15 команд)', logo: '/logos/leagues/2lb.svg' },
  { id: '2lb_3', name: 'Вторая лига Б · Группа 3 (Центр)', type: 'league', tier: 4, cat: '2lb', level: '4-й уровень (16 команд)', logo: '/logos/leagues/2lb.svg' },
  { id: '2lb_4', name: 'Вторая лига Б · Группа 4 (Урал)', type: 'league', tier: 4, cat: '2lb', level: '4-й уровень (12 команд)', logo: '/logos/leagues/2lb.svg' },
  { id: 'media', name: 'Winline Медийная футбольная лига (7-сезон)', type: 'league', tier: 5, level: 'Медиалига · 2 группы по 6 команд', logo: '/logos/leagues/media.svg' },
  { id: 'media_div2', name: 'Второй дивизион (Медиалига)', type: 'league', tier: 6, level: '8 команд · Плей-офф топ-4', logo: '/logos/leagues/media.svg' },
  { id: 'media_cup', name: 'Winline Кубок Лиги (2026)', type: 'cup', tier: 5, level: '20 команд · 4 группы по 5 команд', logo: '/logos/leagues/media.svg' }
];

const DERBIES = [
  ['Спартак', 'ЦСКА', 'Дерби всея Руси', 'Главное противостояние страны, максимальный накал и давление трибун.'],
  ['Спартак', 'Динамо Москва', 'Старейшее московское дерби', 'Старейшее принципиальное соперничество.'],
  ['Спартак', 'Локомотив', 'Московское дерби', 'Принципиальный матч, всегда жарко.'],
  ['Спартак', 'Родина', 'Московское дерби', 'Амбициозный новичок столицы бросает вызов народной команде.'],
  ['ЦСКА', 'Динамо Москва', 'Братское дерби', 'Историческое столичное дерби.'],
  ['ЦСКА', 'Локомотив', 'Московское дерби', 'Игра армейцев и железнодорожников — всегда на нерве.'],
  ['Динамо Москва', 'Локомотив', 'Московское дерби', 'Борьба за московский приоритет.'],
  ['Динамо Москва', 'Родина', 'Московское дерби', 'Столичное дерби двух поколений.'],
  ['Локомотив', 'Родина', 'Московское дерби', 'Борьба московских клубов.'],
  ['Зенит', 'Спартак', 'Битва двух столиц', 'Главное противостояние Петербурга и Москвы.'],
  ['Зенит', 'ЦСКА', 'Принципиальное противостояние', 'Исторически острые матчи Петербурга и Москвы.'],
  ['Ростов', 'Краснодар', 'Южное дерби', 'Главная битва за юг России.'],
  ['Ахмат', 'Динамо Махачкала', 'Кавказское дерби', 'Региональная принципиальность и эмоции.'],
  ['Рубин', 'Крылья Советов', 'Волжское дерби', 'Волжское дерби Татарстана и Самарской области.'],
  ['Факел', 'Спартак', 'Огненное противостояние', 'Невероятная поддержка воронежских трибун.']
];

function seed() {
  const d: any = {
    settings: {
      season: '2026/27',
      secPerMin: 4,
      breakSec: 20,
      chunks: 2,
      auto: false,
      squadMax: 25,
      grounding: false,
      tgToken: '',
      tgChat: '',
      siteUrl: '',
      systemPrompt: '',
      keys: {},
      models: {},
      adminCode: mkCode()
    },
    comps: COMPS,
    teams: [],
    players: [],
    squads: {},
    lineups: {},
    tactics: {},
    fixtures: [],
    derbies: [],
    transfers: [],
    sessions: {},
    llmlog: [],
    cup: null,
    budgetHistory: []
  };
  for (const [name, city, lat, lon, stadium] of RPL) {
    d.teams.push({ id: uid(), name, comp: 'rpl', city, lat, lon, stadium, code: mkCode(), logo: getTeamLogo(name, null, 'rpl') });
  }
  for (const [name, city, lat, lon, stadium] of FNL_TEAMS) {
    d.teams.push({ id: uid(), name, comp: 'fnl', city, lat, lon, stadium, code: mkCode(), logo: getTeamLogo(name, null, 'fnl') });
  }
  for (const c of Object.keys(LOWER)) {
    for (const name of LOWER[c]) {
      d.teams.push({ id: uid(), name, comp: c, city: '', lat: null, lon: null, stadium: '', code: '', logo: getTeamLogo(name, null, c) });
    }
  }
  const T = (n: string) => d.teams.find((t: any) => t.name === n);
  for (const [a, b, name, note] of DERBIES) {
    if (T(a) && T(b)) d.derbies.push({ id: uid(), a: T(a).id, b: T(b).id, name, note });
  }
  return d;
}

const DEFAULT_REFEREES = [
  {
    id: 'ref_abrosimov', name: 'Иван Абросимов', city: 'Санкт-Петербург', role: 'Главный арбитр', varRole: '',
    style: 'european',
    styleDesc: 'Динамичный арбитр новой волны, ориентированный на европейскую планку единоборств. Не любит дробить игру мелкими свистками, поощряет быстрый переход из обороны в атаку, но жёстко пресекает опасные подкаты.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.4, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Иван Абросимов (Санкт-Петербург) — перспективный арбитр, отличающийся высокой мобильностью и стремлением поддерживать высокий темп матча. Редко останавливает игру при лёгких контактах, давая командам бороться, но чётко фиксирует срывы перспективных атак.'
  },
  {
    id: 'ref_bobrovsky', name: 'Ян Бобровский', city: 'Санкт-Петербург', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'balanced',
    styleDesc: 'Спокойный, рассудительный арбитр с хорошим чувством дистанции. Предпочитает устное предупреждение ранней жёлтой карточке, уверенно работает в комнате ВАР и редко теряет контроль над эмоциями игроков.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.5, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Ян Бобровский (Санкт-Петербург) — уравновешенный судья, который умеет гасить конфликты на поле без лишней демонстративности. Последователен в трактовке фолов в центре поля и внимательно следит за борьбой при стандартных положениях.'
  },
  {
    id: 'ref_bulanov', name: 'Евгений Буланов', city: 'Саранск', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'balanced',
    styleDesc: 'Надёжный и последовательный арбитр, придерживающийся классической трактовки правил. Внимателен к тактическим фолам и игре рукой, старается принимать взвешенные решения без спешки.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.3, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Евгений Буланов (Саранск) — опытный судья, прошедший все ступени российского футбола. Отличается хорошей физической подготовкой, чёткой жестикуляцией и стабильностью в оценке единоборств.'
  },
  {
    id: 'ref_zaika', name: 'Матвей Заика', city: 'новичок', role: 'Главный арбитр', varRole: '',
    style: 'liberal',
    styleDesc: 'Молодой арбитр с высокой планкой допустимой борьбы. Старается не вмешиваться в игру без веской причины, позволяя футболистам вести плотные дуэли.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 6.7, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Матвей Заика — молодой арбитр, делающий ставку на высокий темп и минимум остановок. Старается не перегружать матч карточками в дебюте.'
  },
  {
    id: 'ref_ivanov', name: 'Сергей Иванов', city: 'Ростов-на-Дону', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'principled',
    styleDesc: 'Один из самых авторитетных и жёстких арбитров РПЛ. Держит дисциплину железной рукой, не терпит споров, симуляций и грубости. Уверенно назначает пенальти и показывает красные карточки при явных нарушениях.',
    leagues: ['rpl', 'cup', 'friendly'], rating: 8.2, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Сергей Иванов (Ростов-на-Дону) — топовый российский арбитр с огромным опытом работы на главных дерби страны и еврокубках. Его отличает бескомпромиссность, отличное чтение игры и умение мгновенно пресекать любые провокации на поле.'
  },
  {
    id: 'ref_karasev', name: 'Сергей Карасев', city: 'Москва', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'european',
    styleDesc: 'Топ-арбитр с огромным международным опытом (Лига чемпионов, Евро). Даёт вести плотную силовую борьбу в центре поля, не дробит игру мелкими свистками, но мгновенно пресекает грубость, опасные подкаты и неспортивное поведение. В штрафной действует максимально хладнокровно, редко поддаётся давлению трибун.',
    leagues: ['rpl', 'cup', 'friendly'], rating: 8.4, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Сергей Карасев (Москва) — самый опытный и статусный российский арбитр, регулярно работавший на матчах Лиги чемпионов, Лиги Европы и чемпионатов Европы. Отличается высокой планкой допустимой борьбы, отличной физической готовностью и авторитетом среди игроков. Умеет управлять эмоциональным накалом дерби без лишних карточек, но при явной грубости или срыве перспективной атаки действует жёстко и последовательно.'
  },
  {
    id: 'ref_levnikov', name: 'Кирилл Левников', city: 'Санкт-Петербург', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'balanced',
    styleDesc: 'Спокойный, методичный арбитр с отличным чтением игры. Предпочитает диалог с футболистами вместо ранних предупреждений, старается сохранять высокий темп и давать преимущество при фолах в атаке. Чётко взаимодействует с ВАР, но ключевые решения в штрафной старается принимать сам.',
    leagues: ['rpl', 'cup', 'friendly'], rating: 8.1, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Кирилл Левников (Санкт-Петербург) — один из самых стабильных и предсказуемых судей РПЛ. Редко теряет нить игры даже в самых напряжённых матчах, грамотно использует принцип преимущества и не любит излишней театральности. Игроки ценят его за последовательность трактовок единоборств на протяжении всех 90 минут.'
  },
  {
    id: 'ref_kukuyan', name: 'Павел Кукуян', city: 'Сочи', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'principled',
    styleDesc: 'Принципиальный и бескомпромиссный арбитр. Не боится принимать резонансные решения: уверенно назначает пенальти за задержки руками и наступы в штрафной, жёстко наказывает за споры, симуляции и затяжку времени. Держит игру в ежовых рукавицах.',
    leagues: ['rpl', 'cup', 'friendly'], rating: 7.9, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Павел Кукуян (Сочи) — арбитр с сильным характером, который никогда не прячется за спины ассистентов. Известен высокой требовательностью к дисциплине: за несогласие с решением или попытку выпросить карточку для соперника можно мгновенно получить предупреждение. При этом в чистой силовой борьбе даёт играть.'
  },
  {
    id: 'ref_sukhoy', name: 'Алексей Сухой', city: 'Люберцы', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'liberal',
    styleDesc: 'Либеральный, «английский» стиль судейства. Высокая планка фола, минимум остановок, максимум динамики. Позволяет контактную борьбу плечо в плечо и жёсткие стыки, если они направлены в мяч. Карточки достаёт только за откровенную грубость или срыв контратак.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.8, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Алексей Сухой (Люберцы) — один из самых зрелищных судей для болельщиков, так как его матчи редко превращаются в череду штрафных ударов. Он отлично чувствует ритм игры, позволяет командам бороться и не свистит при каждом падении. Однако при грубых фолах сзади или опасной игре высоко поднятой ногой реагирует незамедлительно.'
  },
  {
    id: 'ref_kukulyak', name: 'Евгений Кукуляк', city: 'Калуга', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'balanced',
    styleDesc: 'Интеллигентный и уравновешенный арбитр. Хорошо выбирает позицию на поле, редко мешает передачам. Внимателен к тактическим фолам в центре поля и блокировкам при стандартах. Старается гасить конфликты спокойным разговором, но при необходимости твёрдо применяет санкции.',
    leagues: ['rpl', 'cup', 'friendly'], rating: 7.7, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Евгений Кукуляк (Калуга) — представитель современной волны российских арбитров, делающий ставку на профилактику нарушений. Он заранее предупреждает игроков при подачах угловых и штрафных, чётко фиксирует толчки в спину и редко допускает грубые промахи в оценке эпизодов.'
  },
  {
    id: 'ref_moskalev', name: 'Владимир Москалев', city: 'Воронеж', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'principled',
    styleDesc: 'Опытный и требовательный арбитр, особенно внимательный к эпизодам в штрафной площади. Фиксирует малейшие задержки за футболку и неосторожные контакты в ногах. Любит чёткий порядок на поле, не терпит недисциплинированного поведения скамеек запасных.',
    leagues: ['rpl', 'cup', 'friendly'], rating: 7.6, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Владимир Москалев (Воронеж) — опытный судья РПЛ, который прошёл через множество сложных матчей и дерби. Его отличает скрупулёзность при разборе спорных моментов и готовность идти к монитору ВАР, если есть малейшие сомнения. В его матчах защитникам приходится действовать максимально аккуратно в своей штрафной.'
  },
  {
    id: 'ref_cheban', name: 'Сергей Чебан', city: 'Москва', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'strict',
    styleDesc: 'Строгий и педантичный арбитр. Быстро пресекает любые попытки грубой игры, активно использует жёлтые карточки уже в первом тайме, чтобы задать жёсткие рамки. Внимательно следит за соблюдением дистанции стенки и правильностью ввода мяча.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.5, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Сергей Чебан (Москва) — арбитр, который предпочитает контролировать матч через строгую дисциплину. Если команды начинают играть слишком жёстко, он без колебаний достаёт предупреждения, быстро охлаждая пыл нарушителей. Хорошо работает в бригаде и редко ошибается в определении направления аутов и угловых.'
  },
  {
    id: 'ref_chistyakov', name: 'Артем Чистяков', city: 'Азов', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'strict',
    styleDesc: 'Внимательный к деталям арбитр, который терпеть не может симуляций, провокаций и затяжек времени. Свистит чётко и громко, не боится давать вторые жёлтые карточки за неспортивное поведение. В единоборствах придерживается средней планки фола.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.5, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Артем Чистяков (Азов) — требовательный и собранный судья, который всегда держит высокий уровень концентрации. Он отлично распознаёт «нырки» в штрафной и пресекает попытки игроков выпросить фол. При этом в динамичных атаках старается не мешать развитию комбинаций.'
  },
  {
    id: 'ref_shadykhanov', name: 'Павел Шадыханов', city: 'Москва', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'balanced',
    styleDesc: 'Ровный, современный арбитр без перекосов в излишнюю мягкость или жестокость. Хорошо чувствует момент, когда нужно дать доиграть эпизод, а когда — остановить игру свистком. Уверенно работает как в поле, так и в комнате ВАР.',
    leagues: ['rpl', 'cup', 'friendly'], rating: 7.4, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Павел Шадыханов (Москва) — надёжный арбитр, который редко становится главным героем послематчевых скандалов. Его стиль строится на последовательности: одинаковые фолы в начале и в конце матча трактуются одинаково. Умеет находить общий язык с капитанами команд.'
  },
  {
    id: 'ref_tsyganok', name: 'Сергей Цыганок', city: 'Калининград', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'european',
    styleDesc: 'Стремится к европейской манере судейства: минимум лишних остановок, высокая динамика, доверие к ассистентам. Не любит свистеть мелкие толчки в центре поля, поощряя быстрый переход из обороны в атаку.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.4, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Сергей Цыганок (Калининград) — арбитр, который старается сделать футбол максимально быстрым и непрерывным. Он редко затягивает паузы при просмотре ВАР, быстро принимает решения и не позволяет игрокам подолгу спорить. Хорошо справляется с матчами команд, играющих в высокий прессинг.'
  },
  {
    id: 'ref_kazartsev', name: 'Василий Казарцев', city: 'Санкт-Петербург', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'strict',
    styleDesc: 'Скрупулёзный и осторожный арбитр, который часто полагается на помощь ВАР в пограничных ситуациях. Фиксирует мелкие фолы и контакты в штрафной, из-за чего в его матчах нередко назначаются пенальти. Требует строгого соблюдения правил.',
    leagues: ['rpl', 'fnl', 'cup'], rating: 7.3, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Василий Казарцев (Санкт-Петербург) — опытный арбитр, известный своей дотошностью при разборе игровых эпизодов. Он старается не упустить ни одного нарушения в штрафной площади, активно взаимодействует с видеоассистентами и строго наказывает за игру рукой.'
  },
  {
    id: 'ref_shafeev', name: 'Рафаэль Шафеев', city: 'Волгоград', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'liberal',
    styleDesc: 'Энергичный арбитр, поддерживающий высокий темп игры. Даёт бороться вверху и внизу, не реагирует на крики игроков при лёгких контактах. Карточки показывает преимущественно за срыв быстрых атак и откровенную грубость.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.3, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Рафаэль Шафеев (Волгоград) — молодой и амбициозный арбитр с отличной физической подготовкой. Он всегда находится рядом с мячом, что позволяет ему точно оценивать силу контакта в единоборствах. В его матчах команды много бегают и редко тратят время на споры.'
  },
  {
    id: 'ref_frolov', name: 'Антон Фролов', city: 'Москва', role: 'Главный арбитр', varRole: 'ВАР/АВАР',
    style: 'liberal',
    styleDesc: 'Универсальный арбитр, отлично чувствующий дух игры в любых турнирах — от РПЛ до Медиалиги. Не боится нестандартных ситуаций, умеет общаться с эмоциональными игроками и тренерами, поддерживает зрелищный, открытый футбол.',
    leagues: ['rpl', '2la', '2lb', 'media', 'cup', 'friendly'], rating: 7.2, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Антон Фролов (Москва) — один из самых гибких и коммуникабельных судей, способный адаптироваться к любому уровню накала. Он не ломает игру лишними свистками, но при переходе грани дозволенного быстро возвращает команды в рамки правил.'
  },
  {
    id: 'ref_opeykina', name: 'Вера Опейкина', city: 'Сочи', role: 'Резервный судья', varRole: 'ВАР/АВАР',
    style: 'balanced',
    styleDesc: 'Высококвалифицированный арбитр, специализирующийся на работе резервным судьёй и видеоассистентом (ВАР/АВАР). Безупречно контролирует техническую зону, замены и добавленное время, оперативно подсказывает главному арбитру при скрытых фолах.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.2, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Вера Опейкина (Сочи) — одна из самых опытных женщин-арбитров в российском футболе. Регулярно назначается на матчи РПЛ и Кубка России в качестве резервного арбитра и ВАР/АВАР. Отличается железной выдержкой у бровки и точностью при проверке офсайдов и пенальти.'
  },
  {
    id: 'ref_matveev', name: 'Станислав Матвеев', city: 'Москва', role: 'Главный арбитр', varRole: '',
    style: 'strict',
    styleDesc: 'Жёсткий в вопросах тактических фолов арбитр. Мгновенно наказывает жёлтой карточкой за прихваты руками в центре поля и срыв контратак. Требует от игроков максимальной концентрации и не прощает грубых подкатов.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.1, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Станислав Матвеев (Москва) — арбитр, который не позволяет командам разрушать игру мелким тактическим фолом. Если команда пытается сбивать темп соперника постоянными нарушениями в середине поля, он быстро выравнивает ситуацию предупреждениями.'
  },
  {
    id: 'ref_tanashev', name: 'Инал Танашев', city: 'Нальчик', role: 'Главный арбитр', varRole: '',
    style: 'principled',
    styleDesc: 'Характерный и принципиальный судья. Не поддаётся давлению хозяев поля, одинаково строго судит обе команды. Внимателен к борьбе на «втором этаже» и локтям при верховых дуэлях.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 7.0, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Инал Танашев (Нальчик) — арбитр, прошедший суровую школу ФНЛ и Второй лиги. Отличается психологической устойчивостью и жёстким контролем верховых единоборств: за отмашки и опасную игру локтями наказывает без колебаний.'
  },
  {
    id: 'ref_prokopov', name: 'Андрей Прокопов', city: 'Москва', role: 'Главный арбитр', varRole: '',
    style: 'liberal',
    styleDesc: 'Молодой арбитр, старающийся не перегружать игру свистками. Даёт бороться в рамках правил, редко останавливает матч при незначительных контактах, предпочитая устные замечания.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 6.9, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Андрей Прокопов (Москва) — перспективный арбитр, делающий ставку на высокий темп и естественное течение матча. Старается быть незаметным на поле и вмешиваться только тогда, когда нарушение действительно влияет на эпизод.'
  },
  {
    id: 'ref_novikov', name: 'Никита Новиков', city: 'Москва', role: 'Главный арбитр', varRole: '',
    style: 'balanced',
    styleDesc: 'Аккуратный и последовательный арбитр. Придерживается классической трактовки правил, ровно распределяет внимание между обоими таймами, старается избегать неоправданных удалений.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 6.8, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Никита Новиков (Москва) — молодой судья, набирающий опыт на уровне РПЛ и Кубка России. Отличается хорошей дисциплиной, чёткой жестикуляцией и стремлением принимать максимально взвешенные решения.'
  },
  {
    id: 'ref_kaplenkov', name: 'Игорь Капленков', city: 'новичок', role: 'Главный арбитр', varRole: '',
    style: 'balanced',
    styleDesc: 'Начинающий арбитр элитного дивизиона, действующий строго по методическим рекомендациям. Старается не рисковать, фиксирует очевидные фолы и внимательно следит за дисциплиной.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 6.7, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Игорь Капленков — перспективный арбитр, недавно пополнивший список судей высшего уровня. Действует собранно и осторожно, стараясь не допускать грубых ошибок в ключевых эпизодах.'
  },
  {
    id: 'ref_kashirin', name: 'Данил Каширин', city: 'новичок', role: 'Главный арбитр', varRole: '',
    style: 'liberal',
    styleDesc: 'Молодой арбитр с высокой планкой фола. Старается не свистеть мелкие стыки, даёт командам играть в быстрый вертикальный футбол.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 6.6, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Данил Каширин — молодой судья, который стремится поддерживать высокий темп игры и не дробить матч частыми остановками.'
  },
  {
    id: 'ref_naboka', name: 'Данил Набока', city: 'новичок', role: 'Главный арбитр', varRole: '',
    style: 'balanced',
    styleDesc: 'Спокойный молодой арбитр, придерживающийся стандартной планки единоборств. Внимателен к игре в штрафной и соблюдению правил при стандартах.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 6.6, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Данил Набока — начинающий арбитр, который делает ставку на аккуратность, хорошую физическую форму и чёткое следование правилам игры.'
  },
  {
    id: 'ref_plisko', name: 'Михаил Плиско', city: 'новичок', role: 'Главный арбитр', varRole: '',
    style: 'strict',
    styleDesc: 'Строгий молодой арбитр, который предпочитает сразу пресекать грубость и неспортивное поведение жёлтыми карточками, чтобы не упустить контроль над игрой.',
    leagues: ['rpl', 'fnl', 'cup', 'friendly'], rating: 6.5, matches: 0, yellows: 0, reds: 0, penalties: 0,
    bio: 'Михаил Плиско — молодой судья с жёсткой манерой контроля дисциплины. Быстро реагирует на грубые подкаты и споры с арбитром.'
  }
];

const ASSISTANT_REFEREES = [
  'Максим Белокур', 'Денис Березнов', 'Александр Богданов', 'Андрей Болотенков', 'Егор Болховитин',
  'Кирилл Большаков', 'Андрей Веретешкин', 'Максим Гаврилин', 'Дмитрий Ермаков', 'Алексей Ермилов',
  'Михаил Иванов', 'Ярослав Калиниченко', 'Екатерина Курочкина', 'Алексей Лунев', 'Дмитрий Маликов',
  'Никита Матиеску', 'Дмитрий Мосякин', 'Рустам Мухтаров', 'Андрей Образко', 'Александр Павлов',
  'Денис Петров', 'Варанцо Петросян', 'Дмитрий Сафьян', 'Дмитрий Семенов', 'Александр Туркин',
  'Андрей Филипкин', 'Альмир Хатмуллин', 'Адлан Хатуев', 'Руслан Шекемов', 'Алексей Ширяев'
];

const DEFAULT_INTERNATIONAL_BREAKS = [
  { id: 'ib_sep', name: 'Пауза на сборные (сентябрь)', start: '2026-08-31', end: '2026-09-09' },
  { id: 'ib_oct', name: 'Пауза на сборные (октябрь)', start: '2026-10-05', end: '2026-10-14' },
  { id: 'ib_nov', name: 'Пауза на сборные (ноябрь)', start: '2026-11-09', end: '2026-11-18' },
  { id: 'ib_mar', name: 'Пауза на сборные (март)', start: '2027-03-22', end: '2027-03-31' },
  { id: 'ib_jun', name: 'Пауза на сборные (июнь)', start: '2027-06-01', end: '2027-06-11' }
];

function isInInternationalBreak(dateStr: string): boolean {
  if (!dateStr || !db?.internationalBreaks) return false;
  return db.internationalBreaks.some((b: any) => dateStr >= b.start && dateStr <= b.end);
}

function getFixtureTourKey(f: any): string {
  const s = f.season || S();
  if (f.comp === 'rpl') return `${s}:rpl:${f.round}`;
  if (f.comp === 'cup') {
    const p = f.cupPath || (f.round <= 6 ? 'rpl_group' : 'regions_qual');
    const r = f.qualRound || f.round || f.cupStage || 1;
    return `${s}:cup:${p}:${r}`;
  }
  return `${s}:${f.comp}:${f.round || 1}`;
}

function assignTourReferees(tourList: any[]) {
  const validMatches = tourList.filter(f => f.comp === 'rpl' || f.comp === 'cup');
  const invalidMatches = tourList.filter(f => f.comp !== 'rpl' && f.comp !== 'cup');
  for (const f of invalidMatches) {
    delete f.refereeId;
    delete f.refereeName;
    delete f.assistants;
    delete f.reserveReferee;
    delete f.varReferee;
    delete f.avarReferee;
  }
  if (!validMatches.length || !db?.referees?.length) return;

  const usedHeadIds = new Set<string>();
  const comp = validMatches[0].comp;
  let eligible = db.referees.filter((r: any) => !r.leagues || r.leagues.includes(comp));
  if (!eligible.length) eligible = db.referees;

  // Сортируем матчи тура по важности (дерби и рейтинг команд)
  const teamPower = (tid: string) => {
    const ps = db.players.filter((p: any) => p.teamId === tid);
    if (!ps.length) return 70;
    return ps.reduce((s: number, p: any) => s + (p.rating || 70), 0) / ps.length;
  };
  const sortedMatches = [...validMatches].sort((a: any, b: any) => {
    const aDerby = db.derbies?.some((x: any) => (x.a === a.home && x.b === a.away) || (x.a === a.away && x.b === a.home)) ? 1 : 0;
    const bDerby = db.derbies?.some((x: any) => (x.a === b.home && x.b === b.away) || (x.a === b.away && x.b === b.home)) ? 1 : 0;
    if (bDerby !== aDerby) return bDerby - aDerby;
    return (teamPower(b.home) + teamPower(b.away)) - (teamPower(a.home) + teamPower(a.away));
  });

  // Шаг 1. Распределяем главных арбитров по рейтингу (каждый арбитр — строго на 1 матч в туре, по возможности не из города играющих команд)
  for (const f of sortedMatches) {
    let pool = eligible.filter((r: any) => !usedHeadIds.has(r.id));
    if (!pool.length) pool = eligible;
    const homeCity = (team(f.home)?.city || '').trim().toLowerCase();
    const awayCity = (team(f.away)?.city || '').trim().toLowerCase();
    const nonSameCity = pool.filter((r: any) => {
      const rc = (r.city || '').trim().toLowerCase();
      if (!rc) return true;
      return rc !== homeCity && rc !== awayCity;
    });
    const candidatePool = nonSameCity.length ? nonSameCity : pool;
    const sorted = [...candidatePool].sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
    const chosen = sorted[0];
    if (chosen) {
      f.refereeId = chosen.id;
      f.refereeName = chosen.name;
      usedHeadIds.add(chosen.id);
    }
  }

  // Шаг 2. Главные арбитры больше ничего в этом туре не судят!
  const allHeadNames = new Set(validMatches.map(f => f.refereeName).filter(Boolean));
  const nonHeadRefs = db.referees.filter((r: any) => !usedHeadIds.has(r.id) && !allHeadNames.has(r.name));
  const nonHeadPool = nonHeadRefs.length ? nonHeadRefs : db.referees.filter((r: any) => !usedHeadIds.has(r.id));

  // Ассистенты арбитра
  const asstPool = (db.assistants || []).length ? db.assistants : ASSISTANT_REFEREES.map((n, i) => ({ id: 'asst_' + i, name: n }));
  const shuffledAssts = [...asstPool].sort(() => Math.random() - 0.5);
  let asstIdx = 0;

  for (const f of validMatches) {
    const a1 = shuffledAssts[asstIdx % shuffledAssts.length]?.name || 'Дмитрий Мосякин';
    const a2 = shuffledAssts[(asstIdx + 1) % shuffledAssts.length]?.name || 'Егор Болховитин';
    asstIdx += 2;
    f.assistants = [a1, a2];

    // Резервный арбитр (строго из не-главных арбитров тура)
    const resList = nonHeadPool.filter((r: any) => r.id !== f.refereeId);
    const chosenRes = resList.find((r: any) => r.role === 'Резервный судья') || resList[Math.floor(Math.random() * resList.length)];
    f.reserveReferee = chosenRes?.name || 'Вера Опейкина';

    // ВАР арбитр (строго из не-главных арбитров тура)
    let varList = nonHeadPool.filter((r: any) => r.varRole && r.id !== f.refereeId && r.name !== f.reserveReferee);
    if (!varList.length) varList = nonHeadPool.filter((r: any) => r.name !== f.reserveReferee);
    const chosenVar = varList[Math.floor(Math.random() * varList.length)];
    f.varReferee = chosenVar?.name || 'Сергей Карасев';

    // АВАР арбитр (строго из не-главных арбитров тура)
    let avarList = nonHeadPool.filter((r: any) => r.id !== f.refereeId && r.name !== f.reserveReferee && r.name !== f.varReferee);
    if (!avarList.length) avarList = nonHeadPool;
    const chosenAvar = avarList[Math.floor(Math.random() * avarList.length)];
    f.avarReferee = chosenAvar?.name || 'Павел Кукуян';
  }
}

function assignReferee(f: any, siblingList?: any[]) {
  // Арбитры назначаются ТОЛЬКО на матчи РПЛ и Кубка России; для остальных лиг арбитры не назначаются
  if (f.comp !== 'rpl' && f.comp !== 'cup') {
    delete f.refereeId;
    delete f.refereeName;
    delete f.assistants;
    delete f.reserveReferee;
    delete f.varReferee;
    delete f.avarReferee;
    return;
  }
  if (!db?.referees?.length) return;

  const tourKey = getFixtureTourKey(f);
  const validSiblings = Array.isArray(siblingList) ? siblingList : db.fixtures || [];
  const siblings = validSiblings.filter((x: any) => x.id !== f.id && getFixtureTourKey(x) === tourKey);
  assignTourReferees([f, ...siblings]);
}

function updateRefereeStats(f: any, events: any[] = []) {
  if (!f?.refereeId || !db?.referees) return;
  const r = db.referees.find((x: any) => x.id === f.refereeId);
  if (!r) return;
  const yc = events.filter((e: any) => e.type === 'yellow').length;
  const rc = events.filter((e: any) => e.type === 'red').length;
  const pen = events.filter((e: any) => e.type === 'pen_goal' || e.type === 'pen_miss').length;
  r.matches = (r.matches || 0) + 1;
  r.yellows = (r.yellows || 0) + yc;
  r.reds = (r.reds || 0) + rc;
  r.penalties = (r.penalties || 0) + pen;
  const base = r.rating > 0 ? r.rating : 7.5;
  const delta = yc <= 4 && rc === 0 ? 0.1 : rc > 0 ? -0.1 : 0.05;
  r.rating = Math.min(9.9, Math.max(5.5, +(base + delta).toFixed(1)));
  if (Array.isArray(f.assistants) && db.assistants) {
    for (const aname of f.assistants) {
      const a = db.assistants.find((x: any) => x.name === aname);
      if (a) {
        a.matches = (a.matches || 0) + 1;
        a.rating = a.rating > 0 ? Math.min(9.9, +(a.rating + 0.05).toFixed(1)) : 7.5;
      }
    }
  }
}

let db: any;
function load() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    db = seed();
  }
  const def = seed();
  for (const k of Object.keys(def.settings)) {
    if (db.settings[k] === undefined) db.settings[k] = def.settings[k];
  }
  for (const k of ['comps', 'teams', 'players', 'fixtures', 'derbies', 'transfers', 'llmlog', 'tournaments', 'transferRequests', 'budgetHistory']) {
    if (!Array.isArray(db[k])) db[k] = [];
  }
  if (!db.referees || db.referees.length < 26) db.referees = JSON.parse(JSON.stringify(DEFAULT_REFEREES));
  if (!db.assistants || !db.assistants.length) {
    db.assistants = ASSISTANT_REFEREES.map((name, i) => ({
      id: 'asst_' + (i + 1),
      name,
      rating: 0,
      matches: 0,
      bio: 'Нажмите «Сделать портрет (ИИ)», чтобы сформировать подробное портфолио ассистента.'
    }));
  }
  if (!db.internationalBreaks || !db.internationalBreaks.length) {
    db.internationalBreaks = JSON.parse(JSON.stringify(DEFAULT_INTERNATIONAL_BREAKS));
  } else {
    for (const def of DEFAULT_INTERNATIONAL_BREAKS) {
      if (!db.internationalBreaks.some((b: any) => b.id === def.id)) {
        db.internationalBreaks.push(JSON.parse(JSON.stringify(def)));
      }
    }
  }
  for (const k of ['squads', 'lineups', 'tactics', 'sessions']) {
    if (!db[k]) db[k] = {};
  }

  // 1. Очищаем арбитров во всех лигах, кроме РПЛ и Кубка России
  for (const f of db.fixtures) {
    if (f.comp !== 'rpl' && f.comp !== 'cup') {
      delete f.refereeId;
      delete f.refereeName;
      delete f.assistants;
      delete f.reserveReferee;
      delete f.varReferee;
      delete f.avarReferee;
    }
  }

  // 2. В РПЛ и Кубке России: группируем по турам и переназначаем судей
  // Правило: главный арбитр может быть назначен только на 1 матч в туре, больше ничего в туре не судит
  const tours: Record<string, any[]> = {};
  for (const f of db.fixtures) {
    if (f.comp === 'rpl' || f.comp === 'cup') {
      const k = getFixtureTourKey(f);
      tours[k] = tours[k] || [];
      tours[k].push(f);
    }
  }

  for (const list of Object.values(tours)) {
    assignTourReferees(list);
  }
  save();

  // Синхронизируем список соревнований
  db.comps = COMPS;

  // Карта принадлежности команд к лигам по новому регламенту 2026/2027
  const wantedMap = new Map<string, { comp: string; city?: string; stadium?: string; lat?: number | null; lon?: number | null }>();
  for (const [name, city, lat, lon, stadium] of RPL) wantedMap.set(name, { comp: 'rpl', city, stadium, lat, lon });
  for (const [name, city, lat, lon, stadium] of FNL_TEAMS) wantedMap.set(name, { comp: 'fnl', city, stadium, lat, lon });
  for (const c of Object.keys(LOWER)) {
    for (const name of LOWER[c]) wantedMap.set(name, { comp: c });
  }

  // Дедуплицируем db.teams по имени (оставляя существующие команды с логотипами и добавляя недостающие)
  const UPPER_DUPES = new Set(['2DROTS', 'АМКАЛ', 'BROKE BOYS', 'LIT ENERGY', 'СИНДЕКАТ', 'СКА РОСТОВ', 'НАРОДНАЯ КОМАНДА', 'FIGHT NIGHTS', 'PRIME SQUAD', 'ФК Апсны', 'ФК МАТЧ']);
  const seenNames = new Set<string>();
  db.teams = db.teams.filter((t: any) => {
    if (UPPER_DUPES.has(t.name)) return false;
    const key = String(t.name || '').toLowerCase().trim();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  // Обновляем лиги и данные существующих команд
  for (const t of db.teams) {
    if (wantedMap.has(t.name)) {
      const w = wantedMap.get(t.name)!;
      t.comp = w.comp;
      if (w.city) t.city = w.city;
      if (w.stadium) t.stadium = w.stadium;
      if (w.lat != null) t.lat = w.lat;
      if (w.lon != null) t.lon = w.lon;
    }
    t.logo = getTeamLogo(t.name, t.logo, t.comp);
  }

  // Добавляем новые команды в базу
  for (const [name, w] of wantedMap.entries()) {
    if (!db.teams.some((t: any) => t.name === name)) {
      db.teams.push({
        id: uid(),
        name,
        comp: w.comp,
        city: w.city || '',
        lat: w.lat ?? null,
        lon: w.lon ?? null,
        stadium: w.stadium || '',
        code: (w.comp === 'rpl' || w.comp === 'fnl') ? mkCode() : '',
        logo: getTeamLogo(name, null, w.comp)
      });
    }
  }

  // Обновляем дерби
  const T = (n: string) => db.teams.find((t: any) => t.name === n);
  db.derbies = [];
  for (const [a, b, name, note] of DERBIES) {
    if (T(a) && T(b)) db.derbies.push({ id: uid(), a: T(a).id, b: T(b).id, name, note });
  }

  // Инициализируем тренеров и тренерский штаб клубов
  if (!db.staff || !Array.isArray(db.staff) || db.staff.length < 50) {
    db.staff = getAllInitialStaff(db.teams);
  } else {
    const existingTeamIds = new Set(db.staff.map((s: any) => s.teamId));
    for (const t of db.teams) {
      if (!existingTeamIds.has(t.id)) {
        db.staff.push(...generateClubStaff(t));
      }
    }
  }
  const hasRplSchedule = db.fixtures.some((f: any) => f.comp === 'rpl' && f.season === S());
  if (!hasRplSchedule || !db.cupState2026) {
    genSeason('2026-07-18', S());
  } else if (db.cupState2026 && db.fixtures.length) {
    recalculateCupGroups(db.cupState2026, db.fixtures);
  }

  ensureInitialBudgets();
  ensureSuperCupFixture();
  save();
}

let saveT: NodeJS.Timeout | null = null;
function save() {
  if (saveT) return;
  saveT = setTimeout(saveNow, 250);
}
function saveNow() {
  saveT = null;
  try {
    fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
    fs.renameSync(DB_FILE + '.tmp', DB_FILE);
  } catch (e: any) {
    console.error('save:', e.message);
  }
}

const mcache = new Map<string, any>();
const getMatch = (id: string) => {
  if (mcache.has(id)) return mcache.get(id);
  try {
    const m = JSON.parse(fs.readFileSync(path.join(MDIR, id + '.json'), 'utf8'));
    mcache.set(id, m);
    if (mcache.size > 40) mcache.delete(mcache.keys().next().value!);
    return m;
  } catch {
    return null;
  }
};
const putMatch = (id: string, m: any) => {
  mcache.set(id, m);
  fs.writeFileSync(path.join(MDIR, id + '.json'), JSON.stringify(m));
};

/* ───────── доступ к данным ───────── */
const S = () => db.settings.season;
const team = (id: string) => db.teams.find((t: any) => t.id === id);
const tn = (id: string) => team(id)?.name || '?';
const teamLogo = (id: string) => {
  const t = team(id);
  if (!t) return getTeamLogo('?');
  const official = getTeamLogo(t.name, null, t.comp);
  return official.startsWith('/assets/') ? official : (t.logo || official);
};
const player = (id: string) => db.players.find((p: any) => p.id === id);
const fx = (id: string) => db.fixtures.find((f: any) => f.id === id);
const compOf = (id: string) => db.comps.find((c: any) => c.id === id);
const seasonFx = () => db.fixtures.filter((f: any) => f.season === S());
const GROUP: Record<string, string> = { ВР: 'gk', ЦЗ: 'def', ЛЗ: 'def', ПЗ: 'def', ОП: 'mid', ЦП: 'mid', АП: 'mid', ЛВ: 'fwd', ПВ: 'fwd', ЦФ: 'fwd' };
const POSES = Object.keys(GROUP);
function squadOf(tid: string) {
  const ids = db.squads[tid];
  return (ids ? ids.map(player) : db.players.filter((p: any) => p.teamId === tid)).filter(Boolean);
}
function isAvail(p: any, date: string) {
  if (!p) return false;
  if (p.banLeft > 0) return false;
  if (p.out && p.out.until >= date) return false;
  return true;
}
function age(p: any, date: string) {
  const y = parseInt(String(p.born || '').slice(0, 4));
  return y ? (+date.slice(0, 4) - y) : null;
}
function roundLabel(f: any) {
  if (f.label) return f.label;
  if (f.comp === 'supercup') return 'Матч за Суперкубок России';
  if (f.comp === 'cup') {
    if (f.cupPath === 'rpl_group') {
      return `Путь РПЛ · ${f.round}-й тур`;
    }
    if (f.cupPath === 'regions_qual') {
      return `Путь регионов · ${f.qualRound || f.round}-й отборочный раунд`;
    }
    if (f.cupPath === 'rpl_playoff') {
      return `Путь РПЛ · 1/8 финала`;
    }
    if (f.cupPath === 'regions_playoff') {
      return `Путь регионов · 1/8 финала`;
    }
    const n = seasonFx().filter((x: any) => x.comp === 'cup' && x.round === f.round).length;
    return ({ 16: '1/16 финала', 8: '1/8 финала', 4: '1/4 финала', 2: 'Полуфинал', 1: 'Финал' } as any)[n] || `Раунд ${f.round}`;
  }
  return `${f.round}-й тур`;
}
const compName = (f: any) => compOf(f.comp)?.name || f.comp;
const winnerOf = (f: any) => f.hg > f.ag ? f.home : f.hg < f.ag ? f.away : (f.pen ? (f.pen.winner === 'home' ? f.home : f.away) : null);

/* ───────── трансферы, топовые переходы и ИИ-советник ───────── */
function parseFeeAmount(feeStr: any): number {
  if (typeof feeStr === 'number') return feeStr;
  const s = String(feeStr || '').trim();
  const numMatch = s.match(/([0-9]+(?:[.,][0-9]+)?)/);
  if (!numMatch) return 0;
  let val = parseFloat(numMatch[1].replace(',', '.'));
  if (/тыс|k|k\b/i.test(s) && !/млн|m|m\b/i.test(s)) {
    val = val / 1000;
  } else if (/млрд|b|b\b/i.test(s)) {
    val = val * 1000;
  }
  if (/₽|руб/i.test(s)) {
    val = val / 100;
  }
  return Math.round(val * 100) / 100;
}

function executeTransferIfBothApproved(t: any): boolean {
  if (t.status === 'approved') return true;
  const needClub = !!t.isRplToRpl;
  const clubOk = !needClub || t.clubApproval === 'approved';
  const adminOk = t.adminApproval === 'approved';

  if (clubOk && adminOk) {
    t.status = 'approved';
    const p = player(t.pid);
    if (p) {
      if (t.from && db.squads[t.from]) {
        db.squads[t.from] = db.squads[t.from].filter((id: string) => id !== p.id);
      }
      db.squads[t.to] = [...new Set([...squadOf(t.to).map((x: any) => x.id), p.id])];
      p.teamId = t.to;
      if (t.type === 'loan') {
        p.loanFrom = t.from;
        p.loanTerm = t.note || 'Аренда';
      } else {
        delete p.loanFrom;
        delete p.loanTerm;
      }
      t.statsForNewClub = {
        matches: p.matches || 0,
        goals: p.goals || 0,
        assists: p.assists || 0,
        rating: Number(p.rating || 7.0),
        impactScore: ((p.goals || 0) * 4 + (p.assists || 0) * 2.5 + (p.matches || 0) * 1.2 + ((p.rating || 7.0) >= 6.5 ? ((p.rating || 7.0) - 6.0) * 10 : 0)),
        summary: `${p.goals || 0} голов, ${p.assists || 0} ассистов в ${p.matches || 0} матчах`
      };

      const feeAmt = t.feeAmount !== undefined ? t.feeAmount : parseFeeAmount(t.fee);
      if (feeAmt && feeAmt > 0) {
        const feeEuros = Math.round(feeAmt * 1_000_000);
        const buyer = team(t.to);
        const seller = team(t.from);
        if (buyer) {
          const prev = buyer.budget || 0;
          buyer.budget = Math.max(0, prev - feeEuros);
          if (!Array.isArray(db.budgetHistory)) db.budgetHistory = [];
          db.budgetHistory.push({
            id: uid(),
            teamId: buyer.id,
            teamName: buyer.name,
            amount: -feeEuros,
            prevBudget: prev,
            newBudget: buyer.budget,
            type: 'transfer_buy',
            typeLabel: 'Покупка игрока',
            description: `Трансфер: ${p.name} из «${seller?.name || t.fromName}» (-€${feeEuros.toLocaleString('ru-RU')})`,
            date: new Date().toISOString(),
            byAdmin: !!t.byAdmin
          });
        }
        if (seller) {
          const prev = seller.budget || 0;
          seller.budget = prev + feeEuros;
          if (!Array.isArray(db.budgetHistory)) db.budgetHistory = [];
          db.budgetHistory.push({
            id: uid(),
            teamId: seller.id,
            teamName: seller.name,
            amount: feeEuros,
            prevBudget: prev,
            newBudget: seller.budget,
            type: 'transfer_sell',
            typeLabel: 'Продажа игрока',
            description: `Продажа: ${p.name} в «${buyer?.name || t.toName}» (+€${feeEuros.toLocaleString('ru-RU')})`,
            date: new Date().toISOString(),
            byAdmin: !!t.byAdmin
          });
        }
      }
    }
    return true;
  }
  return false;
}

function formatTransferForPublic(t: any) {
  const fromT = team(t.from);
  const toT = team(t.to);
  const p = player(t.pid);
  const feeAmt = t.feeAmount !== undefined ? t.feeAmount : parseFeeAmount(t.fee);
  return {
    id: t.id,
    pid: t.pid,
    playerName: t.playerName || p?.name || 'Игрок',
    pos: t.pos || p?.pos || 'ЦП',
    from: t.from,
    fromName: fromT?.name || t.fromName || 'Клуб',
    fromLogo: teamLogo(t.from),
    to: t.to,
    toName: toT?.name || t.toName || 'Клуб',
    toLogo: teamLogo(t.to),
    fee: t.fee || (feeAmt ? `€${feeAmt.toFixed(1)}M` : 'Свободный агент'),
    feeAmount: feeAmt,
    type: t.type || 'transfer',
    note: t.note || (t.type === 'loan' ? 'Аренда' : 'Полноценный трансфер'),
    date: t.date || new Date().toISOString().slice(0, 10),
    isRplToRpl: !!t.isRplToRpl,
    stats: t.statsForNewClub || {
      matches: p?.matches || 0,
      goals: p?.goals || 0,
      assists: p?.assists || 0,
      rating: Number(p?.rating || 7.0),
      impactScore: ((p?.goals || 0) * 4 + (p?.assists || 0) * 2.5 + (p?.matches || 0) * 1.2),
      summary: `${p?.goals || 0} голов, ${p?.assists || 0} ассистов в ${p?.matches || 0} матчах`
    }
  };
}

function ensureInitialTransfers() {
  if (!db.transfers) db.transfers = [];
}


/* ───────── бюджеты клубов и шкала призовых (РПЛ и Кубок) ───────── */
const INITIAL_RPL_BUDGETS: Record<string, number> = {
  'Зенит': 45_000_000,
  'Спартак': 30_000_000,
  'Динамо Москва': 18_000_000,
  'Краснодар': 15_000_000,
  'ЦСКА': 10_500_000,
  'Рубин': 5_000_000,
  'Локомотив': 3_900_000,
  'Балтика': 3_600_000,
  'Родина': 3_000_000,
  'Ахмат': 3_000_000,
  'Ростов': 3_000_000,
  'Акрон': 2_500_000,
  'Крылья Советов': 2_000_000,
  'Оренбург': 2_000_000,
  'Динамо Махачкала': 1_700_000,
  'Факел': 1_200_000
};

const RPL_PRIZE_SCALE = [
  { place: 1, prize: 13_000_000, label: '1 место — Чемпион РПЛ' },
  { place: 2, prize: 11_800_000, label: '2 место — Серебряный призёр' },
  { place: 3, prize: 10_000_000, label: '3 место — Бронзовый призёр' },
  { place: 4, prize: 9_000_000, label: '4 место' },
  { place: 5, prize: 8_000_000, label: '5 место' },
  { place: 6, prize: 7_000_000, label: '6 место' },
  { place: 7, prize: 6_200_000, label: '7 место' },
  { place: 8, prize: 5_500_000, label: '8 место' },
  { place: 9, prize: 4_900_000, label: '9 место' },
  { place: 10, prize: 4_400_000, label: '10 место' },
  { place: 11, prize: 4_100_000, label: '11 место' },
  { place: 12, prize: 3_900_000, label: '12 место' },
  { place: 13, prize: 3_700_000, label: '13 место (Стыки)' },
  { place: 14, prize: 3_600_000, label: '14 место (Стыки)' },
  { place: 15, prize: 3_500_000, label: '15 место (Вылет)' },
  { place: 16, prize: 3_400_000, label: '16 место (Вылет)' }
];

const CUP_PRIZE_SCALE = {
  groupParticipation: 300_000, // 300 тысяч за участие в групповом этапе
  groupWin: 100_000,           // 100 тысяч за победу в группе
  r16Participation: 110_000,   // 110 тысяч за участие в 1/8 финала
  r16Win: 125_000,             // 125 тысяч за победу в 1/8 финала
  qfParticipation: 110_000,    // 110 тысяч за участие в 1/4 финала
  qfWin: 250_000,              // 250 тысяч за победу в 1/4 финала
  sfParticipation: 110_000,    // 110 тысяч за участие в полуфинале Пути РПЛ
  sfWin: 500_000,              // 500 тысяч за победу в полуфинале
  finalWinner: 1_130_000,      // 1 130 000 € для победителя финала
  finalRunnerUp: 380_000       // 380 000 € для проигравшего финалиста
};

function ensureInitialBudgets() {
  if (!Array.isArray(db.budgetHistory)) db.budgetHistory = [];

  let changed = false;
  for (const t of db.teams) {
    if (t.budget === undefined || (t.budget === 0 && INITIAL_RPL_BUDGETS[t.name] !== undefined)) {
      if (INITIAL_RPL_BUDGETS[t.name] !== undefined) {
        t.budget = INITIAL_RPL_BUDGETS[t.name];
      } else if (t.comp === 'fnl') {
        t.budget = 1_000_000;
      } else {
        t.budget = 500_000;
      }
      changed = true;
    }
  }

  if (db.budgetHistory.length === 0) {
    const rplTeams = db.teams.filter((t: any) => t.comp === 'rpl');
    for (const t of rplTeams) {
      db.budgetHistory.push({
        id: uid(),
        teamId: t.id,
        teamName: t.name,
        amount: t.budget || 0,
        prevBudget: 0,
        newBudget: t.budget || 0,
        type: 'initial',
        typeLabel: 'Стартовый бюджет сезона',
        description: `Утверждён стартовый бюджет сезона 2026/27: €${(t.budget || 0).toLocaleString('ru-RU')}`,
        date: '2026-07-01T10:00:00.000Z',
        byAdmin: true
      });
    }
    changed = true;
  }

  if (changed) save();
}

function ensureSuperCupFixture(sName?: string) {
  const season = sName || S();
  if (!Array.isArray(db.fixtures)) db.fixtures = [];
  const exists = db.fixtures.some((f: any) => f.comp === 'supercup' && f.season === season);
  if (!exists) {
    const zenit = db.teams.find((t: any) => t.name === 'Зенит');
    const krasnodar = db.teams.find((t: any) => t.name === 'Краснодар');
    const homeTeam = zenit || db.teams.find((t: any) => t.comp === 'rpl');
    const awayTeam = krasnodar || db.teams.filter((t: any) => t.comp === 'rpl' && t.id !== homeTeam?.id)[0];
    if (homeTeam && awayTeam) {
      db.fixtures.unshift({
        id: uid(),
        comp: 'supercup',
        season,
        round: 1,
        cupPath: 'supercup',
        label: 'Суперкубок России · Финал',
        home: homeTeam.id,
        away: awayTeam.id,
        date: '2026-07-11',
        time: '17:30',
        stadium: '«Ак Барс Арена» (нейтральное поле, г. Казань)',
        city: 'Казань',
        status: 'scheduled',
        neutralField: true
      });
      save();
    }
  }
}

function calculateCupPrizeSuggestions() {
  const rplTeams = db.teams.filter((t: any) => t.comp === 'rpl');
  const suggestions: any[] = [];
  const cupFx = (db.fixtures || []).filter((f: any) => f.comp === 'cup');

  for (const t of rplTeams) {
    let stage = 'Групповой этап';
    let base = CUP_PRIZE_SCALE.groupParticipation; // 300_000
    let groupWins = 0;
    let r16Wins = 0;
    let qfWins = 0;
    let sfWins = 0;
    let isFinalWinner = false;
    let isFinalRunnerUp = false;

    // Считаем сыгранные матчи Кубка для клуба
    for (const f of cupFx) {
      if (f.status !== 'done') continue;
      const isHome = f.home === t.id;
      const isAway = f.away === t.id;
      if (!isHome && !isAway) continue;

      const teamWon = (isHome && f.homeScore > f.awayScore) || (isAway && f.awayScore > f.homeScore);
      const isPenWon = f.penalties && ((isHome && f.homePen > f.awayPen) || (isAway && f.awayPen > f.homePen));
      const won = teamWon || isPenWon;

      const label = String(f.label || '').toLowerCase();
      const stageField = String(f.stage || '').toLowerCase();

      if (label.includes('финал') && !label.includes('1/2') && !label.includes('1/4') && !label.includes('1/8')) {
        stage = 'Финал Кубка России';
        if (won) isFinalWinner = true;
        else isFinalRunnerUp = true;
      } else if (label.includes('1/2') || stageField.includes('semi')) {
        stage = 'Полуфинал Пути РПЛ';
        if (won) sfWins++;
      } else if (label.includes('1/4') || stageField.includes('quarter')) {
        stage = '1/4 финала';
        if (won) qfWins++;
      } else if (label.includes('1/8') || stageField.includes('r16')) {
        stage = '1/8 финала';
        if (won) r16Wins++;
      } else {
        if (won) groupWins++;
      }
    }

    let totalPrize = base + (groupWins * CUP_PRIZE_SCALE.groupWin);
    if (stage === '1/8 финала') {
      totalPrize += CUP_PRIZE_SCALE.r16Participation + (r16Wins * CUP_PRIZE_SCALE.r16Win);
    } else if (stage === '1/4 финала') {
      totalPrize += CUP_PRIZE_SCALE.r16Participation + CUP_PRIZE_SCALE.qfParticipation + (qfWins * CUP_PRIZE_SCALE.qfWin);
    } else if (stage === 'Полуфинал Пути РПЛ') {
      totalPrize += CUP_PRIZE_SCALE.r16Participation + CUP_PRIZE_SCALE.qfParticipation + CUP_PRIZE_SCALE.sfParticipation + (sfWins * CUP_PRIZE_SCALE.sfWin);
    } else if (stage === 'Финал Кубка России') {
      totalPrize += CUP_PRIZE_SCALE.r16Participation + CUP_PRIZE_SCALE.qfParticipation + CUP_PRIZE_SCALE.sfParticipation + (isFinalWinner ? CUP_PRIZE_SCALE.finalWinner : CUP_PRIZE_SCALE.finalRunnerUp);
    }

    suggestions.push({
      teamId: t.id,
      teamName: t.name,
      logo: teamLogo(t.id),
      stage,
      groupWins,
      playoffWins: r16Wins + qfWins + sfWins,
      prize: totalPrize,
      formattedPrize: '€' + totalPrize.toLocaleString('ru-RU'),
      breakdown: `Участие €300K + ${groupWins} побед в группе (€${(groupWins * 100).toLocaleString('ru-RU')}K)`
    });
  }

  return suggestions.sort((a, b) => b.prize - a.prize);
}

async function getTransferAiAdvice(t: any, p: any, fromT: any, toT: any) {
  const pName = p?.name || t.playerName || 'Футболист';
  const pos = p?.pos || t.pos || 'Игрок';
  const playerAge = p ? (p.age || 25) : 25;
  const fromName = fromT?.name || t.fromName || 'Прежний клуб';
  const toName = toT?.name || t.toName || 'Новый клуб';
  const fee = t.fee || 'По согласованию';
  const typeStr = t.type === 'loan' ? 'Аренда' : 'Полноценный трансфер';
  const stats = p ? `Матчей: ${p.matches || 0}, голов: ${p.goals || 0}, ассистов: ${p.assists || 0}, ср. оценка: ${Number(p.rating || 7.0).toFixed(2)}, OVR: ${p.ovr || 75}` : 'Статистика формируется';

  const sys = 'Ты — главный спортивный директор и финансовый консультант лиги Вирт РПЛ. Проанализируй трансферную сделку между российскими клубами и дай профессиональный вердикт для администратора лиги. Ответь строго в JSON.';
  const prompt = `Сделка:
Игрок: ${pName} (${pos}, возраст: ${playerAge} лет, гражданин: ${p?.nat || 'Россия'})
Статистика: ${stats}
Продавец / отдающий клуб: "${fromName}"
Покупатель / принимающий клуб: "${toName}"
Тип сделки: ${typeStr} (условия: ${t.note || 'Стандартные'})
Заявленная сумма сделки: ${fee}

Дай аргументированный вердикт в формате JSON:
{
  "verdict": "Рекомендуется одобрить" | "Рекомендуется отклонить" | "Спорная сделка (требует внимания)",
  "ratingScore": 8,
  "fairPrice": "например, €6.0M – €7.5M",
  "financialAnalysis": "краткий финансовый аудит (адекватность цены, выгода для продавца, нагрузка на бюджет покупателя)",
  "sportAnalysis": "спортивная польза (как игрок усилит состав покупателя и как потеря скажется на продавце)",
  "risks": "основные риски (адаптация, лимит легионеров, возраст, травматичность)",
  "recommendation": "чёткое резюме для администратора (одобрять или нет, и почему)"
}`;

  if (process.env.GEMINI_API_KEY) {
    try {
      const client = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: sys,
          responseMimeType: 'application/json',
        },
      });
      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw);
      if (parsed.verdict) return parsed;
    } catch (e: any) {
      console.error('Gemini AI advice error:', e.message);
    }
  }

  // Эвристический финансово-спортивный советник при отсутствии прямого ключа
  const feeNum = parseFeeAmount(fee);
  const ovr = p?.ovr || 74;
  const estimatedValue = Math.max(0.5, Math.round(((ovr - 65) * 0.85 + (30 - Math.min(32, playerAge)) * 0.3) * 10) / 10);
  const diff = feeNum - estimatedValue;

  let verdict = 'Рекомендуется одобрить';
  let ratingScore = 8;
  if (diff > 5) {
    verdict = 'Спорная сделка (требует внимания)';
    ratingScore = 5;
  } else if (diff > 9) {
    verdict = 'Рекомендуется отклонить';
    ratingScore = 3;
  } else if (diff < -2) {
    verdict = 'Рекомендуется одобрить';
    ratingScore = 9;
  }

  return {
    verdict,
    ratingScore,
    fairPrice: `€${Math.max(0.3, (estimatedValue * 0.85)).toFixed(1)}M – €${(estimatedValue * 1.25).toFixed(1)}M`,
    financialAnalysis: feeNum > 0
      ? `Заявленная сумма ${fee} ${Math.abs(diff) <= 2 ? 'находится в пределах рыночного диапазона РПЛ' : diff > 2 ? 'существенно превышает ориентировочную рыночную стоимость (переплата покупателя)' : 'выгодна для покупателя (дисконт к рыночной оценке)'}.`
      : 'Сделка оформляется на правах свободной компенсации или аренды.',
    sportAnalysis: `Футболист ${pName} (${pos}) усилит центральную ось клуба «${toName}». Для клуба «${fromName}» сделка ${diff >= 0 ? 'позволит разгрузить зарплатную ведомость и заработать' : 'требует поиска срочной замены в основу'}.`,
    risks: playerAge > 30 ? 'Возрастной фактор, возможен спад физических кондиций.' : playerAge < 21 ? 'Молодой возраст, риск нестабильности в ключевых матчах.' : 'Риск тактической адаптации к требованиям нового тренера.',
    recommendation: verdict === 'Рекомендуется одобрить'
      ? `Трансфер реалистичен и полезен обеим сторонам. Рекомендуется дать одобрение сделки.`
      : verdict === 'Спорная сделка (требует внимания)'
      ? `Покупатель переплачивает, но если позиция критична для схемы, сделку можно санкционировать.`
      : `Сделка финансово раздута. Рекомендуется отклонить или запросить пересмотр суммы компенсации.`
  };
}

/* ───────── таблицы и статистика ───────── */
function table(comp: string, beforeDate?: string) {
  let ids = db.teams.filter((t: any) => t.comp === comp).map((t: any) => t.id);
  if (comp === 'media_cup') {
    const s = new Set<string>();
    seasonFx().filter((f: any) => f.comp === 'media_cup').forEach((f: any) => {
      if (f.home) s.add(f.home);
      if (f.away) s.add(f.away);
    });
    ids = [...s];
  }
  const R: Record<string, any> = {};
  ids.forEach((i: string) => {
    const tm = team(i);
    R[i] = {
      id: i,
      name: tn(i),
      logo: teamLogo(i),
      colors: getTeamColors(tm?.name || ''),
      p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: []
    };
  });
  const list = seasonFx().filter((f: any) => f.comp === comp && f.status === 'done' && (!beforeDate || f.date < beforeDate)).sort((a: any, b: any) => (a.date + a.time).localeCompare(b.date + b.time));
  for (const f of list) {
    for (const [t, gf, ga] of [[f.home, f.hg, f.ag], [f.away, f.ag, f.hg]]) {
      const r = R[t];
      if (!r) continue;
      r.p++; r.gf += gf; r.ga += ga;
      if (gf > ga) { r.w++; r.pts += 3; r.form.push('В'); }
      else if (gf === ga) { r.d++; r.pts++; r.form.push('Н'); }
      else { r.l++; r.form.push('П'); }
    }
  }
  const rows = Object.values(R).sort((a: any, b: any) => b.pts - a.pts || b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
  rows.forEach((r: any, i: number) => {
    r.pos = i + 1;
    r.gd = r.gf - r.ga;
    r.form = r.form.slice(-5).join('');
    const z = getTeamZoneClass(comp, r.pos, rows.length);
    r.zone = z.zoneClass;
    r.zoneLabel = z.badgeLabel || '';
    r.zoneTooltip = z.tooltip || '';
  });
  return rows;
}

let aggCache: any = null;
function agg() {
  if (aggCache && aggCache.season === S()) return aggCache;
  const P: Record<string, any> = {}, T: Record<string, any> = {};
  const add = (o: any, k: string, v: number) => { o[k] = (o[k] || 0) + v; };
  for (const f of seasonFx()) {
    if (f.status !== 'done' || !f.st) continue;
    for (const [pid, s] of Object.entries<any>(f.st.players)) {
      const o = P[f.comp + '|' + pid] ||= { pid, comp: f.comp, n: s.n, t: s.t, logo: teamLogo(s.t), m: 0 };
      o.m += 1;
      for (const k of ['min', 'g', 'a', 'yc', 'rc', 'tk', 'sv', 'sh', 'xg', 'ff', 'fa', 'cs']) add(o, k, s[k] || 0);
    }
    for (const side of ['home', 'away']) {
      const tid = f[side], s = f.st.teams[side], o = f.st.teams[side === 'home' ? 'away' : 'home'];
      const x = T[f.comp + '|' + tid] ||= { tid, comp: f.comp, logo: teamLogo(tid), m: 0 };
      x.m++;
      for (const k of ['g', 'sh', 'sot', 'xg', 'fo', 'co', 'yc', 'rc', 'tk', 'sv', 'off', 'penF', 'penA', 'refF', 'refA']) add(x, k, s[k] || 0);
      add(x, 'ga', o.g || 0); add(x, 'xga', o.xg || 0); add(x, 'foA', o.fo || 0);
      if (!(o.g > 0)) add(x, 'cs', 1);
    }
  }
  aggCache = { season: S(), P, T };
  return aggCache;
}
const invalidateAgg = () => { aggCache = null; };

/* ───────── LLM ───────── */
function getGeminiKeys(): string[] {
  const raw: string[] = [];
  if (process.env.GEMINI_API_KEYS) raw.push(...process.env.GEMINI_API_KEYS.split(/[\n,;]+/));
  if (process.env.GEMINI_API_KEY) raw.push(...process.env.GEMINI_API_KEY.split(/[\n,;]+/));
  for (let i = 1; i <= 10; i++) {
    const k = (process.env as any)[`GEMINI_API_KEY_${i}`];
    if (k) raw.push(k);
  }
  const dbG = db.settings?.keys?.gemini;
  if (typeof dbG === 'string') raw.push(...dbG.split(/[\n,;]+/));
  else if (Array.isArray(dbG)) raw.push(...dbG);

  const seen = new Set<string>();
  const res: string[] = [];
  for (const s of raw) {
    const clean = String(s || '').trim();
    if (clean && !seen.has(clean) && !clean.includes('•')) {
      seen.add(clean);
      res.push(clean);
    }
  }
  return res;
}
function provList() {
  const k = db.settings.keys || {}, m = db.settings.models || {}, L: any[] = [];
  const gKeys = getGeminiKeys();
  const q = process.env.GROQ_API_KEY || k.groq;
  const o = process.env.OPENROUTER_API_KEY || k.openrouter;
  const gModel = process.env.GEMINI_MODEL || m.gemini || 'gemini-3.8-flash';
  for (let i = 0; i < gKeys.length; i++) {
    L.push({ n: 'gemini', id: `gemini_proj_${i + 1}`, key: gKeys[i], model: gModel, max: 32000 });
  }
  if (q) L.push({ n: 'groq', id: 'groq', key: q, base: 'https://api.groq.com/openai/v1', model: process.env.GROQ_MODEL || m.groq || 'openai/gpt-oss-120b', max: 8000 });
  if (o) L.push({ n: 'openrouter', id: 'openrouter', key: o, base: 'https://openrouter.ai/api/v1', model: process.env.OPENROUTER_MODEL || m.openrouter || 'openrouter/free', max: 8000 });
  return L;
}
const hasLLM = () => provList().length > 0;
function httpErr(status: number, body: any) {
  return Object.assign(new Error(`HTTP ${status}: ${JSON.stringify(body).slice(0, 200)}`), { status });
}
async function callProv(p: any, sys: string, user: string, o: any) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 170000);
  try {
    if (p.n === 'gemini') {
      const body: any = {
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: o.temp, maxOutputTokens: Math.min(o.max, p.max) }
      };
      if (o.grounded) body.tools = [{ google_search: {} }];
      else if (o.json) body.generationConfig.responseMimeType = 'application/json';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent?key=${p.key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw httpErr(r.status, j);
      return (j.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || '').join('');
    }
    const body: any = { model: p.model, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: o.temp, max_tokens: Math.min(o.max, p.max) };
    if (o.json) body.response_format = { type: 'json_object' };
    const r = await fetch(p.base + '/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + p.key }, body: JSON.stringify(body), signal: ctl.signal
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw httpErr(r.status, j);
    return j.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(to);
  }
}
function llog(e: any) {
  db.llmlog.push({ ts: Date.now(), ...e });
  if (db.llmlog.length > 200) db.llmlog.shift();
}
async function llm(sys: string, user: string, { json = true, task = '', temp = 0.9, max = 16000, grounded = false } = {}) {
  const L = provList();
  if (!L.length) throw Object.assign(new Error('Нет ключей нейросети'), { noLLM: true });
  let last: any;
  for (const p of L) {
    for (let a = 0; a < 2; a++) {
      const t0 = Date.now();
      try {
        const text = await callProv(p, sys, user, { json, temp, max, grounded });
        if (!text.trim()) throw new Error('пустой ответ');
        llog({ task, p: p.id || p.n, ok: 1, ms: Date.now() - t0 });
        return text;
      } catch (e: any) {
        last = e;
        llog({ task, p: p.id || p.n, ok: 0, ms: Date.now() - t0, err: e.message.slice(0, 160) });
        if (e.status === 429) {
          console.warn(`[LLM Failover] Ключ ${p.id || p.n} исчерпал лимит (HTTP 429). Мгновенное переключение на резервный ключ...`);
          await sleep(500);
          break;
        }
        if (e.status >= 500 || e.name === 'AbortError') await sleep(1500);
        else if (e.status) break;
      }
    }
  }
  throw last;
}
function parseJSON(t: any) {
  t = String(t).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim();
  try { return JSON.parse(t); } catch { }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) try { return JSON.parse(t.slice(a, b + 1)); } catch { }
  throw new Error('нейросеть вернула не-JSON');
}
const llmJSON = async (s: string, u: string, o?: any) => parseJSON(await llm(s, u, o));

/* ───────── карточки игроков ───────── */
const CARD_SYS = `Ты — футбольный скаут-аналитик для симулятора. По имени игрока верни карточку в JSON. Используй только то, что знаешь достоверно; если игрока не знаешь — верни {"found":false}. Не выдумывай. Не пиши о личной жизни, здоровье, скандалах — только спорт.
Формат одного игрока: {"found":true,"name":"Имя Фамилия по-русски","pos":"одна из: ${POSES.join(', ')}","born":"YYYY-MM-DD или YYYY","nation":"страна/гражданство (Россия, Белоруссия, Армения, Казахстан, Бразилия и т.д.)","playedForOtherNationalTeam":false,"otherNationalTeam":"если игрок заигран за национальную сборную другой страны (напр. Армения, Грузия, Сербия, Казахстан), указать точное название этой сборной, иначе пустая строка","realClub":"","style":"как играет, любимые действия на поле, 1–2 предложения","achievements":["главные достижения"],"stats2y":"реальная статистика за 2 последних сезона кратко","form":"последние результаты и тренд","character":"темперамент на поле: спокойный, вспыльчивый, лидер, легко провоцируется и т.п.","news":"спортивные новости за год кратко"}
Для списка имён верни {"players":[...]} в том же порядке.`;

function cardFrom(c: any, extra: any = {}) {
  const hasOtherCap = !!(c.playedForOtherNationalTeam ||
    (c.otherNationalTeam && norm(c.otherNationalTeam) !== 'россия') ||
    (extra.otherNationalTeam && norm(extra.otherNationalTeam) !== 'россия') ||
    extra.playedForOtherNationalTeam);
  return {
    id: uid(), teamId: extra.teamId || null, name: String(c.name || extra.name || '').trim(),
    pos: POSES.includes(c.pos) ? c.pos : (extra.pos || 'ЦП'),
    born: c.born || '',
    nation: c.nation || extra.nation || 'Россия',
    playedForOtherNationalTeam: hasOtherCap,
    otherNationalTeam: c.otherNationalTeam || extra.otherNationalTeam || '',
    realClub: c.realClub || '',
    style: c.style || '', achievements: Array.isArray(c.achievements) ? c.achievements : (c.achievements ? [c.achievements] : []),
    stats2y: c.stats2y || '', form: c.form || '', character: c.character || '', news: c.news || '',
    verified: !!c.__llm, updatedAt: new Date().toISOString(), out: null, banLeft: 0, seasonYC: 0
  };
}
const findPlayerByName = (n: string) => {
  const k = norm(n);
  return db.players.find((p: any) => norm(p.name) === k);
};
async function createPlayers(names: string[], teamId: string | null, hint?: string) {
  const out: any[] = []; const todo: string[] = [];
  for (const raw of names) {
    const nm = String(raw).trim();
    if (!nm) continue;
    const ex = findPlayerByName(nm);
    if (ex) out.push(ex);
    else todo.push(nm);
  }
  let cards: any[] = [];
  if (todo.length && hasLLM()) {
    try {
      const r = await llmJSON(CARD_SYS, `Игроки: ${todo.map((n, i) => `${i + 1}. ${n}`).join('; ')}${hint ? `. Подсказка: ${hint}` : ''}`, { task: 'card', temp: 0.3, max: 8000, grounded: !!db.settings.grounding && provList()[0]?.n === 'gemini' });
      cards = r.players || (r.found !== undefined ? [r] : []);
    } catch (e: any) {
      console.error('card:', e.message);
    }
  }
  todo.forEach((nm, i) => {
    const c = cards[i];
    const p = (c && c.found !== false) ? cardFrom({ ...c, __llm: 1 }, { teamId, name: nm }) : cardFrom({ name: nm, style: 'Данных нет — заполните карточку вручную.' }, { teamId, name: nm });
    if (!p.name) p.name = nm;
    db.players.push(p);
    out.push(p);
  });
  save();
  return out;
}

/* ───────── погода ───────── */
const wcache = new Map<string, string>();
async function weather(tm: any, date: string, time: string) {
  const hour = parseInt((time || '17:00').slice(0, 2));
  const key = [tm?.id, date, hour].join();
  if (wcache.has(key)) return wcache.get(key)!;
  let txt = 'данных о погоде нет — оцени сам по региону и дате; время суток учитывай';
  try {
    if (tm && tm.lat != null) {
      const days = daysBetween(new Date().toISOString().slice(0, 10), date);
      let temp: any, wind: any, rain: any, snow = 0, src: any;
      if (days <= 14) {
        const j: any = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${tm.lat}&longitude=${tm.lon}&hourly=temperature_2m,precipitation,snowfall,wind_speed_10m&start_date=${date}&end_date=${date}&timezone=auto`)).json();
        if (j.hourly) {
          const i = clamp(hour, 0, 23);
          temp = j.hourly.temperature_2m[i];
          wind = j.hourly.wind_speed_10m[i] / 3.6;
          rain = j.hourly.precipitation[i];
          snow = j.hourly.snowfall[i];
          src = 'прогноз';
        }
      }
      if (temp == null) {
        const y = +date.slice(0, 4);
        const res = await Promise.all([1, 2, 3, 4, 5].map(k => fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${tm.lat}&longitude=${tm.lon}&start_date=${y - k}${date.slice(4)}&end_date=${y - k}${date.slice(4)}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`).then(r => r.json()).catch(() => null)));
        const d = res.map((r: any) => r?.daily).filter(Boolean);
        if (d.length) {
          const av = (k: string) => d.reduce((s, x) => s + (x[k]?.[0] || 0), 0) / d.length;
          const mean = av('temperature_2m_mean'), mx = av('temperature_2m_max'), mn = av('temperature_2m_min');
          temp = hour < 17 ? mean + (mx - mean) * 0.7 : mean - (mean - mn) * 0.4;
          wind = av('wind_speed_10m_max') / 3.6 * 0.6;
          rain = av('precipitation_sum') / 6;
          src = 'обычная погода на эту дату по данным прошлых лет';
        }
      }
      if (temp != null) {
        const ppt = rain > 0.2 ? (temp <= 0 || snow > 0 ? 'снег' : 'дождь') : 'без осадков';
        const pitch = temp <= -3 ? 'газон подмёрзший и жёсткий' : (ppt === 'дождь' ? 'газон мокрый, скользкий' : ppt === 'снег' ? 'газон заснежен' : temp >= 28 ? 'газон сухой, жара' : 'газон в норме');
        txt = `около ${Math.round(temp)}°C, ветер ~${Math.round(wind)} м/с, ${ppt}; ${pitch} (${src})`;
      }
    }
  } catch { }
  wcache.set(key, txt);
  return txt;
}

/* ───────── составы ───────── */
function parseFormation(f: string) {
  const n = String(f || '4-3-3').split('-').map(Number).filter(x => x > 0);
  const def = n[0] || 4, fwd = n[n.length - 1] || 3, mid = 10 - def - fwd;
  return { def, mid: Math.max(0, mid), fwd };
}
function autoPick(avail: any[], F: any, used = new Set<string>()) {
  const need: Record<string, number> = { gk: 1, def: F.def, mid: F.mid, fwd: F.fwd }, res: string[] = [];
  for (const g of ['gk', 'def', 'mid', 'fwd']) {
    for (const p of avail) {
      if (res.length >= 11 || used.has(p.id)) continue;
      if (GROUP[p.pos] === g && need[g] > 0) {
        res.push(p.id); used.add(p.id); need[g]--;
      }
    }
  }
  return res;
}
function fixLineup(L: any, tid: string, f: any) {
  const sq = squadOf(tid), ok = new Set(sq.filter((p: any) => isAvail(p, f.date)).map((p: any) => p.id));
  const F = parseFormation(L.formation); const used = new Set<string>();
  const starters: string[] = [];
  const isRpl = f.comp === 'rpl';
  const limit = isRpl ? getRplLegionLimit(S()) : null;
  let legCount = 0;

  for (const id of L.starters || []) {
    if (ok.has(id) && !used.has(id)) {
      const p = player(id);
      const isLeg = limit ? isLegionnaire(p) : false;
      if (isLeg && legCount >= limit!.onPitch) {
        continue; // skip excess legionnaire from starters to comply with limit
      }
      starters.push(id);
      used.add(id);
      if (isLeg) legCount++;
    }
  }
  const hasGK = starters.some(id => player(id)?.pos === 'ВР');
  if (!hasGK) {
    const g = sq.find((p: any) => ok.has(p.id) && p.pos === 'ВР' && !used.has(p.id));
    if (g) {
      if (starters.length >= 11) {
        const popped = starters.pop()!;
        used.delete(popped);
        if (limit && isLegionnaire(player(popped))) legCount--;
      }
      starters.push(g.id); used.add(g.id);
      if (limit && isLegionnaire(g)) legCount++;
    }
  }
  const avail = sq.filter((p: any) => ok.has(p.id));
  if (starters.length < 11) {
    for (const id of autoPick(avail.filter((p: any) => !used.has(p.id) && (!limit || legCount < limit.onPitch || !isLegionnaire(p))), { def: F.def, mid: F.mid, fwd: F.fwd }, used)) {
      starters.push(id);
      if (limit && isLegionnaire(player(id))) legCount++;
    }
  }
  for (const p of avail) {
    if (starters.length >= 11) break;
    if (!used.has(p.id)) {
      if (limit && legCount >= limit.onPitch && isLegionnaire(p)) continue;
      starters.push(p.id); used.add(p.id);
      if (limit && isLegionnaire(p)) legCount++;
    }
  }
  const bench: string[] = [];
  for (const id of L.bench || []) {
    if (ok.has(id) && !used.has(id) && !bench.includes(id)) bench.push(id);
  }
  for (const p of avail) {
    if (bench.length >= 9) break;
    if (!used.has(p.id) && !bench.includes(p.id)) bench.push(p.id);
  }
  return { formation: L.formation || '4-3-3', starters: starters.slice(0, 11), bench: bench.slice(0, 9), speech: L.speech || '', training: L.training || '' };
}
function getLineup(f: any, tid: string) {
  const own = db.lineups[f.id + ':' + tid];
  const base = own || db.tactics[tid] || { formation: '4-3-3' };
  return { ...fixLineup(base, tid, f), submitted: !!own };
}

/* ───────── контекст матча ───────── */
function motivText(tid: string, f: any) {
  const t = team(tid); const comp = compOf(t.comp); const rows = table(t.comp, f.date); const r = rows.find((x: any) => x.id === tid); const n = rows.length;
  let s = '';
  if (f.comp === 'cup') s += `Кубковый матч, проигравший выбывает из турнира. `;
  if (!r || r.p === 0) return s + `${t.name} (${comp?.name}): сезон только начинается, таблица пока не сложилась.`;
  const lead = rows[0], below = rows[Math.min(n - 1, n - 3)];
  s += `${t.name} (${comp?.name}): ${r.pos}-е место из ${n}, ${r.pts} очк. за ${r.p} матчей, мячи ${r.gf}-${r.ga}, форма: ${r.form || '—'}. `;
  if (r.pos === 1) s += `Лидирует, отрыв от второго места ${r.pts - rows[1].pts} очк. `;
  else s += `Отставание от лидера ${lead.pts - r.pts} очк. `;
  if (r.pos >= n - 2) s += 'В зоне вылета — очки нужны любой ценой. ';
  else if (r.pos >= n - 4) s += `До зоны вылета ${r.pts - below.pts} очк. — спокойствия нет. `;
  else if (r.pos <= 3) s += 'Борется за чемпионство и верх таблицы. ';
  else if (r.pos <= 6) s += 'Борется за еврокубки. ';
  else s += 'Середина таблицы, особых турнирных задач нет, но амбиции и гордость остаются. ';
  return s.trim();
}
function fatText(tid: string, f: any) {
  const prev = seasonFx().filter((x: any) => x.status === 'done' && (x.home === tid || x.away === tid) && x.date < f.date).sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 3);
  const lines = prev.map((x: any) => `${daysBetween(x.date, f.date)} дн. назад: ${compName(x)}, ${x.home === tid ? 'дома' : 'в гостях'} против ${tn(x.home === tid ? x.away : x.home)} ${x.hg}:${x.ag}`);
  const nxt = seasonFx().filter((x: any) => x.status === 'scheduled' && x.id !== f.id && (x.home === tid || x.away === tid) && x.date > f.date).sort((a: any, b: any) => a.date.localeCompare(b.date))[0];
  let s = lines.length ? 'Недавние матчи: ' + lines.join('; ') + '.' : 'Недавних официальных матчей нет (начало сезона или долгий перерыв).';
  if (nxt && daysBetween(f.date, nxt.date) <= 4) s += ` Следующий матч уже через ${daysBetween(f.date, nxt.date)} дн. (${compName(nxt)}) — возможна ротация и экономия сил.`;
  if (f.away === tid) { const d = km(team(f.away), team(f.home)); if (d) s += ` Дорога в гости ≈ ${d} км.`; }
  return s;
}
function teamStatsSummary(tid: string, comp: string) {
  const allP = Object.values<any>(agg().P).filter(x => x.t === tid && x.comp === comp);
  const topG = allP.filter(x => x.g > 0).sort((a, b) => b.g - a.g).slice(0, 3).map(x => `${x.n} (${x.g} гол.)`);
  const topA = allP.filter(x => x.a > 0).sort((a, b) => b.a - a.a).slice(0, 3).map(x => `${x.n} (${x.a} пас.)`);
  const cards = allP.filter(x => (x.yc || 0) + (x.rc || 0) * 2 > 0).sort((a, b) => (b.yc + b.rc * 2) - (a.yc + a.rc * 2)).slice(0, 3).map(x => `${x.n} (${x.yc} ЖК${x.rc ? `, ${x.rc} КК` : ''})`);
  const tStats = Object.values<any>(agg().T).find(x => x.tid === tid && x.comp === comp);
  let res = '';
  if (topG.length) res += `Бомбардиры: ${topG.join(', ')}. `;
  if (topA.length) res += `Ассистенты: ${topA.join(', ')}. `;
  if (cards.length) res += `Дисциплина (риск нарушений): ${cards.join(', ')}. `;
  if (tStats) res += `Командные показатели (${tStats.m} игр): забито ${tStats.g || 0}, xG ${+(tStats.xg || 0).toFixed(1)}, фолы ${tStats.fo || 0}, ЖК ${tStats.yc || 0}${tStats.rc ? `, КК ${tStats.rc}` : ''}.`;
  return res.trim() || 'Статистика сезона накапливается (первые туры чемпионата).';
}
function staffSummary(tid: string) {
  const staff = getStaffForTeam(tid);
  if (!staff.length) return 'нет данных о расширенном штабе';
  return staff.slice(0, 4).map(s => `${s.roleTitle || s.role}: ${s.name}`).join('; ');
}
function cardLine(p: any, date: string) {
  if (!p) return 'Игрок (нет данных)';
  const a = age(p, date), ag = agg().P;
  let seas = '';
  const row = Object.values<any>(ag).filter(x => x.pid === p.id && x.comp === 'rpl')[0];
  if (row) seas = ` В сезоне: ${row.m} игр, ${row.g} гол., ${row.a} пас., ${row.yc || 0} ЖК${row.rc ? `, ${row.rc} КК` : ''}${row.cs ? `, ${row.cs} сухих матчей` : ''}.`;
  const foot = p.foot ? `, рабочая нога: ${p.foot}` : '';
  const nat = p.nation ? `, гражданство: ${p.nation}` : (p.nat ? `, страна: ${p.nat}` : '');
  const real = p.realClub ? `, реальный клуб: ${p.realClub}` : '';
  return `${p.pos || 'ПЗ'} ${p.name}${a ? `, ${a} лет` : ''}${nat}${foot}${real} — стиль: ${p.style || 'сбалансированный'}. Достижения: ${(p.achievements || []).join('; ') || 'опыт выступлений'}. Статистика 2 сезонов: ${p.stats2y || 'регулярная игровая практика'}. Форма: ${p.form || 'стабильная'}.${seas} Характер: ${p.character || 'хладнокровный, командный игрок'}. Новости: ${p.news || 'готовится к матчу в штатном режиме'}.`;
}
async function buildCtx(f: any) {
  const ctx: any = { fid: f.id, comp: compName(f), roundLabel: roundLabel(f), date: f.date, time: f.time, names: {}, pidSide: {}, pidTeam: {}, pos: {}, lineup: {}, sides: {} };
  const H = team(f.home), A = team(f.away);
  ctx.sides = {
    home: { id: H.id, name: H.name, logo: teamLogo(H.id) },
    away: { id: A.id, name: A.name, logo: teamLogo(A.id) }
  };
  ctx.stadium = (H.stadium ? H.stadium + ', ' : '') + (H.city || '');
  for (const s of ['home', 'away']) {
    const tid = f[s], L = getLineup(f, tid); ctx.lineup[s] = L;
    for (const pid of [...L.starters, ...L.bench]) {
      const p = player(pid);
      if (p) {
        ctx.names[pid] = p.name;
        ctx.pidSide[pid] = s;
        ctx.pidTeam[pid] = tid;
        ctx.pos[pid] = p.pos;
      }
    }
  }
  const dv = db.derbies.find((d: any) => (d.a === f.home && d.b === f.away) || (d.a === f.away && d.b === f.home));
  ctx.derby = dv ? `${dv.name}. ${dv.note}` : 'нет (обычный календарный матч)';
  ctx.motiv = { home: motivText(f.home, f), away: motivText(f.away, f) };
  const top = Object.values<any>(agg().P).filter(x => x.comp === 'rpl' && x.g > 0).sort((a: any, b: any) => b.g - a.g).slice(0, 5);
  ctx.race = top.length ? top.map((x: any) => `${x.n} (${tn(x.t)}) — ${x.g}`).join('; ') : 'пока нет данных';
  ctx.weather = await weather(H, f.date, f.time);
  ctx.fat = { home: fatText(f.home, f), away: fatText(f.away, f) };
  const miss = (s: string) => squadOf(f[s]).filter((p: any) => !isAvail(p, f.date)).map((p: any) => `${p.name} (${p.banLeft > 0 ? 'дисквалификация' : 'травма'})`);
  ctx.missing = { home: miss('home'), away: miss('away') };

  const cH = getCoachForTeam(f.home), cA = getCoachForTeam(f.away);
  ctx.coaches = {
    home: { coach: cH, synergy: computeCoachSynergy(cH, ctx.lineup.home), staff: getStaffForTeam(f.home) },
    away: { coach: cA, synergy: computeCoachSynergy(cA, ctx.lineup.away), staff: getStaffForTeam(f.away) }
  };
  ctx.teamStats = {
    home: teamStatsSummary(f.home, f.comp),
    away: teamStatsSummary(f.away, f.comp)
  };
  ctx.staff = {
    home: staffSummary(f.home),
    away: staffSummary(f.away)
  };
  const comp = f.comp;
  const rows = table(comp, f.date);
  const rH = rows.find((x: any) => x.id === f.home);
  const rA = rows.find((x: any) => x.id === f.away);
  ctx.tableStandings = {
    home: rH ? `${rH.pos}-е место (${rH.pts} очк., ${rH.p} игр, ${rH.w}В ${rH.d}Н ${rH.l}П, мячи ${rH.gf}-${rH.ga}, разница ${rH.gd >= 0 ? '+' + rH.gd : rH.gd}, форма: ${rH.form || '—'}, зона: ${rH.zoneLabel || 'середина таблицы'})` : 'начало турнира',
    away: rA ? `${rA.pos}-е место (${rA.pts} очк., ${rA.p} игр, ${rA.w}В ${rA.d}Н ${rA.l}П, мячи ${rA.gf}-${rA.ga}, разница ${rA.gd >= 0 ? '+' + rA.gd : rA.gd}, форма: ${rA.form || '—'}, зона: ${rA.zoneLabel || 'середина таблицы'})` : 'начало турнира'
  };

  if (!f.refereeName && (f.comp === 'rpl' || f.comp === 'cup')) {
    assignReferee(f);
  }
  const headRef = db.referees?.find((r: any) => r.id === f.refereeId || r.name === f.refereeName) || (f.refereeName ? {
    name: f.refereeName,
    city: 'Россия',
    style: 'balanced',
    styleDesc: 'Последовательный арбитр, держит дисциплину',
    rating: 7.5,
    bio: `Главный арбитр встречи — ${f.refereeName}`,
    matches: 0, yellows: 0, reds: 0, penalties: 0
  } : null);
  const varRef = db.referees?.find((r: any) => r.name === f.varReferee) || (f.varReferee ? {
    name: f.varReferee,
    style: 'ВАР-арбитр',
    styleDesc: 'Опытный видеоассистент VAR',
    bio: `Арбитр VAR — ${f.varReferee}`
  } : null);
  const assts = Array.isArray(f.assistants) && f.assistants.length >= 2 ? f.assistants : ['Дмитрий Мосякин', 'Валентин Мурашов'];
  ctx.refereeCrew = {
    head: headRef,
    asst1: assts[0],
    asst2: assts[1],
    fourth: f.reserveReferee || 'Вера Опейкина',
    var: f.varReferee || (f.comp === 'rpl' ? 'Сергей Карасев' : null),
    varProfile: varRef,
    avar: f.avarReferee || (f.comp === 'rpl' ? 'Павел Кукуян' : null)
  };
  return ctx;
}
function lineText(ctx: any, s: string) {
  const L = ctx.lineup[s], f = ctx.date, sd = ctx.sides[s];
  const row = (pid: string) => cardLine(player(pid), f);
  return `СОСТАВ ${sd.name} (схема ${L.formation}), стартовые 11:\n${L.starters.map((p: string) => '- ' + row(p)).join('\n')}\nСкамейка запасных:\n${L.bench.map((p: string) => '- ' + row(p)).join('\n')}\nНедоступны (травмы/дисквалификации): ${ctx.missing[s].join(', ') || 'нет'}`;
}
function buildUser(ctx: any, a: number, b: number, st: any, issues: string) {
  const H = ctx.sides.home.name, A = ctx.sides.away.name;
  const sp = (s: string) => (ctx.lineup[s].speech || '').trim() ? `«${ctx.lineup[s].speech.trim()}»` : '(тренер промолчал перед выходом — команда действует по стандартному плану)';
  const tr = (s: string) => (ctx.lineup[s].training || '').trim() ? `«${ctx.lineup[s].training.trim()}»` : '(тренировочный микроцикл: общекомандная подготовка, отработка тактических связок и стандартов)';
  const cInfo = (s: string) => {
    const c = ctx.coaches[s];
    const staffNote = ctx.staff?.[s] && ctx.staff[s] !== 'нет данных о расширенном штабе' ? ` Тренерский штаб: ${ctx.staff[s]}.` : '';
    return `${c.coach.name} (${c.coach.nationality || 'Россия'}, ${c.coach.age || 45} лет, философия: ${c.coach.styleTitle || c.coach.style}). Характер на бровке: ${c.coach.temperament || 'уравновешенный'}. Любимая схема: ${c.coach.favoriteFormation || '4-3-3'}. Цитата: ${c.coach.quote || '«Играть на победу»'}. Тактическая синергия: ${c.synergy.statusTitle} (${c.synergy.score}%). ${c.synergy.description}.${staffNote}`;
  };

  const refInfo = () => {
    const rc = ctx.refereeCrew;
    if (!rc || !rc.head) return 'Судейская бригада: назначение на матч стандартное.';
    const h = rc.head;
    let s = `Главный судья: ${h.name} (${h.city || 'РФ'}, рейтинг ${h.rating || 7.5}/10, стиль: ${h.style || 'сбалансированный'}).\n  Манера судейства: ${h.styleDesc || h.bio || 'держит игру под контролем'}. Статистика: ${h.matches || 0} матчей, ${h.yellows || 0} ЖК, ${h.reds || 0} КК, ${h.penalties || 0} пенальти.`;
    s += `\n  Помощники на линиях: 1-й ассистент — ${rc.asst1}, 2-й ассистент — ${rc.asst2}.`;
    s += `\n  Резервный арбитр: ${rc.fourth}.`;
    if (rc.var) {
      s += `\n  Видеоассистенты (VAR): Главный ВАР — ${rc.var}${rc.varProfile ? ` (${rc.varProfile.styleDesc || 'опытный видеосудья'})` : ''}, АВАР — ${rc.avar || 'ассистент ВАР'}.`;
    }
    return s;
  };

  let u = `═══ МАТЧ: ${H} — ${A} | ${ctx.comp}, ${ctx.roundLabel} | ${ctx.date} ${ctx.time} | Стадион: ${ctx.stadium} ═══\n`;
  u += `ОТРЕЗОК ИГРЫ: минуты ${a}–${b}\n\n`;

  if (st) {
    u += `ТЕКУЩЕЕ СОСТОЯНИЕ МАТЧА (к минуте ${a}):\n`;
    u += `- Счёт: ${H} ${st.score[0]}:${st.score[1]} ${A}\n`;
    u += `- Предупреждения (ЖК): ${H}: ${st.yellows.home.join(', ') || 'нет'} | ${A}: ${st.yellows.away.join(', ') || 'нет'}\n`;
    u += `- Удаления (КК): ${st.reds.join(', ') || 'нет'}\n`;
    u += `- Покинули поле (травма/замена): ${st.off.join(', ') || 'нет'}\n`;
    u += `- Использовано замен: ${H} ${st.subs.home}/5, ${A} ${st.subs.away}/5 (вышли: ${st.ins.join(', ') || 'нет'})\n`;
    if (st.note) u += `- Ход игры и моментум: ${st.note}\n`;
    u += `- Хроника последних минут: ${st.last.join(' | ') || 'начало встречи'}\n\n`;
  }

  u += `1. ТУРНИРНАЯ ТАБЛИЦА И ТУРНИРНОЕ ЗНАЧЕНИЕ:\n`;
  u += `- Положение ${H}: ${ctx.tableStandings.home}\n`;
  u += `- Положение ${A}: ${ctx.tableStandings.away}\n`;
  u += `- Мотивация ${H}: ${ctx.motiv.home}\n`;
  u += `- Мотивация ${A}: ${ctx.motiv.away}\n`;
  u += `- СТАТУС ДЕРБИ / ПРИНЦИПИАЛЬНОСТЬ: ${ctx.derby}\n`;
  u += `- Гонка бомбардиров чемпионата: ${ctx.race}\n\n`;

  u += `2. СТАТИСТИКА КОМАНД В ТУРНИРЕ:\n`;
  u += `- ${H}: ${ctx.teamStats.home}\n`;
  u += `- ${A}: ${ctx.teamStats.away}\n\n`;

  u += `3. СУДЕЙСКАЯ БРИГАДА И VAR:\n${refInfo()}\n\n`;

  u += `4. ПОГОДА, ГАЗОН И ФИЗИЧЕСКИЙ ГРАФИК:\n`;
  u += `- Погода и газон: ${ctx.weather}\n`;
  u += `- Физическое состояние и график ${H}: ${ctx.fat.home}\n`;
  u += `- Физическое состояние и график ${A}: ${ctx.fat.away}\n\n`;

  u += `5. ГЛАВНЫЕ ТРЕНЕРЫ И ШТАБ:\n`;
  u += `- ${H}: ${cInfo('home')}\n`;
  u += `- ${A}: ${cInfo('away')}\n\n`;

  u += `6. ТРЕНИРОВОЧНЫЙ ПРОЦЕСС И ПРЕДМАТЧЕВЫЙ ПЛАН:\n`;
  u += `- Недельный цикл ${H}: ${tr('home')}\n`;
  u += `- Недельный цикл ${A}: ${tr('away')}\n\n`;

  u += `7. ТАКТИЧЕСКИЕ СХЕМЫ И УСТАНОВКА НА ИГРУ:\n`;
  u += `- ${H} (схема ${ctx.lineup.home.formation}): ${sp('home')}\n`;
  u += `- ${A} (схема ${ctx.lineup.away.formation}): ${sp('away')}\n\n`;

  u += `8. СОСТАВЫ И ПРОФИЛИ ИГРОКОВ (используй исключительно этих игроков):\n`;
  u += `${lineText(ctx, 'home')}\n\n${lineText(ctx, 'away')}\n`;

  if (issues) {
    u += `\nВНИМАНИЕ! Прошлая попытка генерации была отклонена: ${issues}. Строго устрани указанные замечания!\n`;
  }

  u += `\nСгенерируй отрезок матча (минуты ${a}–${b}) строго в валидном JSON без markdown-обёртки по правилам 10 разделов симулятора.`;
  return u;
}

/* ───────── обработка событий ───────── */
const TYPES = new Set('kickoff possession pass dribble tackle duel foul yellow red shot save miss post goal own_goal penalty offside corner freekick injury sub var ref_error incident cooling_break highlight halftime fulltime'.split(' '));
function indexNames(ctx: any) {
  return Object.entries<string>(ctx.names).map(([pid, n]) => ({ pid, side: ctx.pidSide[pid], full: norm(n), last: norm(n).split(' ').pop() }));
}
function resolve(idx: any[], name: string, side: string | null) {
  const n = norm(name);
  if (!n) return null;
  const pick = (c: any[]) => {
    if (c.length > 1 && side) c = c.filter((x: any) => x.side === side);
    return c.length === 1 ? c[0].pid : null;
  };
  let r = pick(idx.filter(x => x.full === n));
  if (r) return r;
  r = pick(idx.filter(x => x.full.includes(n) || n.includes(x.full)));
  if (r) return r;
  const last = n.split(' ').pop();
  return pick(idx.filter(x => x.last === last));
}
function deriveState(events: any[], ctx: any, note?: string) {
  const st: any = { score: [0, 0], yellows: { home: [], away: [] }, reds: [], off: [], subs: { home: 0, away: 0 }, ins: [], note: note || '', last: events.slice(-8).map(e => `${e.min}' ${e.text}`) };
  for (const e of events) {
    if (e.type === 'goal') st.score[e.team === 'home' ? 0 : 1]++;
    if (e.type === 'own_goal') st.score[e.team === 'home' ? 0 : 1]++;
    const nm = (i: number) => ctx.names[e.pids?.[i]];
    if (e.type === 'yellow' && nm(0)) st.yellows[e.team]?.push(nm(0));
    if (e.type === 'red' && nm(0)) { st.reds.push(nm(0)); st.off.push(nm(0)); }
    if (e.type === 'sub') { st.subs[e.team]++; if (nm(1)) st.off.push(nm(1)); if (nm(0)) st.ins.push(nm(0)); }
    if (e.type === 'injury' && nm(0) && (e.out_days === undefined || e.out_days > 0)) st.off.push(nm(0));
  }
  return st;
}
function normalizeEvents(raw: any[], a: number, b: number, ctx: any, prev: any[]) {
  if (!Array.isArray(raw) || raw.length < 3) throw new Error('слишком мало событий');
  const idx = indexNames(ctx), probs: string[] = [], unknown = new Set<string>();
  const st = deriveState(prev, ctx); const off = new Set(st.off.map(norm)); const subs = { ...st.subs };
  let out: any[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const type = String(e.type || '').toLowerCase().trim();
    if (!TYPES.has(type)) { probs.push('неизвестный тип ' + type); continue; }
    let min = Math.round(+e.min), sec = clamp(Math.round(+e.sec) || 0, 0, 59);
    if (!(min >= 0)) { probs.push('нет минуты'); continue; }
    if (min < a - 1 || min > b + 10) { probs.push(`минута ${min} вне периода ${a}–${b}`); continue; }
    const pids: string[] = [], names: string[] = [];
    for (const n of (Array.isArray(e.players) ? e.players : [])) {
      const pid = resolve(idx, n, ['home', 'away'].includes(e.team) && !['save', 'sub', 'foul', 'tackle'].includes(type) ? e.team : null);
      if (pid) { pids.push(pid); names.push(ctx.names[pid]); }
      else if (n) unknown.add(n);
    }
    let team = ['home', 'away', 'none'].includes(e.team) ? e.team : null;
    if (!team) team = pids[0] ? ctx.pidSide[pids[0]] : 'none';
    if (type === 'own_goal' && !['home', 'away'].includes(team)) { probs.push('автогол без команды'); continue; }
    const actor = (type === 'sub' || type === 'save') ? null : pids[0];
    if (actor && off.has(norm(ctx.names[actor])) && !['yellow', 'red', 'injury', 'foul'].includes(type) && !['var', 'incident', 'cooling_break', 'highlight'].includes(type)) {
      probs.push(`${ctx.names[actor]} действует после ухода с поля`);
    }
    const outDays = type === 'injury' ? (e.out_days !== undefined ? (isNaN(+e.out_days) ? 14 : clamp(Math.round(+e.out_days), 0, 240)) : 14) : undefined;
    if (type === 'red' && pids[0]) off.add(norm(ctx.names[pids[0]]));
    if (type === 'injury' && pids[0] && (outDays === undefined || outDays > 0)) off.add(norm(ctx.names[pids[0]]));
    if (type === 'sub') {
      if (['home', 'away'].includes(team)) { if (++subs[team] > 5) probs.push('больше 5 замен'); }
      if (pids[1]) off.add(norm(ctx.names[pids[1]]));
    }
    const ev: any = { min, sec, team, type, players: names, pids, text: String(e.text || '').slice(0, 500) };
    if (type === 'shot' || type === 'penalty') ev.xg = clamp(+e.xg || (type === 'penalty' ? 0.76 : 0.08), 0.01, 0.95);
    if (type === 'injury') ev.out_days = outDays;
    out.push(ev);
  }
  {
    const g = out.filter(x => x.type === 'goal' || x.type === 'own_goal');
    const tot = st.score[0] + st.score[1] + g.length;
    if (tot > 10) probs.push('нереалистично много голов (' + tot + '), матч должен выглядеть как настоящий футбол');
  }
  if (unknown.size > 4) probs.push('неизвестные игроки (используй только игроков из составов): ' + [...unknown].slice(0, 6).join(', '));
  if (probs.length > 3) throw new Error([...new Set(probs)].slice(0, 6).join('; '));
  out = out.map((e, i) => ({ e, i })).sort((x, y) => (x.e.min * 60 + x.e.sec) - (y.e.min * 60 + y.e.sec) || x.i - y.i).map(x => x.e);
  if (!out.length) throw new Error('нет валидных событий');
  const lastMin = out[out.length - 1].min;
  if (b === 45 && !out.some(e => e.type === 'halftime')) out.push({ min: Math.max(45, lastMin), sec: 59, team: 'none', type: 'halftime', players: [], pids: [], text: 'Свисток — перерыв.' });
  if (b >= 90 && !out.some(e => e.type === 'fulltime')) out.push({ min: Math.max(90, lastMin), sec: 59, team: 'none', type: 'fulltime', players: [], pids: [], text: 'Финальный свисток!' });
  return out;
}
function rescore(events: any[]) {
  let h = 0, a = 0;
  for (const e of events) {
    if (e.type === 'goal' || e.type === 'own_goal') {
      if (e.team === 'home') h++; else if (e.team === 'away') a++;
    }
    e.score = [h, a];
  }
  return [h, a];
}

/* запасной генератор, если нейросеть недоступна */
function fakePeriod(a: number, b: number, ctx: any, prev: any[]) {
  const ev: any[] = [], R = rng(ctx.fid + a), pick = (arr: any[]) => arr[Math.floor(R() * arr.length)];
  const st = deriveState(prev, ctx); const off = new Set(st.off);
  const onP = (s: string) => Object.keys(ctx.names).filter(p => ctx.pidSide[p] === s && ctx.lineup[s].starters.includes(p) && !off.has(ctx.names[p]));
  const push = (min: number, sec: number, team: string, type: string, pl: string[], text: string, x?: any) => {
    const o = { min, sec, team, type, players: pl.map(p => ctx.names[p]), pids: pl, text, ...x };
    ev.push(o);
  };
  if (a === 1 || a === 46) push(a, 0, 'none', 'kickoff', [], a === 1 ? 'Начали! Мяч в игре.' : 'Начался второй тайм.');
  let hold = R() < .5 ? 'home' : 'away';
  for (let m = a; m <= b; m++) {
    if (R() < .3) hold = hold === 'home' ? 'away' : 'home';
    const s = hold, o = s === 'home' ? 'away' : 'home', P = onP(s), Q = onP(o);
    if (!P.length || !Q.length) continue;
    const p1 = pick(P), p2 = pick(P);
    push(m, 5, s, 'pass', [p1, p2], `${ctx.names[p1]} отдаёт мяч ${ctx.names[p2]}, ${ctx.sides[s].name} держит игру.`);
    const r = R();
    const synS = ctx.coaches?.[s]?.synergy;
    const shotThreshold = 0.13 * (synS?.xgMultiplier || 1.0);
    if (r < shotThreshold) {
      const sh = pick(P.filter(p => GROUP[ctx.pos[p]] !== 'gk')) || P[0];
      const gk = Q.find(p => ctx.pos[p] === 'ВР') || Q[0];
      const x = +(0.04 + R() * .25 * (synS?.xgMultiplier || 1.0)).toFixed(2);
      push(m, 20, s, 'shot', [sh], `${ctx.names[sh]} бьёт по воротам!`, { xg: x });
      const q = R();
      const goalThreshold = 0.22 * (synS?.xgMultiplier || 1.0);
      if (q < goalThreshold) {
        push(m, 23, s, 'goal', [sh, p2 !== sh ? p2 : p1], `ГОЛ! ${ctx.names[sh]} переигрывает вратаря!`);
      } else if (q < .6) {
        push(m, 23, o, 'save', [gk, sh], `${ctx.names[gk]} вытаскивает мяч!`);
      } else {
        push(m, 23, s, 'miss', [sh], 'Мимо ворот.');
      }
    } else if (r < .24) {
      const f = pick(Q), v = pick(P);
      push(m, 40, o, 'foul', [f, v], `${ctx.names[f]} нарушает правила против ${ctx.names[v]}.`);
      if (R() < .15) push(m, 45, o, 'yellow', [f], `Жёлтая карточка ${ctx.names[f]}.`);
    } else if (r < .31) {
      push(m, 35, s, 'corner', [], `Угловой в пользу ${ctx.sides[s].name}.`);
    } else if (r < .4) {
      const t = pick(Q), l = pick(P);
      push(m, 50, o, 'tackle', [t, l], `${ctx.names[t]} отбирает мяч у ${ctx.names[l]}.`);
      hold = o;
    }
  }
  if (b === 45) push(45, 59, 'none', 'halftime', [], 'Перерыв.');
  if (b >= 90) push(90, 59, 'none', 'fulltime', [], 'Матч окончен.');
  return ev;
}
async function genPeriod(a: number, b: number, ctx: any, prev: any[], note?: string, depth = 0): Promise<any> {
  const sys = db.settings.systemPrompt || SYS_DEFAULT;
  if (!hasLLM()) return { events: fakePeriod(a, b, ctx, prev), note };
  let issues = '', lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const st = prev.length ? deriveState(prev, ctx, note) : null;
      const user = buildUser(ctx, a, b, st, issues);
      if (!ctx.prompt1) ctx.prompt1 = user;
      const r = await llmJSON(sys, user, { task: 'match', temp: 0.9, max: 20000 });
      const evs = normalizeEvents(r.events, a, b, ctx, prev);
      return { events: evs, note: r.state_at_end?.momentum_note || note };
    } catch (e: any) {
      lastErr = e.message;
      issues = e.message;
      if (e.noLLM) break;
    }
  }
  if (b - a >= 14) {
    const mid = Math.floor((a + b) / 2);
    const x = await genPeriod(a, mid, ctx, prev, note, depth + 1);
    const y = await genPeriod(mid + 1, b, ctx, prev.concat(x.events), x.note, depth + 1);
    return { events: x.events.concat(y.events), note: y.note };
  }
  console.error(`период ${a}-${b}: запасной вариант (${lastErr})`);
  return { events: fakePeriod(a, b, ctx, prev), note, fallback: true };
}

/* ───────── статистика матча ───────── */
function computeStats(events: any[], ctx: any) {
  const mk = () => ({ g: 0, sh: 0, sot: 0, xg: 0, fo: 0, co: 0, yc: 0, rc: 0, tk: 0, sv: 0, off: 0, penF: 0, penA: 0, refF: 0, refA: 0, sub: 0 });
  const t: any = { home: mk(), away: mk() }, P: Record<string, any> = {}, posT: any = { home: 0, away: 0 };
  const pl = (pid: string) => {
    if (!pid) return {};
    return P[pid] ||= { n: ctx.names[pid], t: ctx.pidTeam[pid], side: ctx.pidSide[pid], min: 0, g: 0, a: 0, yc: 0, rc: 0, tk: 0, sv: 0, sh: 0, xg: 0, ff: 0, fa: 0, cs: 0 };
  };
  const start: Record<string, number> = {}, end: Record<string, number> = {};
  for (const s of ['home', 'away']) {
    for (const pid of ctx.lineup[s].starters) start[pid] = 0;
  }
  const lastMin = events.length ? Math.max(90, events[events.length - 1].min) : 90;
  const playT = new Set(['possession', 'pass', 'dribble', 'tackle', 'shot', 'corner', 'freekick', 'save', 'miss', 'post', 'goal', 'penalty', 'offside']);
  let open: any = null;
  events.forEach((e, i) => {
    const s = e.team, o = s === 'home' ? 'away' : 'home', ok = s === 'home' || s === 'away', T = ok ? t[s] : null, To = ok ? t[o] : null;
    if (ok && playT.has(e.type) && events[i + 1]) T && (posT[s] += clamp((events[i + 1].min * 60 + events[i + 1].sec) - (e.min * 60 + e.sec), 0, 75));
    const p0 = e.pids[0], p1 = e.pids[1];
    switch (e.type) {
      case 'shot': if (ok) { T.sh++; T.xg += e.xg || 0.08; open = { s, pid: p0 }; const x = pl(p0); if (x.sh !== undefined) { x.sh++; x.xg += e.xg || 0.08; } } break;
      case 'penalty': if (ok) { T.penF++; To.penA++; } break;
      case 'goal': if (ok) { T.g++; T.sot++; if (!open) { T.sh++; T.xg += 0.3; } pl(p0).g++; if (p1) pl(p1).a++; if (!open && p0) { pl(p0).sh++; } } open = null; break;
      case 'own_goal': if (ok) T.g++; break;
      case 'save': if (ok) { T.sv++; if (!open) { To.sh++; To.xg += 0.1; } To.sot++; pl(p0).sv++; if (!open && p1) pl(p1).sh++; } open = null; break;
      case 'miss': case 'post': if (ok && !open) { T.sh++; T.xg += 0.05; if (p0) pl(p0).sh++; } open = null; break;
      case 'foul': if (ok) { T.fo++; if (p0) pl(p0).ff++; if (p1) pl(p1).fa++; } break;
      case 'yellow': if (ok) { T.yc++; if (p0) pl(p0).yc++; } break;
      case 'red': if (ok) { T.rc++; if (p0) { pl(p0).rc++; end[p0] = e.min; } } break;
      case 'corner': if (ok) T.co++; break;
      case 'offside': if (ok) T.off++; break;
      case 'tackle': if (ok) { T.tk++; if (p0) pl(p0).tk++; } break;
      case 'ref_error': if (ok) { T.refF++; To.refA++; } break;
      case 'sub': if (ok) { T.sub++; if (p1) end[p1] = e.min; if (p0) start[p0] = e.min; } break;
    }
  });
  for (const pid of Object.keys(start)) {
    const x = pl(pid);
    x.min = Math.max(0, (end[pid] ?? lastMin) - start[pid]);
  }
  for (const side of ['home', 'away']) {
    const conc = t[side === 'home' ? 'away' : 'home'].g;
    if (conc === 0) {
      for (const pid of Object.keys(start)) {
        if (ctx.pidSide[pid] === side && ctx.pos[pid] === 'ВР' && end[pid] === undefined) pl(pid).cs = 1;
      }
    }
  }
  for (const side of ['home', 'away']) t[side].xg = +t[side].xg.toFixed(2);
  for (const x of Object.values<any>(P)) x.xg = +x.xg.toFixed(2);
  const tot = posT.home + posT.away || 1;
  const poss = [Math.round(posT.home / tot * 100)];
  poss.push(100 - poss[0]);
  return { teams: t, players: P, poss };
}

/* ───────── запуск матчей и трансляция ───────── */
const live: Record<string, { clients: Set<any> }> = {};
const timers: Record<string, any> = {};
const fullSim = (f: any) => squadOf(f.home).length >= 14 && squadOf(f.away).length >= 14;
const queue: string[] = [];
let running = 0;
function enqueue(id: string) {
  const f = fx(id);
  if (!f || f.status !== 'scheduled') return;
  f.status = 'queued';
  save();
  queue.push(id);
  pumpQ();
}
function pumpQ() {
  while (running < 2 && queue.length) {
    running++;
    runMatch(queue.shift()!).catch(e => console.error('runMatch', e)).finally(() => { running--; pumpQ(); });
  }
}
async function runMatch(id: string) {
  const f = fx(id);
  f.status = 'generating';
  f.err = '';
  save();
  try {
    const ctx = await buildCtx(f);
    const periods = db.settings.chunks == 6 ? [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75], [76, 90]] : [[1, 45], [46, 90]];
    let events: any[] = [], note = '', fallback = false;
    for (const [a, b] of periods) {
      const r = await genPeriod(a, b, ctx, events, note);
      events = events.concat(r.events);
      note = r.note;
      fallback = fallback || r.fallback;
    }
    events.forEach((e, i) => e.i = i);
    const [h, a] = rescore(events);
    putMatch(id, { events, ctx, fallback });
    f.final = [h, a];
    f.hg = 0;
    f.ag = 0;
    f.pos = 0;
    f.status = 'live';
    f.fallback = !!fallback;
    save();
    startLive(id);
  } catch (e: any) {
    console.error('матч не удался:', e);
    f.status = 'scheduled';
    f.err = e.message;
    save();
  }
}
function startLive(id: string) {
  const f = fx(id), m = getMatch(id);
  live[id] ||= { clients: new Set() };
  if (f.pos === 0) {
    tg(`🏟 <b>${esc(tn(f.home))} — ${esc(tn(f.away))}</b>\n${esc(compName(f))}, ${esc(roundLabel(f))}\nТрансляция началась${db.settings.siteUrl ? `: ${esc(db.settings.siteUrl)}/#/match/${id}` : ''}`);
  }
  const step = () => {
    if (f.pos >= m.events.length) return finish(id);
    const e = m.events[f.pos++];
    f.hg = e.score[0]; f.ag = e.score[1];
    pushLive(id, { type: 'event', e });
    tgEvent(f, e);
    save();
    const nx = m.events[f.pos];
    let d = 1500;
    if (nx) {
      const dm = ((nx.min * 60 + nx.sec) - (e.min * 60 + e.sec)) / 60;
      d = clamp(dm * db.settings.secPerMin * 1000, Math.min(900, db.settings.secPerMin * 1000), 20000);
      if (e.type === 'halftime') d = Math.max(d, db.settings.breakSec * 1000);
    }
    timers[id] = setTimeout(step, d);
  };
  step();
}
function pushLive(id: string, obj: any) {
  const l = live[id];
  if (!l) return;
  const s = 'data: ' + JSON.stringify(obj) + '\n\n';
  for (const r of l.clients) r.write(s);
}
function finish(id: string) {
  const f = fx(id), m = getMatch(id);
  f.hg = f.final[0]; f.ag = f.final[1];
  f.st = computeStats(m.events, m.ctx);
  m.stats = f.st;
  const HName = tn(f.home), AName = tn(f.away);
  const cH = getCoachForTeam(f.home), cA = getCoachForTeam(f.away);
  m.ratings = computeMatchRatings(m, f, HName, AName);
  m.motm = getMatchMotm(m, f, HName, AName, cH, cA);
  if (m.motm) f.motm = { pid: m.motm.pid, name: m.motm.name, rating: m.motm.rating };
  putMatch(id, m);
  if ((f.comp === 'cup' || f.comp === 'supercup') && f.hg === f.ag && !f.pen) f.pen = shootout(f);
  checkPlayoffShootout(f);
  f.status = 'done';
  updateRefereeStats(f, m.events);
  if (f.comp === 'cup') advanceCup();
  for (const s of ['home', 'away']) {
    for (const pid of Object.keys(m.ctx.names)) {
      if (m.ctx.pidSide[pid] !== s) continue;
      const p = player(pid);
      if (p && p.banLeft > 0 && !m.ctx.lineup[s].starters.includes(pid) && !m.ctx.lineup[s].bench.includes(pid)) p.banLeft--;
    }
    for (const p of squadOf(f[s])) {
      if (p.banLeft > 0 && !(f.st.players[p.id])) p.banLeft--;
    }
  }
  for (const e of m.events) {
    const p = player(e.pids?.[0]);
    if (!p) continue;
    if (e.type === 'injury' && (e.out_days === undefined || e.out_days > 0)) p.out = { until: addDays(f.date, e.out_days || 14), reason: e.text.slice(0, 120) };
    if (e.type === 'red') p.banLeft = 1;
    if (e.type === 'yellow') {
      p.seasonYC = (p.seasonYC || 0) + 1;
      if (p.seasonYC % 4 === 0) p.banLeft = Math.max(p.banLeft || 0, 1);
    }
  }
  invalidateAgg();
  advanceCup();
  save();
  const st = f.st;
  tg(`🏁 <b>Итог: ${esc(tn(f.home))} ${f.hg}:${f.ag} ${esc(tn(f.away))}</b>${f.pen ? ` (пен. ${f.pen.hg}:${f.pen.ag})` : ''}\nВладение ${st.poss[0]}–${st.poss[1]}, удары ${st.teams.home.sh}–${st.teams.away.sh}, xG ${st.teams.home.xg}–${st.teams.away.xg}${db.settings.siteUrl ? `\n${esc(db.settings.siteUrl)}/#/match/${id}` : ''}`);
  pushLive(id, { type: 'end' });
  delete timers[id];
}
function shootout(f: any) {
  const r = rng(f.id + 'pen');
  let h = 3 + Math.floor(r() * 3), a = 3 + Math.floor(r() * 3);
  if (h === a) { r() < .5 ? h++ : a++; }
  return { hg: h, ag: a, winner: h > a ? 'home' : 'away' };
}
function checkPlayoffShootout(f: any) {
  if (f.comp !== 'playoff' && f.comp !== 'playoff_rpl_fnl') return;
  if (f.playoffLeg === 2) {
    const leg1 = db.fixtures.find((x: any) => x.season === f.season && x.playoffTieId === f.playoffTieId && x.playoffLeg === 1);
    if (leg1 && (leg1.status === 'done' || leg1.hg !== null)) {
      const aggH = (leg1.ag || 0) + (f.hg || 0);
      const aggA = (leg1.hg || 0) + (f.ag || 0);
      if (aggH === aggA && !f.pen) {
        f.pen = shootout(f);
      }
    }
  } else if (!f.playoffLeg || f.playoffLeg === 1 && f.playoffTieId?.startsWith('media')) {
    if (f.hg === f.ag && !f.pen) {
      f.pen = shootout(f);
    }
  }
}
function resumeLive() {
  for (const f of db.fixtures) {
    if (f.status === 'live' && getMatch(f.id)) startLive(f.id);
    else if (['live', 'generating', 'queued'].includes(f.status)) { f.status = 'scheduled'; }
  }
  save();
}

/* Telegram */
const tgQ: string[] = [];
let tgBusy = false;
function tg(text: string) {
  if (!db.settings.tgToken || !db.settings.tgChat) return;
  tgQ.push(text);
  tgPump();
}
async function tgPump() {
  if (tgBusy) return;
  tgBusy = true;
  while (tgQ.length) {
    const t = tgQ.shift()!;
    try {
      const r = await fetch(`https://api.telegram.org/bot${db.settings.tgToken}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: db.settings.tgChat, text: t, parse_mode: 'HTML', disable_web_page_preview: true })
      });
      if (r.status === 429) {
        const j: any = await r.json().catch(() => ({}));
        tgQ.unshift(t);
        await sleep((j.parameters?.retry_after || 5) * 1000);
      }
    } catch { }
    await sleep(1100);
  }
  tgBusy = false;
}
const TGI: Record<string, string> = { goal: '⚽', own_goal: '⚽', yellow: '🟨', red: '🟥', injury: '🚑', penalty: '🎯', var: '📺', ref_error: '🧑‍⚖️', halftime: '⏸', fulltime: '🏁', highlight: '🔥', incident: '❗', save: '🧤', post: '🥅', sub: '🔁', kickoff: '▶️' };
function tgEvent(f: any, e: any) {
  if (!['goal', 'own_goal', 'yellow', 'red', 'injury', 'penalty', 'var', 'ref_error', 'highlight', 'incident', 'halftime', 'kickoff', 'sub', 'post'].includes(e.type) && !(e.type === 'save' && (e.xg || 0) > 0)) return;
  if (e.type === 'sub' || (e.type === 'kickoff' && e.min > 1)) return;
  const sc = (e.type === 'goal' || e.type === 'own_goal') ? `\n<b>${esc(tn(f.home))} ${e.score[0]}:${e.score[1]} ${esc(tn(f.away))}</b>` : '';
  tg(`${TGI[e.type] || '•'} <b>${e.min}'</b> ${esc(e.text)}${sc}`);
}

/* фоновые матчи */
const BG_SYS = `Ты — сводка результатов российского футбола в симуляторе. По списку матчей верни реалистичные счета. Учитывай уровень лиги, класс команд, домашнее поле и положение в таблице, если оно дано. Счета разные и естественные для футбола: чаще 1:0, 1:1, 2:1, 2:0, 0:0, иногда крупнее. В кубке ничьих не бывает: при равном счёте укажи победителя по пенальти в поле "winner" ("home" или "away").
Верни только JSON: {"results":[{"id":"...","hg":1,"ag":0,"winner":"home|away (только кубок при ничьей)","note":"необязательно, 5-10 слов"}]}`;
function poisson(l: number, r: () => number) {
  let L = Math.exp(-l), k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}
async function bgResults(list: any[]) {
  if (!list.length) return;
  let res: any = null;
  if (hasLLM()) {
    try {
      const rows: Record<string, any> = {};
      const pos = (tid: string) => {
        const t = team(tid);
        if (!rows[t.comp]) rows[t.comp] = table(t.comp);
        const r = rows[t.comp].find((x: any) => x.id === tid);
        return r && r.p ? ` (${r.pos}-е, ${r.pts} очк.)` : '';
      };
      const text = list.map(f => `${f.id} | ${compName(f)}${f.comp === 'cup' ? ' (кубок)' : ''} | ${tn(f.home)}${pos(f.home)} — ${tn(f.away)}${pos(f.away)}`).join('\n');
      const r = await llmJSON(BG_SYS, text, { task: 'bg', temp: 1, max: 12000 });
      res = r.results || r;
    } catch (e: any) {
      console.error('bg:', e.message);
    }
  }
  for (const f of list) {
    let x = Array.isArray(res) ? res.find(z => z && z.id === f.id) : null;
    if (!x || !Number.isInteger(+x.hg) || !Number.isInteger(+x.ag) || +x.hg > 9 || +x.ag > 9) {
      const r = rng(f.id + Date.now());
      x = { hg: poisson(1.45, r), ag: poisson(1.1, r) };
    }
    f.hg = +x.hg; f.ag = +x.ag; f.note = x.note || '';
    if ((f.comp === 'cup' || f.comp === 'supercup') && f.hg === f.ag) {
      const w = x.winner === 'home' || x.winner === 'away' ? x.winner : (rng(f.id)() < .5 ? 'home' : 'away');
      f.pen = { hg: w === 'home' ? 5 : 4, ag: w === 'home' ? 4 : 5, winner: w };
    }
    checkPlayoffShootout(f);
    f.status = 'done';
    f.st = null;
    const hSq = squadOf(f.home), aSq = squadOf(f.away);
    const winSq = f.hg >= f.ag ? hSq : aSq;
    const pMotm = winSq[0] || hSq[0];
    if (pMotm) {
      f.motm = { pid: pMotm.id, name: pMotm.name, rating: +(7.5 + (f.hg > f.ag ? 0.8 : 0.3)).toFixed(1) };
    }
  }
  invalidateAgg();
}
async function runBatch(list: any[]) {
  list = list.filter(f => f.status === 'scheduled');
  const full = list.filter(fullSim), bg = list.filter(f => !fullSim(f));
  bg.forEach(f => f.status = 'queued');
  await bgResults(bg);
  advanceCup();
  save();
  full.forEach(f => enqueue(f.id));
  return { full: full.length, bg: bg.length };
}

/* ───────── генерация сезона и кубок ───────── */
function genSeason(start: string, name: string) {
  db.settings.season = name;
  const season = name;
  const startYear = parseInt(String(start).slice(0, 4), 10) || 2026;
  db.internationalBreaks = [
    { id: 'ib_sep', name: 'Пауза на сборные (сентябрь)', start: `${startYear}-08-31`, end: `${startYear}-09-09` },
    { id: 'ib_oct', name: 'Пауза на сборные (октябрь)', start: `${startYear}-10-05`, end: `${startYear}-10-14` },
    { id: 'ib_nov', name: 'Пауза на сборные (ноябрь)', start: `${startYear}-11-09`, end: `${startYear}-11-18` },
    { id: 'winter_break', name: 'Зимний перерыв в РПЛ', start: `${startYear}-12-14`, end: `${startYear + 1}-02-27` },
    { id: 'ib_mar', name: 'Пауза на сборные (март)', start: `${startYear + 1}-03-22`, end: `${startYear + 1}-03-31` }
  ];

  // Выравниваем старт до ближайшей субботы
  let cur = start;
  while (new Date(cur + 'T12:00:00Z').getUTCDay() !== 6) cur = addDays(cur, 1);

  // Генерируем выходные туров с учетом пауз на сборные и зимнего перерыва
  const weekends: { sat: string; hasCup: boolean; hasRplCup: boolean; cupStage?: string }[] = [];
  const regWeeks: { tue: string; wed: string; thu: string }[] = [];
  const rplWeeks: { tue: string; wed: string; thu: string }[] = [];

  let cupTurn: 'regions' | 'rpl' = 'regions'; // Чередуются: Путь регионов, затем Путь РПЛ
  let weekIdx = 0;

  // Формируем игровые недели (30 туров РПЛ + запас на другие турниры)
  while (weekends.length < 45) {
    const sat = cur;
    const sun = addDays(sat, 1);
    const tue = addDays(sat, -4);
    const wed = addDays(sat, -3);
    const thu = addDays(sat, -2);

    if (!isInInternationalBreak(sat) && !isInInternationalBreak(sun)) {
      const midBreak = isInInternationalBreak(tue) || isInInternationalBreak(wed) || isInInternationalBreak(thu);
      let hasCup = false;
      let hasRplCup = false;
      let cupStage = '';

      // В осенней части (до зимнего перерыва) распределяем 12 кубковых мидвиков (6 регионов и 6 РПЛ, чередуясь)
      if (!midBreak && weekIdx > 0 && sat < `${startYear}-12-14`) {
        if (cupTurn === 'regions' && regWeeks.length < 6) {
          regWeeks.push({ tue, wed, thu });
          hasCup = true;
          hasRplCup = false; // играют только команды Пути регионов, в РПЛ кубка нет!
          cupStage = `Путь регионов · ${regWeeks.length}-й раунд`;
          cupTurn = 'rpl';
        } else if (cupTurn === 'rpl' && rplWeeks.length < 6) {
          rplWeeks.push({ tue, wed, thu });
          hasCup = true;
          hasRplCup = true; // играют команды РПЛ в Пути РПЛ!
          cupStage = `Путь РПЛ · ${rplWeeks.length}-й тур`;
          cupTurn = 'regions';
        }
      }

      weekends.push({ sat, hasCup, hasRplCup, cupStage });
      weekIdx++;
    }
    cur = addDays(cur, 7);
  }

  // Очищаем старые матчи текущего сезона перед генерацией
  db.fixtures = db.fixtures.filter((f: any) => f.season !== season);
  ensureSuperCupFixture(season);

  const r = rng('season' + name);
  for (const comp of COMPS.filter(x => x.type === 'league')) {
    const c = comp.id;
    let ids: (string | null)[] = db.teams.filter((t: any) => t.comp === c).map((t: any) => t.id);
    if (ids.length < 2) continue;
    if (ids.length % 2) ids.push(null);
    const n = ids.length, arr = [...ids], rounds: any[] = [];
    for (let k = 0; k < n - 1; k++) {
      const pairs: any[] = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a && b) pairs.push(k % 2 ? [b, a] : [a, b]);
      }
      rounds.push(pairs);
      arr.splice(1, 0, arr.pop()!);
    }
    const all = rounds.concat(rounds.map(p => p.map(([a, b]: any) => [b, a])));
    all.forEach((pairs, ri) => {
      const wk = weekends[ri] || { sat: addDays(start, ri * 7), hasCup: false, hasRplCup: false };
      const sat = wk.sat;
      let order = shuffle(pairs, r);
      const dIdx = order.findIndex(([a, b]: any) => db.derbies.some((x: any) => (x.a === a && x.b === b) || (x.a === b && x.b === a)));
      if (dIdx >= 0 && c === 'rpl') {
        const [dm] = order.splice(dIdx, 1);
        order.splice(Math.min(3, order.length), 0, dm);
      }
      order.forEach(([a, b]: any, mi) => {
        let dd = sat, tm = '16:30';
        if (c === 'rpl') {
          if (!wk.hasRplCup) {
            // Без Пути РПЛ на неделе: матчи начинаются с пятницы!
            // 1 игра в пятницу (19:00), в субботу 3 или 4 игры и в воскресенье 4 или 3 игры
            if (mi === 0) {
              dd = addDays(sat, -1); // Пятница (1 игра)
              tm = '19:00';
            } else {
              const satCount = (ri % 2 === 0) ? 3 : 4;
              if (mi <= satCount) {
                dd = sat; // Суббота (3 или 4 игры)
                const times = satCount === 3 ? ['14:00', '16:30', '19:00'] : ['13:00', '15:15', '17:30', '20:00'];
                tm = times[(mi - 1) % times.length];
              } else {
                dd = addDays(sat, 1); // Воскресенье (соответственно 4 или 3 игры)
                const sunTimes = satCount === 3 ? ['14:00', '16:30', '19:00', '21:00'] : ['14:00', '16:30', '19:00'];
                tm = sunTimes[(mi - 1 - satCount) % sunTimes.length];
              }
            }
          } else {
            // Есть кубок на неделе: в субботу 3 игры, воскресенье 4 игры и 1 игра в понедельник
            if (mi < 3) {
              dd = sat; // Суббота (3 игры)
              tm = ['14:00', '16:30', '19:00'][mi];
            } else if (mi < 7) {
              dd = addDays(sat, 1); // Воскресенье (4 игры)
              tm = ['14:00', '16:30', '19:00', '21:00'][mi - 3];
            } else {
              dd = addDays(sat, 2); // Понедельник (1 игра)
              tm = '19:30';
            }
          }
        } else {
          dd = addDays(sat, mi % 2);
          tm = ['12:00', '14:00', '15:00', '16:30'][mi % 4];
        }
        const fxObj: any = { id: uid(), season, comp: c, round: ri + 1, date: dd, time: tm, home: a, away: b, status: 'scheduled', hg: null, ag: null, pos: 0 };
        assignReferee(fxObj);
        db.fixtures.push(fxObj);
      });
    });
  }

  // Формируем Winline Кубок Лиги (2026): 20 команд Медиалиги, 4 группы по 5 команд
  const allMediaTeams = db.teams.filter((t: any) => t.comp === 'media' || t.comp === 'media_div2');
  const shuffledMedia = shuffle(allMediaTeams.map((t: any) => t.id), r);
  const mflCupGroups = ['A', 'B', 'C', 'D'];
  mflCupGroups.forEach((gid, gi) => {
    const gTeams = shuffledMedia.slice(gi * 5, (gi + 1) * 5);
    let roundNum = 1;
    for (let i = 0; i < gTeams.length; i++) {
      for (let j = i + 1; j < gTeams.length; j++) {
        const wk = weekends[(roundNum - 1) % weekends.length] || { sat: addDays(start, roundNum * 7) };
        const fxObj: any = {
          id: uid(),
          season,
          comp: 'media_cup',
          round: roundNum,
          group: gid,
          date: addDays(wk.sat, -3),
          time: '19:00',
          home: gTeams[i],
          away: gTeams[j],
          status: 'scheduled',
          hg: null,
          ag: null,
          pos: 0
        };
        assignReferee(fxObj);
        db.fixtures.push(fxObj);
        roundNum++;
      }
    }
  });

  // Формируем FONBET Кубок России 2026/2027: Путь РПЛ (4 группы) и Путь регионов (отборочные раунды)
  const rplTeams = db.teams.filter((t: any) => t.comp === 'rpl');
  const fnlTeams = db.teams.filter((t: any) => t.comp === 'fnl');
  const secondLeagueTeams = db.teams.filter((t: any) => t.comp.startsWith('2la') || t.comp.startsWith('2lb'));
  const mediaTeams = allMediaTeams;

  const { cupState, fixtures: cupFixtures } = initCup2026(
    season,
    rplTeams,
    fnlTeams,
    secondLeagueTeams,
    mediaTeams,
    uid,
    { rplWeeks, regWeeks }
  );

  cupFixtures.forEach((f: any) => assignReferee(f));
  db.cupState2026 = cupState;
  db.fixtures.push(...cupFixtures);

  db.players.forEach((p: any) => { p.seasonYC = 0; p.banLeft = 0; });
  ensureDualTimes(season, true);
  invalidateAgg();
  save();
}

function advanceCup() {
  if (!db.cupState2026) {
    const rplTeams = db.teams.filter((t: any) => t.comp === 'rpl');
    const fnlTeams = db.teams.filter((t: any) => t.comp === 'fnl');
    const secondLeagueTeams = db.teams.filter((t: any) => t.comp.startsWith('2la') || t.comp.startsWith('2lb'));
    const mediaTeams = db.teams.filter((t: any) => t.comp === 'media' || t.comp === 'media_div2');
    const { cupState, fixtures: cupFixtures } = initCup2026(S(), rplTeams, fnlTeams, secondLeagueTeams, mediaTeams, uid);
    cupFixtures.forEach((f: any) => assignReferee(f));
    db.cupState2026 = cupState;
    db.fixtures = db.fixtures.filter((f: any) => f.comp !== 'cup').concat(cupFixtures);
    save();
  }

  // Пересчет турнирных таблиц групп Пути РПЛ
  recalculateCupGroups(db.cupState2026, seasonFx());

  // Проверяем завершение раундов Пути регионов и динамически создаем следующий раунд:
  // Раунды 1->2, 2->3, 3->4 (старт 18 клубов ФНЛ), 4->5, 5->6
  for (let r = 1; r <= 5; r++) {
    const roundFx = seasonFx().filter((f: any) => f.comp === 'cup' && f.cupPath === 'regions_qual' && f.qualRound === r);
    const nextFx = seasonFx().filter((f: any) => f.comp === 'cup' && f.cupPath === 'regions_qual' && f.qualRound === r + 1);

    if (roundFx.length > 0 && roundFx.every((f: any) => f.status === 'done') && nextFx.length === 0) {
      const newFixtures = drawNextRegionsRound(db.cupState2026, r, roundFx, uid);
      newFixtures.forEach((f: any) => assignReferee(f));
      db.fixtures.push(...newFixtures);
      save();
    }
  }

  // Проверяем 6-й раунд регионов:
  const r6Fx = seasonFx().filter((f: any) => f.comp === 'cup' && f.cupPath === 'regions_qual' && f.qualRound === 6);
  if (r6Fx.length > 0 && r6Fx.every((f: any) => f.status === 'done')) {
    const r6Info = db.cupState2026.regionsQualRounds?.find((qr: any) => qr.round === 6);
    if (r6Info) r6Info.completed = true;
  }

  // Проверка: завершен ли групповой этап Пути РПЛ (48 матчей)
  const rplGroupFx = seasonFx().filter((f: any) => f.comp === 'cup' && f.cupPath === 'rpl_group');
  const allGroupsDone = rplGroupFx.length >= 48 && rplGroupFx.every((f: any) => f.status === 'done');
  const existingR16 = seasonFx().filter((f: any) => f.comp === 'cup' && f.cupStage === 'rpl_playoff_r16');

  if (allGroupsDone && !existingR16.length) {
    db.cupState2026.stage = 'playoff_spring';
    const tA = db.cupState2026.rplGroups['A'].table;
    const tB = db.cupState2026.rplGroups['B'].table;
    const tC = db.cupState2026.rplGroups['C'].table;
    const tD = db.cupState2026.rplGroups['D'].table;

    // Пары 1/8 финала Пути РПЛ (двухматчевые):
    // 1-й матч дома проводит команда, занявшая 2-е место в группе!
    const ties = [
      { a: tA[0].id, b: tB[1].id, name: '1/8 финала Пути РПЛ · Пара 1' },
      { a: tB[0].id, b: tA[1].id, name: '1/8 финала Пути РПЛ · Пара 2' },
      { a: tC[0].id, b: tD[1].id, name: '1/8 финала Пути РПЛ · Пара 3' },
      { a: tD[0].id, b: tC[1].id, name: '1/8 финала Пути РПЛ · Пара 4' }
    ];

    ties.forEach((tie, idx) => {
      // 1-й матч (дома 2-е место - tie.b)
      const fx1 = {
        id: uid(),
        season: S(),
        comp: 'cup',
        cupPath: 'rpl_playoff',
        cupStage: 'rpl_playoff_r16',
        tieId: `r16_${idx + 1}`,
        leg: 1,
        round: 201,
        label: `${tie.name} (1-й матч)`,
        date: '2027-03-03',
        time: idx % 2 === 0 ? '18:00' : '20:30',
        home: tie.b,
        away: tie.a,
        status: 'scheduled',
        hg: null,
        ag: null,
        pos: 0
      };
      assignReferee(fx1);
      db.fixtures.push(fx1);

      // 2-й матч (дома 1-е место - tie.a)
      const fx2 = {
        id: uid(),
        season: S(),
        comp: 'cup',
        cupPath: 'rpl_playoff',
        cupStage: 'rpl_playoff_r16',
        tieId: `r16_${idx + 1}`,
        leg: 2,
        round: 202,
        label: `${tie.name} (Ответный матч)`,
        date: '2027-03-17',
        time: idx % 2 === 0 ? '18:00' : '20:30',
        home: tie.a,
        away: tie.b,
        status: 'scheduled',
        hg: null,
        ag: null,
        pos: 0
      };
      assignReferee(fx2);
      db.fixtures.push(fx2);
    });

    // 1/8 финала Пути регионов: 3-и места групп РПЛ против 4 победителей 6-го отборочного раунда регионов
    // В паре с командой не из РПЛ хозяин — клуб не из РПЛ!
    const thirdPlaces = [tA[2].id, tB[2].id, tC[2].id, tD[2].id];
    const r6FxDone = seasonFx().filter((f: any) => f.comp === 'cup' && f.qualRound === 6 && f.status === 'done');
    const r6Winners = r6FxDone.map(winnerOf);
    const regOpponents = r6Winners.length >= 4
      ? r6Winners.slice(0, 4)
      : [...db.teams.filter((t: any) => t.comp === 'fnl' || t.comp === 'media')].slice(0, 4).map((t: any) => t.id);

    thirdPlaces.forEach((rplTid, idx) => {
      const regTid = regOpponents[idx % regOpponents.length];
      const fx = {
        id: uid(),
        season: S(),
        comp: 'cup',
        cupPath: 'regions_playoff',
        cupStage: 'regions_r16',
        round: 301,
        label: 'Путь регионов · 1/8 финала (на вылет)',
        date: '2027-03-10',
        time: idx % 2 === 0 ? '17:00' : '19:30',
        home: regTid, // Хозяин — клуб не из РПЛ!
        away: rplTid,
        status: 'scheduled',
        hg: null,
        ag: null,
        pos: 0
      };
      assignReferee(fx);
      db.fixtures.push(fx);
    });
    save();
  }
}

export function realAt(f: any): Date {
  const d = f.realDate || f.date || '2026-11-07';
  const t = f.realTime || f.time || '12:00';
  // Standard MSK timezone is UTC+3
  return new Date(`${d}T${t}:00+03:00`);
}

export function getAvailableSeasons(): string[] {
  const set = new Set<string>();
  if (db.settings?.season) set.add(db.settings.season);
  if (Array.isArray(db.fixtures)) {
    db.fixtures.forEach((f: any) => { if (f.season) set.add(f.season); });
  }
  const cur = S();
  const parts = cur.split('/');
  if (parts.length === 2 && !isNaN(+parts[0])) {
    const next = `${+parts[0] + 1}/${(+parts[1] + 1) % 100}`;
    set.add(next);
  }
  return Array.from(set).sort();
}

export function ensureDualTimes(targetSeason?: string, force = false) {
  const season = targetSeason || S();
  const seasonFixtures = db.fixtures.filter((f: any) => f.season === season);
  if (!seasonFixtures.length) return;

  const baseRealStart = db.settings.realStartDate || new Date().toISOString().slice(0, 10);

  // 1. Fill gameDate and gameTime from date and time
  seasonFixtures.forEach((f: any) => {
    if (!f.gameDate || force) f.gameDate = f.date;
    if (!f.gameTime || force) f.gameTime = f.time;
  });

  // 2. Strict sequential calendar for RPL, Russian Cup, and Super Cup:
  // "это касается не только, но и кубка России. Это действует только на кубок России и рпл, 
  // получается если идет рпл, то в этот день только рпл, если наступило время кубка России, 
  // то идет кубок России, мы двигаемся строго по расписанию виртуального времени."
  const rplAndCupFx = seasonFixtures.filter((f: any) => f.comp === 'rpl' || f.comp === 'cup' || f.comp === 'supercup');
  
  const tourBlocks = new Map<string, { key: string; comp: string; minGameDate: string; fixtures: any[] }>();

  rplAndCupFx.forEach((f: any) => {
    let tourKey = '';
    if (f.comp === 'supercup') {
      tourKey = 'supercup';
    } else if (f.comp === 'rpl') {
      tourKey = `rpl_tour_${String(f.round).padStart(2, '0')}`;
    } else { // cup
      if (f.cupPath === 'regions_qual') {
        tourKey = `cup_regions_r${f.qualRound || f.round}`;
      } else if (f.cupPath === 'rpl_group') {
        tourKey = `cup_rpl_grp_r${f.round}`;
      } else {
        tourKey = `cup_stage_${f.cupStage || f.round}`;
      }
    }

    if (!tourBlocks.has(tourKey)) {
      tourBlocks.set(tourKey, {
        key: tourKey,
        comp: f.comp,
        minGameDate: f.gameDate || f.date,
        fixtures: []
      });
    }
    const b = tourBlocks.get(tourKey)!;
    b.fixtures.push(f);
    if ((f.gameDate || f.date) < b.minGameDate) {
      b.minGameDate = f.gameDate || f.date;
    }
  });

  // Sort tour blocks strictly by chronological order of virtual calendar:
  const sortedBlocks = Array.from(tourBlocks.values()).sort((a, b) => a.minGameDate.localeCompare(b.minGameDate));

  // Each tour block gets exactly ONE real calendar day
  sortedBlocks.forEach((block, blockIndex) => {
    const realDayDate = addDays(baseRealStart, blockIndex);
    const N = block.fixtures.length;
    
    // Sort matches deterministically
    block.fixtures.sort((a, b) => a.id.localeCompare(b.id));

    // Random times generator (по МСК)
    // 1 match at night (e.g. 01:00 or 01:30)
    // Remaining matches during daytime and evening (10:00 to 22:30)
    const randomTimes: string[] = [];
    const nightSlots = ['00:30', '01:00', '01:15', '01:30', '02:00'];
    const rGen = rng(season + '_' + block.key + '_' + blockIndex);

    if (N >= 2) {
      const nightIdx = Math.floor(rGen() * nightSlots.length);
      randomTimes.push(nightSlots[nightIdx]);
    }

    const dayStartMin = 10 * 60; // 10:00 MSK
    const dayEndMin = 22 * 60 + 30; // 22:30 MSK
    const remainingCount = N >= 2 ? N - 1 : N;

    const daySlots: number[] = [];
    for (let i = 0; i < remainingCount; i++) {
      const step = (dayEndMin - dayStartMin) / Math.max(1, remainingCount);
      const baseMin = dayStartMin + i * step;
      const jitter = (rGen() - 0.5) * 40;
      let slot = Math.round((baseMin + jitter) / 15) * 15;
      slot = Math.max(dayStartMin, Math.min(dayEndMin, slot));
      daySlots.push(slot);
    }
    daySlots.sort((a, b) => a - b);
    for (let i = 1; i < daySlots.length; i++) {
      if (daySlots[i] <= daySlots[i - 1]) {
        daySlots[i] = daySlots[i - 1] + 30;
      }
    }

    daySlots.forEach(slotMin => {
      const hh = String(Math.floor(slotMin / 60)).padStart(2, '0');
      const mm = String(slotMin % 60).padStart(2, '0');
      randomTimes.push(`${hh}:${mm}`);
    });

    block.fixtures.forEach((f: any, fi: number) => {
      if (!f.realDate || force) f.realDate = realDayDate;
      if (!f.realTime || force) f.realTime = randomTimes[fi] || '14:00';
    });
  });

  // 3. For any other leagues (fnl, 2la, media, etc.)
  seasonFixtures.filter((f: any) => f.comp !== 'rpl' && f.comp !== 'cup' && f.comp !== 'supercup').forEach((f: any) => {
    const rnd = Number(f.round) || 1;
    if (!f.realDate || force) {
      f.realDate = addDays(baseRealStart, rnd - 1);
    }
    if (!f.realTime || force) {
      f.realTime = f.time || '14:00';
    }
  });
}

function getSeasonPlayoffs(targetSeason?: string) {
  const season = targetSeason || S();
  const rplRows = table('rpl');
  const fnlRows = table('fnl');
  const goldRows = table('2la_gold');
  const mediaRows = table('media');

  const rpl13 = rplRows[12] || { id: 'rubin', name: 'Рубин', pos: 13 };
  const rpl14 = rplRows[13] || { id: 'fakel', name: 'Факел', pos: 14 };
  const fnl3 = fnlRows[2] || { id: 'volga-ulyanovsk', name: 'Волга Ульяновск', pos: 3 };
  const fnl4 = fnlRows[3] || { id: 'yenisey', name: 'Енисей', pos: 4 };
  const fnl16 = fnlRows[15] || { id: 'sokol', name: 'Сокол', pos: 16 };
  const gold3 = goldRows[2] || { id: 'mashuk-kmv', name: 'Машук-КМВ', pos: 3 };
  const media5 = mediaRows[4] || { id: '2drots', name: '2Drots', pos: 5 };
  const media6 = mediaRows[5] || { id: 'brokeboys', name: 'Броуки (Brokeboys)', pos: 6 };
  const media7 = mediaRows[6] || { id: 'amkal', name: 'Амкал', pos: 7 };
  const media8 = mediaRows[7] || { id: 'lit_energy', name: 'Lit Energy', pos: 8 };

  const allPlayoffFx = (db.fixtures || []).filter((f: any) => f.season === season && (f.comp === 'playoff' || f.comp === 'playoff_rpl_fnl'));

  const tieDefs = [
    {
      id: 'rpl_fnl_1',
      category: 'rpl_fnl',
      categoryTitle: 'Стыки: РПЛ ⇄ Первая лига (Пара 1)',
      title: `${rpl13.name} (13-е РПЛ) — ${fnl4.name} (4-е ФНЛ)`,
      twoLegged: true,
      teamHigher: { id: rpl13.id, name: rpl13.name, comp: 'rpl', place: 13, logo: teamLogo(rpl13.id) },
      teamLower: { id: fnl4.id, name: fnl4.name, comp: 'fnl', place: 4, logo: teamLogo(fnl4.id) }
    },
    {
      id: 'rpl_fnl_2',
      category: 'rpl_fnl',
      categoryTitle: 'Стыки: РПЛ ⇄ Первая лига (Пара 2)',
      title: `${rpl14.name} (14-е РПЛ) — ${fnl3.name} (3-е ФНЛ)`,
      twoLegged: true,
      teamHigher: { id: rpl14.id, name: rpl14.name, comp: 'rpl', place: 14, logo: teamLogo(rpl14.id) },
      teamLower: { id: fnl3.id, name: fnl3.name, comp: 'fnl', place: 3, logo: teamLogo(fnl3.id) }
    },
    {
      id: 'fnl_gold_1',
      category: 'fnl_gold',
      categoryTitle: 'Стыки: Первая лига ⇄ 2-я лига «А» «Золото»',
      title: `${fnl16.name} (16-е ФНЛ) — ${gold3.name} (3-е Золото)`,
      twoLegged: true,
      teamHigher: { id: fnl16.id, name: fnl16.name, comp: 'fnl', place: 16, logo: teamLogo(fnl16.id) },
      teamLower: { id: gold3.id, name: gold3.name, comp: '2la_gold', place: 3, logo: teamLogo(gold3.id) }
    },
    {
      id: 'media_playin_1',
      category: 'media',
      categoryTitle: 'Стыки Медиалиги (MFL Плей-ин, Пара 1)',
      title: `${media5.name} (5-е MFL) — ${media8.name} (8-е MFL)`,
      twoLegged: false,
      teamHigher: { id: media5.id, name: media5.name, comp: 'media', place: 5, logo: teamLogo(media5.id) },
      teamLower: { id: media8.id, name: media8.name, comp: 'media', place: 8, logo: teamLogo(media8.id) }
    },
    {
      id: 'media_playin_2',
      category: 'media',
      categoryTitle: 'Стыки Медиалиги (MFL Плей-ин, Пара 2)',
      title: `${media6.name} (6-е MFL) — ${media7.name} (7-е MFL)`,
      twoLegged: false,
      teamHigher: { id: media6.id, name: media6.name, comp: 'media', place: 6, logo: teamLogo(media6.id) },
      teamLower: { id: media7.id, name: media7.name, comp: 'media', place: 7, logo: teamLogo(media7.id) }
    }
  ];

  const ties = tieDefs.map(def => {
    const fxList = allPlayoffFx.filter((f: any) => f.playoffTieId === def.id || (
      ((f.home === def.teamHigher.id && f.away === def.teamLower.id) || (f.home === def.teamLower.id && f.away === def.teamHigher.id))
    )).sort((a: any, b: any) => (a.playoffLeg || 1) - (b.playoffLeg || 1) || (a.date + a.time).localeCompare(b.date + b.time));

    const leg1 = fxList[0];
    const leg2 = fxList[1];
    const isDone = def.twoLegged ? (!!leg1 && !!leg2 && leg1.status === 'done' && leg2.status === 'done') : (!!leg1 && leg1.status === 'done');

    let scoreText = '—';
    let winnerId: string | null = null;
    let winnerName: string | null = null;
    let winnerNote = '';

    if (def.twoLegged) {
      if (leg1 && leg2 && leg1.status === 'done' && leg2.status === 'done') {
        const isLeg1LowerHome = leg1.home === def.teamLower.id;
        const lowerLeg1 = isLeg1LowerHome ? (leg1.hg ?? 0) : (leg1.ag ?? 0);
        const higherLeg1 = isLeg1LowerHome ? (leg1.ag ?? 0) : (leg1.hg ?? 0);

        const isLeg2HigherHome = leg2.home === def.teamHigher.id;
        const higherLeg2 = isLeg2HigherHome ? (leg2.hg ?? 0) : (leg2.ag ?? 0);
        const lowerLeg2 = isLeg2HigherHome ? (leg2.ag ?? 0) : (leg2.hg ?? 0);

        const totalHigher = higherLeg1 + higherLeg2;
        const totalLower = lowerLeg1 + lowerLeg2;

        if (totalHigher > totalLower) {
          winnerId = def.teamHigher.id;
        } else if (totalLower > totalHigher) {
          winnerId = def.teamLower.id;
        } else {
          if (!leg2.pen) leg2.pen = shootout(leg2);
          const leg2HomeWon = leg2.pen.winner === 'home';
          winnerId = isLeg2HigherHome ? (leg2HomeWon ? def.teamHigher.id : def.teamLower.id) : (leg2HomeWon ? def.teamLower.id : def.teamHigher.id);
        }
        winnerName = winnerId ? tn(winnerId) : '';
        scoreText = `${leg1.hg}:${leg1.ag}, ${leg2.hg}:${leg2.ag} (по сумме ${totalHigher}:${totalLower}${leg2.pen ? `, пен. ${leg2.pen.hg}:${leg2.pen.ag}` : ''})`;
        winnerNote = winnerId === def.teamLower.id ? `Победа ${winnerName} (выход в ${def.teamHigher.comp === 'rpl' ? 'РПЛ' : 'Первую лигу'})` : `Победа ${winnerName} (сохранение прописки)`;
      } else if (leg1 && leg1.status === 'done') {
        scoreText = `1-й матч: ${leg1.hg}:${leg1.ag} (ответный не сыгран)`;
      }
    } else {
      if (leg1 && leg1.status === 'done') {
        if ((leg1.hg ?? 0) > (leg1.ag ?? 0)) winnerId = leg1.home;
        else if ((leg1.ag ?? 0) > (leg1.hg ?? 0)) winnerId = leg1.away;
        else {
          if (!leg1.pen) leg1.pen = shootout(leg1);
          winnerId = leg1.pen.winner === 'home' ? leg1.home : leg1.away;
        }
        winnerName = winnerId ? tn(winnerId) : '';
        scoreText = `${leg1.hg}:${leg1.ag}${leg1.pen ? ` (пен. ${leg1.pen.hg}:${leg1.pen.ag})` : ''}`;
        winnerNote = `Победитель стыка: ${winnerName}`;
      }
    }

    return {
      ...def,
      legs: fxList.map(pubFx),
      isDone,
      scoreText,
      winnerId,
      winnerName,
      winnerNote
    };
  });

  const totalRequired = tieDefs.reduce((acc, t) => acc + (t.twoLegged ? 2 : 1), 0);
  const playedCount = allPlayoffFx.filter((f: any) => f.status === 'done').length;
  const isCreated = allPlayoffFx.length >= totalRequired;
  const allTiesDone = isCreated && ties.every(t => t.isDone);

  return {
    season,
    ties,
    playoffsCreated: isCreated,
    playoffsTotal: totalRequired,
    playoffsPlayed: playedCount,
    playoffsAllPlayed: allTiesDone,
    canRotate: allTiesDone
  };
}

function generateSeasonPlayoffs(targetSeason?: string) {
  const season = targetSeason || S();
  const rplRows = table('rpl');
  const fnlRows = table('fnl');
  const goldRows = table('2la_gold');
  const mediaRows = table('media');

  const rpl13 = rplRows[12] || { id: 'rubin', name: 'Рубин' };
  const rpl14 = rplRows[13] || { id: 'fakel', name: 'Факел' };
  const fnl3 = fnlRows[2] || { id: 'volga-ulyanovsk', name: 'Волга Ульяновск' };
  const fnl4 = fnlRows[3] || { id: 'yenisey', name: 'Енисей' };
  const fnl16 = fnlRows[15] || { id: 'sokol', name: 'Сокол' };
  const gold3 = goldRows[2] || { id: 'mashuk-kmv', name: 'Машук-КМВ' };
  const media5 = mediaRows[4] || { id: '2drots', name: '2Drots' };
  const media6 = mediaRows[5] || { id: 'brokeboys', name: 'Броуки (Brokeboys)' };
  const media7 = mediaRows[6] || { id: 'amkal', name: 'Амкал' };
  const media8 = mediaRows[7] || { id: 'lit_energy', name: 'Lit Energy' };

  // Удаляем старые стыковые матчи этого сезона
  db.fixtures = db.fixtures.filter((f: any) => !(f.season === season && (f.comp === 'playoff' || f.comp === 'playoff_rpl_fnl')));

  const sFx = seasonFx();
  let latestDate = sFx.reduce((max: string, f: any) => (f.date && f.date > max ? f.date : max), '2027-05-24');
  const leg1Date = addDays(latestDate, 3);
  const leg2Date = addDays(latestDate, 7);

  const newFixtures: any[] = [
    // 1. RPL 13 vs FNL 4
    {
      id: uid(), season, comp: 'playoff', playoffTieId: 'rpl_fnl_1', playoffLeg: 1, round: 1,
      label: 'Стык: РПЛ — 1-я лига (1-й матч)', date: leg1Date, time: '17:00',
      home: fnl4.id, away: rpl13.id, status: 'scheduled', hg: null, ag: null, pos: 0
    },
    {
      id: uid(), season, comp: 'playoff', playoffTieId: 'rpl_fnl_1', playoffLeg: 2, round: 2,
      label: 'Стык: РПЛ — 1-я лига (Ответный матч)', date: leg2Date, time: '19:30',
      home: rpl13.id, away: fnl4.id, status: 'scheduled', hg: null, ag: null, pos: 0
    },
    // 2. RPL 14 vs FNL 3
    {
      id: uid(), season, comp: 'playoff', playoffTieId: 'rpl_fnl_2', playoffLeg: 1, round: 1,
      label: 'Стык: РПЛ — 1-я лига (1-й матч)', date: leg1Date, time: '19:15',
      home: fnl3.id, away: rpl14.id, status: 'scheduled', hg: null, ag: null, pos: 0
    },
    {
      id: uid(), season, comp: 'playoff', playoffTieId: 'rpl_fnl_2', playoffLeg: 2, round: 2,
      label: 'Стык: РПЛ — 1-я лига (Ответный матч)', date: leg2Date, time: '17:00',
      home: rpl14.id, away: fnl3.id, status: 'scheduled', hg: null, ag: null, pos: 0
    },
    // 3. FNL 16 vs 2LA Gold 3
    {
      id: uid(), season, comp: 'playoff', playoffTieId: 'fnl_gold_1', playoffLeg: 1, round: 1,
      label: 'Стык: 1-я лига — 2-я лига А (1-й матч)', date: leg1Date, time: '14:30',
      home: gold3.id, away: fnl16.id, status: 'scheduled', hg: null, ag: null, pos: 0
    },
    {
      id: uid(), season, comp: 'playoff', playoffTieId: 'fnl_gold_1', playoffLeg: 2, round: 2,
      label: 'Стык: 1-я лига — 2-я лига А (Ответный матч)', date: leg2Date, time: '15:00',
      home: fnl16.id, away: gold3.id, status: 'scheduled', hg: null, ag: null, pos: 0
    },
    // 4. Media play-in 1 (5 vs 8)
    {
      id: uid(), season, comp: 'playoff', playoffTieId: 'media_playin_1', playoffLeg: 1, round: 1,
      label: 'Стык MFL: Плей-ин (5-е vs 8-е)', date: leg1Date, time: '13:00',
      home: media5.id, away: media8.id, status: 'scheduled', hg: null, ag: null, pos: 0
    },
    // 5. Media play-in 2 (6 vs 7)
    {
      id: uid(), season, comp: 'playoff', playoffTieId: 'media_playin_2', playoffLeg: 1, round: 1,
      label: 'Стык MFL: Плей-ин (6-е vs 7-е)', date: leg1Date, time: '15:30',
      home: media6.id, away: media7.id, status: 'scheduled', hg: null, ag: null, pos: 0
    }
  ];

  newFixtures.forEach(f => {
    assignReferee(f);
    db.fixtures.push(f);
  });

  ensureDualTimes(season, false);
  invalidateAgg();
  save();

  return { ok: 1, created: newFixtures.length, playoffs: getSeasonPlayoffs(season) };
}

function performSeasonRotation(customNextSeason?: string, customStartDate?: string, force = false) {
  const currentSeason = S();
  const pl = getSeasonPlayoffs(currentSeason);

  if (!force) {
    if (!pl.playoffsCreated) {
      throw new Error('Стыковые матчи еще не созданы! Сначала нажмите «Создать переходные матчи».');
    }
    if (!pl.playoffsAllPlayed) {
      throw new Error(`Не все стыковые матчи сыграны (сыграно ${pl.playoffsPlayed} из ${pl.playoffsTotal})! Сыграйте все переходные матчи во всех лигах перед переходом к новому сезону.`);
    }
  }

  const [y1, y2] = currentSeason.split('/');
  const defaultNextSeason = `${+y1 + 1}/${(+y2 + 1) % 100}`;
  const nextSeason = customNextSeason || defaultNextSeason;

  const rplRows = table('rpl');
  const fnlRows = table('fnl');
  const goldRows = table('2la_gold');
  const silverRows = table('2la_silver');
  const b1Rows = table('2lb_1');
  const b2Rows = table('2lb_2');
  const b3Rows = table('2lb_3');
  const b4Rows = table('2lb_4');

  const report: {
    promotions: { team: string; from: string; to: string; reason: string }[];
    relegations: { team: string; from: string; to: string; reason: string }[];
    playoffs: { match: string; score: string; winner: string; note?: string }[];
  } = {
    promotions: [],
    relegations: [],
    playoffs: []
  };

  const rplRelegatedIds: string[] = [];
  const fnlPromotedIds: string[] = [];

  // Прямой вылет: 15-е и 16-е места РПЛ
  if (rplRows.length >= 16) {
    const rpl15 = rplRows[14], rpl16 = rplRows[15];
    rplRelegatedIds.push(rpl15.id, rpl16.id);
    report.relegations.push(
      { team: rpl15.name, from: 'РПЛ', to: 'Первая лига', reason: '15-е место в РПЛ (прямой вылет)' },
      { team: rpl16.name, from: 'РПЛ', to: 'Первая лига', reason: '16-е место в РПЛ (прямой вылет)' }
    );
  }

  // Прямой выход: 1-е и 2-е места Первой лиги
  if (fnlRows.length >= 2) {
    const fnl1 = fnlRows[0], fnl2 = fnlRows[1];
    fnlPromotedIds.push(fnl1.id, fnl2.id);
    report.promotions.push(
      { team: fnl1.name, from: 'Первая лига', to: 'РПЛ', reason: '1-е место в Первой лиге (прямой выход)' },
      { team: fnl2.name, from: 'Первая лига', to: 'РПЛ', reason: '2-е место в Первой лиге (прямой выход)' }
    );
  }

  // Переходные стыковые матчи РПЛ / Первой лиги (на основе реальных сыгранных матчей!)
  const tieRplFnl1 = pl.ties.find((t: any) => t.id === 'rpl_fnl_1');
  if (tieRplFnl1) {
    if (tieRplFnl1.winnerId === tieRplFnl1.teamLower.id) {
      fnlPromotedIds.push(tieRplFnl1.teamLower.id);
      rplRelegatedIds.push(tieRplFnl1.teamHigher.id);
      report.promotions.push({ team: tieRplFnl1.teamLower.name, from: 'Первая лига', to: 'РПЛ', reason: `Победа в стыках над ${tieRplFnl1.teamHigher.name} (${tieRplFnl1.scoreText})` });
      report.relegations.push({ team: tieRplFnl1.teamHigher.name, from: 'РПЛ', to: 'Первая лига', reason: `Поражение в стыках от ${tieRplFnl1.teamLower.name} (${tieRplFnl1.scoreText})` });
    }
    report.playoffs.push({
      match: tieRplFnl1.title,
      score: tieRplFnl1.scoreText,
      winner: tieRplFnl1.winnerName || tieRplFnl1.teamHigher.name,
      note: tieRplFnl1.winnerNote
    });
  }

  const tieRplFnl2 = pl.ties.find((t: any) => t.id === 'rpl_fnl_2');
  if (tieRplFnl2) {
    if (tieRplFnl2.winnerId === tieRplFnl2.teamLower.id) {
      fnlPromotedIds.push(tieRplFnl2.teamLower.id);
      rplRelegatedIds.push(tieRplFnl2.teamHigher.id);
      report.promotions.push({ team: tieRplFnl2.teamLower.name, from: 'Первая лига', to: 'РПЛ', reason: `Победа в стыках над ${tieRplFnl2.teamHigher.name} (${tieRplFnl2.scoreText})` });
      report.relegations.push({ team: tieRplFnl2.teamHigher.name, from: 'РПЛ', to: 'Первая лига', reason: `Поражение в стыках от ${tieRplFnl2.teamLower.name} (${tieRplFnl2.scoreText})` });
    }
    report.playoffs.push({
      match: tieRplFnl2.title,
      score: tieRplFnl2.scoreText,
      winner: tieRplFnl2.winnerName || tieRplFnl2.teamHigher.name,
      note: tieRplFnl2.winnerNote
    });
  }

  // Ротация: Первая лига ⇄ 2-я лига «А» «Золото»
  const fnlRelegatedIds: string[] = [];
  const goldPromotedIds: string[] = [];
  if (fnlRows.length >= 18) {
    const fnl17 = fnlRows[16], fnl18 = fnlRows[17];
    fnlRelegatedIds.push(fnl17.id, fnl18.id);
    report.relegations.push(
      { team: fnl17.name, from: 'Первая лига', to: '2-я лига «А» Золото', reason: '17-е место (вылет)' },
      { team: fnl18.name, from: 'Первая лига', to: '2-я лига «А» Золото', reason: '18-е место (вылет)' }
    );
  }
  if (goldRows.length >= 2) {
    const g1 = goldRows[0], g2 = goldRows[1];
    goldPromotedIds.push(g1.id, g2.id);
    report.promotions.push(
      { team: g1.name, from: '2-я лига «А» Золото', to: 'Первая лига', reason: '1-е место (прямой выход)' },
      { team: g2.name, from: '2-я лига «А» Золото', to: 'Первая лига', reason: '2-е место (прямой выход)' }
    );
  }

  // Стык: 16-е место Первой лиги ⇄ 3-е место 2-й лиги «А» «Золото»
  const tieFnlGold = pl.ties.find((t: any) => t.id === 'fnl_gold_1');
  if (tieFnlGold) {
    if (tieFnlGold.winnerId === tieFnlGold.teamLower.id) {
      goldPromotedIds.push(tieFnlGold.teamLower.id);
      fnlRelegatedIds.push(tieFnlGold.teamHigher.id);
      report.promotions.push({ team: tieFnlGold.teamLower.name, from: '2-я лига «А» Золото', to: 'Первая лига', reason: `Победа в стыках над ${tieFnlGold.teamHigher.name} (${tieFnlGold.scoreText})` });
      report.relegations.push({ team: tieFnlGold.teamHigher.name, from: 'Первая лига', to: '2-я лига «А» Золото', reason: `Поражение в стыках от ${tieFnlGold.teamLower.name} (${tieFnlGold.scoreText})` });
    }
    report.playoffs.push({
      match: tieFnlGold.title,
      score: tieFnlGold.scoreText,
      winner: tieFnlGold.winnerName || tieFnlGold.teamHigher.name,
      note: tieFnlGold.winnerNote
    });
  }

  // Стыки Медиалиги (плей-ин)
  const mediaTies = pl.ties.filter((t: any) => t.id.startsWith('media'));
  for (const mt of mediaTies) {
    report.playoffs.push({
      match: mt.title,
      score: mt.scoreText,
      winner: mt.winnerName || 'Не определён',
      note: mt.winnerNote
    });
  }

  // Полугодичная ротация: Золото ⇄ Серебро (4 худших ⇄ 4 лучших)
  const goldToSilverIds: string[] = [];
  const silverToGoldIds: string[] = [];
  if (goldRows.length >= 10) {
    const gDown = goldRows.slice(6, 10);
    gDown.forEach(t => {
      goldToSilverIds.push(t.id);
      report.relegations.push({ team: t.name, from: 'Группа «Золото»', to: 'Группа «Серебро»', reason: '7–10 места (ротация)' });
    });
  }
  if (silverRows.length >= 4) {
    const sUp = silverRows.slice(0, 4);
    sUp.forEach(t => {
      silverToGoldIds.push(t.id);
      report.promotions.push({ team: t.name, from: 'Группа «Серебро»', to: 'Группа «Золото»', reason: '1–4 места (ротация)' });
    });
  }

  // Серебро ⇄ Вторая лига «Б»
  const silverDownIds: string[] = [];
  const bUpIds: string[] = [];
  if (silverRows.length >= 7) {
    const sOut = silverRows.slice(Math.max(0, silverRows.length - 4));
    sOut.forEach(t => {
      silverDownIds.push(t.id);
      report.relegations.push({ team: t.name, from: 'Группа «Серебро»', to: 'Вторая лига «Б»', reason: 'Вылет из дивизиона «А»' });
    });
  }
  [b1Rows[0], b2Rows[0], b3Rows[0], b4Rows[0]].filter(Boolean).forEach((bTeam, idx) => {
    bUpIds.push(bTeam.id);
    report.promotions.push({ team: bTeam.name, from: `2-я лига Б (Группа ${idx + 1})`, to: 'Группа «Серебро»', reason: 'Победитель группы' });
  });

  // Применяем изменения
  for (const t of db.teams) {
    if (rplRelegatedIds.includes(t.id)) t.comp = 'fnl';
    else if (fnlPromotedIds.includes(t.id)) t.comp = 'rpl';
    else if (fnlRelegatedIds.includes(t.id)) t.comp = '2la_gold';
    else if (goldPromotedIds.includes(t.id)) t.comp = 'fnl';
    else if (goldToSilverIds.includes(t.id)) t.comp = '2la_silver';
    else if (silverToGoldIds.includes(t.id)) t.comp = '2la_gold';
    else if (silverDownIds.includes(t.id)) t.comp = '2lb_1';
    else if (bUpIds.includes(t.id)) t.comp = '2la_silver';
  }

  const nextStartYear = parseInt(nextSeason.slice(0, 4), 10) || (+y1 + 1);
  const startDate = customStartDate || `${nextStartYear}-07-20`;
  genSeason(startDate, nextSeason);
  ensureDualTimes(nextSeason, true);
  db.settings.season = nextSeason;
  invalidateAgg();
  save();

  return { ok: 1, currentSeason, nextSeason, startDate, report };
}

function getSeasonRotationPreview() {
  const currentSeason = S();
  const [y1, y2] = currentSeason.split('/');
  const nextSeason = `${+y1 + 1}/${(+y2 + 1) % 100}`;
  const nextStartYear = parseInt(nextSeason.slice(0, 4), 10) || (+y1 + 1);
  const defaultStartDate = `${nextStartYear}-07-20`;

  const rplRows = table('rpl');
  const fnlRows = table('fnl');

  const rpl15 = rplRows[14] || { name: 'ЦСКА', pts: 0 };
  const rpl16 = rplRows[15] || { name: 'Акрон', pts: 0 };
  const fnl1 = fnlRows[0] || { name: 'Арсенал Тула', pts: 0 };
  const fnl2 = fnlRows[1] || { name: 'Велес', pts: 0 };

  const pl = getSeasonPlayoffs(currentSeason);

  return {
    currentSeason,
    nextSeason,
    defaultStartDate,
    relegations: [
      { name: rpl15.name, place: 15, pts: rpl15.pts || 0 },
      { name: rpl16.name, place: 16, pts: rpl16.pts || 0 }
    ],
    promotions: [
      { name: fnl1.name, place: 1, pts: fnl1.pts || 0 },
      { name: fnl2.name, place: 2, pts: fnl2.pts || 0 }
    ],
    playoffs: pl.ties,
    playoffsCreated: pl.playoffsCreated,
    playoffsTotal: pl.playoffsTotal,
    playoffsPlayed: pl.playoffsPlayed,
    playoffsAllPlayed: pl.playoffsAllPlayed,
    canRotate: pl.canRotate
  };
}

/* ───────── HTTP и API ───────── */
export const app = express();
app.use(express.json({ limit: '5mb' }));

app.use((req: any, res: Response, next: NextFunction) => {
  const token = req.headers['x-token'] as string;
  req.me = token ? db.sessions[token] : null;
  next();
});

const admin = (req: any, res: Response, next: NextFunction) => req.me?.role === 'admin' ? next() : res.status(403).json({ error: 'Нужен вход администратора' });
const clubOf = (req: any) => req.me?.role === 'admin' ? (req.body?.teamId || req.query.teamId) : req.me?.teamId;
const needClub = (req: any, res: Response, next: NextFunction) => {
  const t = clubOf(req);
  if (!t || !team(t)) return res.status(403).json({ error: 'Войдите по коду клуба' });
  req.tid = t;
  next();
};
const fail = (res: Response, msg: string, code = 400) => res.status(code).json({ error: msg });

function getCoachForTeam(tid: string): Coach {
  const t = team(tid);
  if (!t) return getTeamCoach('Неизвестный клуб', 'rpl');
  if (db.staff && Array.isArray(db.staff)) {
    const foundHead = db.staff.find((s: any) => s.teamId === tid && s.role === 'head');
    if (foundHead) {
      return {
        id: foundHead.id,
        name: foundHead.name,
        clubName: t.name,
        nationality: foundHead.nationality || 'Россия',
        age: foundHead.age || 45,
        style: (foundHead.style as any) || 'possession',
        styleTitle: foundHead.styleTitle || 'Сбалансированный стиль',
        styleDesc: foundHead.bio || '',
        favoriteFormation: foundHead.favoriteFormation || '4-3-3',
        reputation: (foundHead as any).reputation || 80,
        temperament: (foundHead as any).temperament || 'Уравновешенный',
        quote: (foundHead as any).quote || '«Дисциплина и командная игра — залог успеха»'
      };
    }
  }
  if (db.coaches && !Array.isArray(db.coaches) && db.coaches[tid]) {
    return { ...db.coaches[tid], clubName: t.name };
  }
  return getTeamCoach(t.name, t.comp);
}

function getStaffForTeam(tid: string): StaffMember[] {
  if (!db.staff || !Array.isArray(db.staff)) return [];
  return db.staff.filter((s: any) => s.teamId === tid);
}

const pubTeam = (t: any) => {
  const official = getTeamLogo(t.name, null, t.comp);
  const coach = getCoachForTeam(t.id);
  const synergy = computeCoachSynergy(coach, db.tactics[t.id]);
  const staff = getStaffForTeam(t.id);
  return {
    id: t.id,
    name: t.name,
    comp: t.comp,
    city: t.city,
    stadium: t.stadium,
    logo: official.startsWith('/assets/') ? official : (t.logo || official),
    colors: getTeamColors(t.name),
    coach,
    synergy,
    staff,
    budget: t.budget || 0,
    formattedBudget: '€' + (t.budget || 0).toLocaleString('ru-RU')
  };
};

const pubPlayer = (p: any) => ({
  id: p.id,
  name: p.name,
  pos: p.pos,
  born: p.born,
  nation: p.nation || 'Россия',
  playedForOtherNationalTeam: !!(p.playedForOtherNationalTeam || (p.otherNationalTeam && norm(p.otherNationalTeam) !== 'россия')),
  otherNationalTeam: p.otherNationalTeam || '',
  isLegionnaire: isLegionnaire(p),
  legionStatus: getLegionnaireStatus(p),
  teamId: p.teamId,
  team: p.teamId ? tn(p.teamId) : 'без клуба',
  teamLogo: p.teamId ? teamLogo(p.teamId) : null,
  style: p.style,
  achievements: p.achievements,
  out: p.out,
  banLeft: p.banLeft
});

const pubFx = (f: any) => ({
  id: f.id,
  comp: f.comp,
  cupPath: f.cupPath || (f.comp === 'cup' ? (f.round <= 6 ? 'rpl_group' : 'regions_qual') : null),
  groupId: f.groupId || null,
  qualRound: f.qualRound || null,
  cupStage: f.cupStage || null,
  playoffTieId: f.playoffTieId || null,
  playoffLeg: f.playoffLeg || null,
  round: f.round,
  label: roundLabel(f),
  date: f.date,
  time: f.time,
  gameDate: f.gameDate || f.date,
  gameTime: f.gameTime || f.time,
  realDate: f.realDate || f.date,
  realTime: f.realTime || f.time,
  home: f.home,
  away: f.away,
  homeName: tn(f.home),
  awayName: tn(f.away),
  homeLogo: teamLogo(f.home),
  awayLogo: teamLogo(f.away),
  status: f.status,
  hg: f.hg,
  ag: f.ag,
  pen: f.pen || null,
  full: f.status === 'live' || f.status === 'done' ? !!f.st || f.status === 'live' : fullSim(f),
  derby: !!db.derbies.find((d: any) => (d.a === f.home && d.b === f.away) || (d.a === f.away && d.b === f.home)),
  refereeId: (f.comp === 'rpl' || f.comp === 'cup') ? (f.refereeId || null) : null,
  refereeName: (f.comp === 'rpl' || f.comp === 'cup') ? (f.refereeName || null) : null,
  assistants: (f.comp === 'rpl' || f.comp === 'cup') ? (f.assistants || []) : [],
  reserveReferee: (f.comp === 'rpl' || f.comp === 'cup') ? (f.reserveReferee || null) : null,
  varReferee: (f.comp === 'rpl' || f.comp === 'cup') ? (f.varReferee || null) : null,
  avarReferee: (f.comp === 'rpl' || f.comp === 'cup') ? (f.avarReferee || null) : null,
  stadium: f.stadium || (f.home ? team(f.home)?.stadium : null),
  city: f.city || (f.home ? team(f.home)?.city : null),
  neutralField: !!f.neutralField
});

app.post('/api/login', (req, res) => {
  const c = String(req.body.code || '').trim().toUpperCase();
  if (!c) return fail(res, 'Введите код');
  let s: any = null;
  if (c === String(process.env.ADMIN_CODE || db.settings.adminCode).toUpperCase()) s = { role: 'admin' };
  else {
    const t = db.teams.find((t: any) => t.code && t.code.toUpperCase() === c);
    if (t) s = { role: 'club', teamId: t.id };
  }
  if (!s) return fail(res, 'Код не найден', 401);
  const token = crypto.randomBytes(20).toString('hex');
  db.sessions[token] = { ...s, at: Date.now() };
  save();
  res.json({ token, ...s, team: s.teamId ? pubTeam(team(s.teamId)) : null });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['x-token'] as string;
  if (token) delete db.sessions[token];
  save();
  res.json({ ok: 1 });
});

app.get('/api/state', (req: any, res) => {
  res.json({
    season: S(),
    seasons: getAvailableSeasons(),
    realStartDate: db.settings.realStartDate || new Date().toISOString().slice(0, 10),
    timeMode: db.settings.timeMode || 'game',
    auto: !!db.settings.auto,
    legionLimit: getRplLegionLimit(S()),
    comps: db.comps,
    teams: db.teams.map(pubTeam),
    me: req.me ? { role: req.me.role, teamId: req.me.teamId || null } : null,
    hasLLM: hasLLM(),
    live: db.fixtures.filter((f: any) => f.status === 'live').map(pubFx),
    regulations: LEAGUE_REGULATIONS
  });
});

app.get('/api/regulations', (req, res) => res.json(LEAGUE_REGULATIONS));
app.get('/api/regulations/:comp', (req, res) => {
  const k = req.params.comp.startsWith('2lb_') ? '2lb' : req.params.comp;
  res.json(LEAGUE_REGULATIONS[k] || {});
});

app.get('/api/table/:comp', (req, res) => res.json(table(req.params.comp)));

app.get('/api/transfers/top', (req, res) => {
  const approved = (db.transfers || []).filter((t: any) => t.status === 'approved');

  // Самые дорогие (по сумме сделки)
  const expensive = [...approved].sort((a: any, b: any) => {
    const amtA = a.feeAmount !== undefined ? a.feeAmount : parseFeeAmount(a.fee);
    const amtB = b.feeAmount !== undefined ? b.feeAmount : parseFeeAmount(b.fee);
    return amtB - amtA;
  }).slice(0, 10);

  // Самые выгодные (по вкладу и пользе для нового клуба)
  const valuable = [...approved].sort((a: any, b: any) => {
    const pA = player(a.pid);
    const pB = player(b.pid);
    const scoreA = a.statsForNewClub?.impactScore !== undefined
      ? a.statsForNewClub.impactScore
      : (((pA?.goals || 0) * 4 + (pA?.assists || 0) * 2.5 + (pA?.matches || 0) * 1.2));
    const scoreB = b.statsForNewClub?.impactScore !== undefined
      ? b.statsForNewClub.impactScore
      : (((pB?.goals || 0) * 4 + (pB?.assists || 0) * 2.5 + (pB?.matches || 0) * 1.2));
    return scoreB - scoreA;
  }).slice(0, 10);

  // Самые провальные (большая переплата и нет результативности)
  const flops = [...approved].filter((t: any) => {
    const amt = t.feeAmount !== undefined ? t.feeAmount : parseFeeAmount(t.fee);
    return amt > 0;
  }).sort((a: any, b: any) => {
    const amtA = a.feeAmount !== undefined ? a.feeAmount : parseFeeAmount(a.fee);
    const amtB = b.feeAmount !== undefined ? b.feeAmount : parseFeeAmount(b.fee);
    const pA = player(a.pid);
    const pB = player(b.pid);
    const impactA = a.statsForNewClub?.impactScore !== undefined
      ? a.statsForNewClub.impactScore
      : (((pA?.goals || 0) * 3 + (pA?.assists || 0) * 2 + (pA?.matches || 0) * 0.5 + Math.max(0, (pA?.rating || 6.5) - 6.0)));
    const impactB = b.statsForNewClub?.impactScore !== undefined
      ? b.statsForNewClub.impactScore
      : (((pB?.goals || 0) * 3 + (pB?.assists || 0) * 2 + (pB?.matches || 0) * 0.5 + Math.max(0, (pB?.rating || 6.5) - 6.0)));
    const flopScoreA = amtA / Math.max(0.1, impactA + 0.1);
    const flopScoreB = amtB / Math.max(0.1, impactB + 0.1);
    return flopScoreB - flopScoreA;
  }).slice(0, 10);

  res.json({
    expensive: expensive.map(formatTransferForPublic),
    valuable: valuable.map(formatTransferForPublic),
    flops: flops.map(formatTransferForPublic),
    totalCount: approved.length
  });
});

app.get('/api/fixtures', (req, res) => {
  let l = seasonFx();
  if (req.query.comp) l = l.filter((f: any) => f.comp === req.query.comp);
  if (req.query.team) l = l.filter((f: any) => f.home === req.query.team || f.away === req.query.team);
  l = l.sort((a: any, b: any) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json(l.map(pubFx));
});

function getHeadToHead(homeTid: string, awayTid: string, currentFixtureId?: string) {
  const H = team(homeTid);
  const A = team(awayTid);
  const hName = H?.name || tn(homeTid);
  const aName = A?.name || tn(awayTid);
  const hLogo = teamLogo(homeTid);
  const aLogo = teamLogo(awayTid);

  // 1. Собрать реально сыгранные матчи из базы данных между этими двумя командами
  const realPlayed = (db.fixtures || []).filter((f: any) => {
    if (currentFixtureId && f.id === currentFixtureId) return false;
    if (f.status !== 'done') return false;
    return (f.home === homeTid && f.away === awayTid) || (f.home === awayTid && f.away === homeTid);
  }).sort((a: any, b: any) => ((b.date || '') + (b.time || '')).localeCompare((a.date || '') + (a.time || '')));

  const matches: any[] = [];
  for (const f of realPlayed) {
    const isDirectHome = f.home === homeTid;
    const hg = f.hg ?? 0;
    const ag = f.ag ?? 0;
    const homeGoals = isDirectHome ? hg : ag;
    const awayGoals = isDirectHome ? ag : hg;
    let outcome: 'home' | 'away' | 'draw' = 'draw';
    if (homeGoals > awayGoals) outcome = 'home';
    else if (awayGoals > homeGoals) outcome = 'away';

    matches.push({
      id: f.id,
      date: f.date || '2026-08-10',
      time: f.time || '18:00',
      comp: compName(f) || 'РПЛ',
      round: roundLabel(f) || '',
      homeId: f.home,
      awayId: f.away,
      homeName: tn(f.home),
      awayName: tn(f.away),
      homeLogo: teamLogo(f.home),
      awayLogo: teamLogo(f.away),
      homeGoals: hg,
      awayGoals: ag,
      score: `${hg} : ${ag}`,
      penalties: f.penalties ? `${f.penalties.home} : ${f.penalties.away} пен.` : undefined,
      outcome, // относительно текущей пары (homeTid против awayTid)
      winnerId: hg > ag ? f.home : (ag > hg ? f.away : null),
      stadium: team(f.home)?.stadium || '',
      isSimulated: true
    });
    if (matches.length >= 10) break;
  }

  // 2. Если сыграно меньше 10 матчей в симуляторе, дополняем детерминированной исторической статистикой встреч
  if (matches.length < 10) {
    const need = 10 - matches.length;
    let seedVal = 0;
    for (let i = 0; i < (homeTid + awayTid).length; i++) {
      seedVal = (seedVal * 31 + (homeTid + awayTid).charCodeAt(i)) & 0xffffff;
    }

    const pseudoRandom = (step: number) => {
      const x = Math.sin(seedVal + step * 7919) * 10000;
      return x - Math.floor(x);
    };

    const comps = ['РПЛ', 'РПЛ', 'РПЛ', 'Кубок России', 'РПЛ', 'РПЛ', 'Кубок России', 'Суперкубок'];
    const years = [2026, 2025, 2025, 2024, 2024, 2023, 2023, 2022, 2022, 2021];
    const months = ['03', '05', '08', '09', '10', '11', '04', '07', '12', '06'];
    const days = ['12', '24', '18', '03', '29', '15', '07', '21', '30', '14'];

    for (let i = 0; i < need; i++) {
      const idx = matches.length;
      const r1 = pseudoRandom(idx * 3 + 1);
      const r2 = pseudoRandom(idx * 3 + 2);
      const r3 = pseudoRandom(idx * 3 + 3);

      const altHome = idx % 2 === 0;
      const currentHomeId = altHome ? homeTid : awayTid;
      const currentAwayId = altHome ? awayTid : homeTid;

      // Сгенерируем реалистичный футбольный счет
      let hScore = 0;
      let aScore = 0;
      if (r1 < 0.28) {
        // Ничья
        hScore = r2 < 0.5 ? 1 : (r2 < 0.85 ? 0 : 2);
        aScore = hScore;
      } else if (r1 < 0.65) {
        // Победа хозяев
        hScore = r2 < 0.4 ? 1 : (r2 < 0.8 ? 2 : 3);
        aScore = r3 < 0.5 ? 0 : 1;
        if (hScore <= aScore) hScore = aScore + 1;
      } else {
        // Победа гостей
        aScore = r2 < 0.45 ? 1 : (r2 < 0.85 ? 2 : 3);
        hScore = r3 < 0.6 ? 0 : 1;
        if (aScore <= hScore) aScore = hScore + 1;
      }

      const isDirectHome = currentHomeId === homeTid;
      const hgRel = isDirectHome ? hScore : aScore;
      const agRel = isDirectHome ? aScore : hScore;
      let outcome: 'home' | 'away' | 'draw' = 'draw';
      if (hgRel > agRel) outcome = 'home';
      else if (agRel > hgRel) outcome = 'away';

      const yr = years[idx % years.length];
      const mo = months[idx % months.length];
      const dy = days[idx % days.length];

      matches.push({
        id: `hist_${homeTid}_${awayTid}_${idx}`,
        date: `${yr}-${mo}-${dy}`,
        time: '19:00',
        comp: comps[idx % comps.length],
        round: comps[idx % comps.length].includes('Кубок') ? '1/4 финала' : `${(idx % 25) + 1} тур`,
        homeId: currentHomeId,
        awayId: currentAwayId,
        homeName: tn(currentHomeId),
        awayName: tn(currentAwayId),
        homeLogo: teamLogo(currentHomeId),
        awayLogo: teamLogo(currentAwayId),
        homeGoals: hScore,
        awayGoals: aScore,
        score: `${hScore} : ${aScore}`,
        outcome,
        winnerId: hScore > aScore ? currentHomeId : (aScore > hScore ? currentAwayId : null),
        stadium: team(currentHomeId)?.stadium || '',
        isSimulated: false
      });
    }
  }

  // 3. Подсчет итоговой статистики по 10 встречам
  let homeWins = 0, draws = 0, awayWins = 0, homeGoalsTotal = 0, awayGoalsTotal = 0;
  for (const m of matches) {
    if (m.outcome === 'home') homeWins++;
    else if (m.outcome === 'away') awayWins++;
    else draws++;

    if (m.homeId === homeTid) {
      homeGoalsTotal += m.homeGoals;
      awayGoalsTotal += m.awayGoals;
    } else {
      homeGoalsTotal += m.awayGoals;
      awayGoalsTotal += m.homeGoals;
    }
  }

  return {
    homeTeam: { id: homeTid, name: hName, logo: hLogo },
    awayTeam: { id: awayTid, name: aName, logo: aLogo },
    stats: {
      total: matches.length,
      homeWins,
      draws,
      awayWins,
      homeGoals: homeGoalsTotal,
      awayGoals: awayGoalsTotal
    },
    matches
  };
}

app.get('/api/match/:id', (req: any, res) => {
  const f = fx(req.params.id);
  if (!f) return fail(res, 'Матч не найден', 404);
  const m = getMatch(f.id);
  const isAdm = req.me?.role === 'admin';
  const HName = tn(f.home), AName = tn(f.away);
  const coachHome = getCoachForTeam(f.home);
  const coachAway = getCoachForTeam(f.away);

  const rawMotm = m?.motm || (f.status === 'done' && m ? getMatchMotm(m, f, HName, AName, coachHome, coachAway) : (f.motm ? { ...f.motm, teamName: HName, pos: 'НАП', interview: { headline: `«${f.motm.name}: игра была напряжённой до последних минут»`, quote: `Мы готовились к трудному матчу, соперник оказал серьезное сопротивление. Рады победе и поддержке трибун!`, tacticsComment: `Установка тренера была ясна: надёжность сзади и острота впереди.`, mood: 'satisfied' } } : null));

  let motmOut: any = null;
  if (rawMotm) {
    const p = rawMotm.player || {
      id: rawMotm.pid || rawMotm.id,
      name: rawMotm.name,
      pos: rawMotm.pos || 'НАП',
      team: rawMotm.teamName || rawMotm.team || HName,
      rating: rawMotm.rating || '7.5',
      goals: rawMotm.goals || 0,
      assists: rawMotm.assists || 0,
      saves: rawMotm.saves || 0,
      xg: rawMotm.xg,
      shots: rawMotm.shots,
      tackles: rawMotm.tackles,
      teamLogo: rawMotm.teamLogo || teamLogo(rawMotm.teamId)
    };
    motmOut = {
      ...rawMotm,
      player: p,
      name: rawMotm.name || p.name,
      rating: rawMotm.rating || p.rating,
      headline: rawMotm.headline || rawMotm.interview?.headline || `«${p.name}: командная работа принесла результат»`,
      quote: rawMotm.quote || rawMotm.interview?.quote || `Мы провели отличный матч и бились за каждый мяч. Спасибо болельщикам за поддержку!`,
      coachTacticsReflection: rawMotm.coachTacticsReflection || rawMotm.interview?.tacticsComment || ''
    };
  }

  const out: any = {
    fixture: pubFx(f),
    events: [],
    stats: null,
    lineups: null,
    ctx: null,
    final: null,
    err: isAdm ? f.err : undefined,
    fallback: !!f.fallback,
    motm: motmOut,
    ratings: m?.ratings || (f.status === 'done' && m ? computeMatchRatings(m, f, HName, AName) : []),
    coaches: {
      home: { coach: coachHome, synergy: computeCoachSynergy(coachHome, db.tactics[f.home]) },
      away: { coach: coachAway, synergy: computeCoachSynergy(coachAway, db.tactics[f.away]) }
    },
    h2h: getHeadToHead(f.home, f.away, f.id)
  };
  if (m && (f.status === 'live' || f.status === 'done')) {
    out.events = f.status === 'live' ? m.events.slice(0, f.pos) : m.events;
    out.stats = f.status === 'done' ? m.stats : computeStats(out.events, m.ctx);
    const show = isAdm || f.status === 'done' || f.status === 'live';
    if (m.ctx?.lineup) {
      out.lineups = {};
      for (const s of ['home', 'away']) {
        const tid = f[s];
        const L = m.ctx.lineup[s];
        if (L) {
          const canSeeTactics = isAdm || (req.me?.teamId && req.me.teamId === tid);
          out.lineups[s] = {
            name: m.ctx.sides?.[s]?.name || (s === 'home' ? HName : AName),
            logo: m.ctx.sides?.[s]?.logo || teamLogo(tid),
            formation: L.formation || '4-3-3',
            speech: canSeeTactics ? (L.speech || '(установка не заполнена)') : undefined,
            training: canSeeTactics ? (L.training || '') : undefined,
            starters: (L.starters || []).map((id: string) => ({ id, name: m.ctx.names?.[id] || player(id)?.name || 'Игрок', pos: m.ctx.pos?.[id] || player(id)?.pos || '' })),
            bench: (L.bench || []).map((id: string) => ({ id, name: m.ctx.names?.[id] || player(id)?.name || 'Игрок', pos: m.ctx.pos?.[id] || player(id)?.pos || '' }))
          };
        }
      }
    }
    if (m.ctx) {
      out.ctx = {
        comp: m.ctx.comp,
        roundLabel: m.ctx.roundLabel,
        stadium: m.ctx.stadium,
        weather: m.ctx.weather,
        derby: m.ctx.derby,
        motiv: m.ctx.motiv
      };
      if (isAdm) {
        out.ctx.prompt = m.ctx.prompt1;
        out.ctx.fat = m.ctx.fat;
        out.ctx.race = m.ctx.race;
      }
    }
  }

  // Pre-match fallback context for scheduled/queued matches
  if (!out.ctx) {
    const H = team(f.home);
    const dv = db.derbies.find((d: any) => (d.a === f.home && d.b === f.away) || (d.a === f.away && d.b === f.home));
    out.ctx = {
      comp: compName(f),
      roundLabel: roundLabel(f),
      stadium: (H?.stadium ? H.stadium + ', ' : '') + (H?.city || ''),
      weather: 'Прогноз погоды формируется ближе к матчу',
      derby: dv ? `${dv.name}. ${dv.note}` : 'нет',
      motiv: { home: motivText(f.home, f), away: motivText(f.away, f) }
    };
  }

  // Pre-match fallback lineups for scheduled/queued matches
  if (!out.lineups) {
    const H = team(f.home), A = team(f.away);
    out.lineups = {};
    for (const s of ['home', 'away']) {
      const tid = f[s];
      const tm = s === 'home' ? H : A;
      const L = getLineup(f, tid);
      const canSeeTactics = isAdm || (req.me?.teamId && req.me.teamId === tid);
      out.lineups[s] = {
        name: tm ? tm.name : tn(tid),
        logo: teamLogo(tid),
        formation: L.formation || '4-3-3',
        speech: canSeeTactics ? (L.speech || '(установка не заполнена)') : undefined,
        training: canSeeTactics ? (L.training || '') : undefined,
        starters: (L.starters || []).map((id: string) => {
          const p = player(id);
          return { id, name: p ? p.name : 'Игрок', pos: p ? p.pos : '' };
        }),
        bench: (L.bench || []).map((id: string) => {
          const p = player(id);
          return { id, name: p ? p.name : 'Игрок', pos: p ? p.pos : '' };
        })
      };
    }
  }

  res.json(out);
});

// Послематчевое интервью игрока
app.post('/api/match/:id/interview', async (req: any, res) => {
  const f = fx(req.params.id);
  if (!f || f.status !== 'done') return fail(res, 'Матч ещё не завершён');
  const m = getMatch(f.id);
  const HName = tn(f.home), AName = tn(f.away);
  const cH = getCoachForTeam(f.home), cA = getCoachForTeam(f.away);
  const motm = m?.motm || (m ? getMatchMotm(m, f, HName, AName, cH, cA) : null);
  if (!motm) return fail(res, 'Нет данных о лучшем игроке');
  const question = String(req.body.question || 'Как прокомментируете исход встречи и свою игру?').trim();

  if (hasLLM()) {
    try {
      const prompt = `Ты — лучший игрок матча ${motm.name} (${motm.pos}, клуб ${motm.teamName}). Матч: ${HName} ${f.hg}:${f.ag} ${AName} (${roundLabel(f)}). Журналист на флеш-интервью спрашивает: "${question}". Ответь живо, эмоционально, сдержанно или воодушевленно в 2-4 предложениях от первого лица.`;
      const ans = await callProv(provList()[0], '', prompt, { temp: 0.8, max: 500 });
      return res.json({ question, answer: ans.trim(), player: motm.name });
    } catch {}
  }
  return res.json({
    question,
    answer: `«${question.includes('удар') || question.includes('гол') ? 'В моменте с голом просто принял решение бить в угол, главное было попасть в створ. ' : ''}Мы готовились к тяжёлой борьбе. Тренер указал на ключевые зоны, мы старались строго выполнить установку и рады подарить эмоции нашим фанатам!»`,
    player: motm.name
  });
});

// Кубок России 2026/2027: структура, группы Пути РПЛ, Путь регионов и плей-офф
app.get('/api/cup/structure', (req, res) => {
  if (!db.cupState2026) advanceCup();
  recalculateCupGroups(db.cupState2026, seasonFx());
  const cupMatches = seasonFx().filter((f: any) => f.comp === 'cup').map(pubFx);
  res.json({
    state: db.cupState2026,
    fixtures: cupMatches,
    teams: db.teams.map(pubTeam)
  });
});

// Тренеры
app.get('/api/coaches', (req, res) => {
  const list = db.teams.map((t: any) => {
    const coach = getCoachForTeam(t.id);
    const synergy = computeCoachSynergy(coach, db.tactics[t.id]);
    return {
      teamId: t.id,
      teamName: t.name,
      comp: t.comp,
      logo: teamLogo(t.id),
      coach,
      synergy
    };
  });
  res.json(list);
});

app.get('/api/coach/:teamId', (req, res) => {
  const t = team(req.params.teamId);
  if (!t) return fail(res, 'Клуб не найден', 404);
  const coach = getCoachForTeam(t.id);
  const synergy = computeCoachSynergy(coach, db.tactics[t.id]);
  res.json({ team: pubTeam(t), coach, synergy });
});

app.post('/api/coach/:teamId', admin, (req, res) => {
  const t = team(req.params.teamId);
  if (!t) return fail(res, 'Клуб не найден', 404);
  const cur = getCoachForTeam(t.id);
  const b = req.body;
  db.coaches ||= {};
  db.coaches[t.id] = {
    ...cur,
    name: b.name ? String(b.name).trim() : cur.name,
    style: b.style && ['bus', 'counter', 'possession', 'attack', 'press'].includes(b.style) ? b.style : cur.style,
    favoriteFormation: b.favoriteFormation || cur.favoriteFormation,
    reputation: Number(b.reputation) || cur.reputation,
    temperament: b.temperament || cur.temperament,
    quote: b.quote || cur.quote
  };
  save();
  res.json({ ok: 1, coach: db.coaches[t.id] });
});

// Сборные и награды (Awards)
app.get('/api/awards/round', (req, res) => {
  const comp = String(req.query.comp || 'rpl');
  const compFx = seasonFx().filter((f: any) => f.comp === comp && f.status === 'done');
  const rounds = [...new Set(compFx.map((f: any) => roundLabel(f)))];
  const requestedRound = String(req.query.round || rounds[rounds.length - 1] || '1-й тур');

  const matchesMap: Record<string, any> = {};
  for (const f of compFx) {
    const m = getMatch(f.id);
    if (m) matchesMap[f.id] = m;
  }
  const teamsMap = Object.fromEntries(db.teams.map((t: any) => [t.id, pubTeam(t)]));

  const teamOfRound = buildTeamOfRound(requestedRound, comp, compFx, matchesMap, teamsMap);
  res.json({
    comp,
    availableRounds: rounds,
    selectedRound: requestedRound,
    teamOfRound
  });
});

app.get('/api/awards/month', (req, res) => {
  const comp = String(req.query.comp || 'rpl');
  const compFx = seasonFx().filter((f: any) => f.comp === comp && f.status === 'done');
  const months = [...new Set(compFx.map((f: any) => (f.date || '').slice(0, 7)).filter(Boolean))].sort();
  const requestedMonth = String(req.query.month || months[months.length - 1] || '2026-08');

  const matchesMap: Record<string, any> = {};
  for (const f of compFx) {
    const m = getMatch(f.id);
    if (m) matchesMap[f.id] = m;
  }
  const teamsMap = Object.fromEntries(db.teams.map((t: any) => [t.id, pubTeam(t)]));

  const teamOfMonth = buildTeamOfMonth(requestedMonth, comp, compFx, matchesMap, teamsMap);
  res.json({
    comp,
    availableMonths: months,
    selectedMonth: requestedMonth,
    teamOfMonth
  });
});

app.get('/api/awards/season', (req, res) => {
  const comp = String(req.query.comp || 'rpl');
  const A = agg();
  const P = Object.values<any>(A.P).filter(x => x.comp === comp);
  const rows = table(comp);

  const topScorer = [...P].sort((a, b) => b.g - a.g || b.min - a.min)[0] || null;
  const topAssister = [...P].sort((a, b) => b.a - a.a || b.min - a.min)[0] || null;
  const bestGk = [...P].filter(p => p.cs > 0 || p.sv > 0).sort((a, b) => b.cs - a.cs || b.sv - a.sv)[0] || null;

  const championTeam = rows[0] ? team(rows[0].id) : null;
  const coachOfSeason = championTeam ? {
    coach: getCoachForTeam(championTeam.id),
    teamName: championTeam.name,
    teamLogo: teamLogo(championTeam.id),
    title: 'Тренер года',
    reason: `Привёл команду «${championTeam.name}» к чемпионскому титулу`
  } : null;

  const matchesMap: Record<string, any> = {};
  for (const f of seasonFx().filter((f: any) => f.comp === comp && f.status === 'done')) {
    const m = getMatch(f.id);
    if (m) matchesMap[f.id] = m;
  }
  const teamsMap = Object.fromEntries(db.teams.map((t: any) => [t.id, pubTeam(t)]));
  const allMonths: string[] = [...new Set<string>(seasonFx().map((f: any) => String(f.date || '').slice(0, 7)).filter(Boolean))].sort();
  const latestMonth: string = allMonths[allMonths.length - 1] || '2026-08';
  const teamOfSeason = buildTeamOfMonth(latestMonth, comp, seasonFx(), matchesMap, teamsMap);

  res.json({
    comp,
    season: S(),
    topScorer: topScorer ? { ...topScorer, team: tn(topScorer.t), logo: teamLogo(topScorer.t) } : null,
    topAssister: topAssister ? { ...topAssister, team: tn(topAssister.t), logo: teamLogo(topAssister.t) } : null,
    bestGk: bestGk ? { ...bestGk, team: tn(bestGk.t), logo: teamLogo(bestGk.t) } : null,
    coachOfSeason,
    teamOfSeason
  });
});

app.get('/api/season/rotation-preview', (req, res) => {
  res.json(getSeasonRotationPreview());
});

app.post('/api/admin/playoffs/generate', admin, (req, res) => {
  try {
    const result = generateSeasonPlayoffs(S());
    res.json(result);
  } catch (e: any) {
    fail(res, e.message);
  }
});

app.post('/api/admin/playoffs/run-all', admin, (req, res) => {
  try {
    const scheduled = seasonFx().filter((f: any) => (f.comp === 'playoff' || f.comp === 'playoff_rpl_fnl') && f.status !== 'done');
    if (!scheduled.length) {
      return res.json({ ok: 1, ran: 0, message: 'Все стыковые матчи уже сыграны', playoffs: getSeasonPlayoffs(S()) });
    }
    // Remove from live queue if any were queued
    for (const f of scheduled) {
      const idx = queue.indexOf(f.id);
      if (idx >= 0) queue.splice(idx, 1);
    }
    // Sort so Leg 1 is simulated before Leg 2
    scheduled.sort((a: any, b: any) => (a.playoffLeg || 1) - (b.playoffLeg || 1) || a.date.localeCompare(b.date));

    for (const f of scheduled) {
      const r = rng(f.id + Date.now());
      f.hg = poisson(1.45, r);
      f.ag = poisson(1.1, r);
      f.status = 'done';
      f.st = null;
      f.note = f.note || '';
      checkPlayoffShootout(f);
      const hSq = squadOf(f.home), aSq = squadOf(f.away);
      const winSq = f.hg >= f.ag ? hSq : aSq;
      const pMotm = winSq[0] || hSq[0];
      if (pMotm) {
        f.motm = { pid: pMotm.id, name: pMotm.name, rating: +(7.5 + (f.hg > f.ag ? 0.8 : 0.3)).toFixed(1) };
      }
    }
    invalidateAgg();
    save();

    res.json({ ok: 1, ran: scheduled.length, playoffs: getSeasonPlayoffs(S()) });
  } catch (e: any) {
    fail(res, e.message);
  }
});

app.post('/api/admin/season/rotate', admin, (req, res) => {
  try {
    const result = performSeasonRotation(req.body.nextSeason, req.body.startDate, !!req.body.force);
    res.json(result);
  } catch (e: any) {
    fail(res, e.message);
  }
});

app.post('/api/season/switch', (req: any, res) => {
  const target = String(req.body.season || '').trim();
  const doRotate = !!req.body.rotate || !!req.body.next;
  
  if (doRotate) {
    try {
      const customNext = req.body.nextSeason ? String(req.body.nextSeason).trim() : undefined;
      const customStart = req.body.startDate ? String(req.body.startDate).trim() : undefined;
      const result = performSeasonRotation(customNext, customStart, !!req.body.force);
      return res.json({ season: S(), seasons: getAvailableSeasons(), ...result });
    } catch (e: any) {
      return fail(res, e.message);
    }
  }
  
  if (!target) return fail(res, 'Укажите сезон');
  
  db.settings.season = target;
  const hasRpl = db.fixtures.some((f: any) => f.season === target && f.comp === 'rpl');
  if (!hasRpl) {
    const startYear = parseInt(target.slice(0, 4), 10) || 2026;
    genSeason(`${startYear}-07-18`, target);
  }
  ensureDualTimes(target);
  invalidateAgg();
  save();
  res.json({ ok: 1, season: S(), seasons: getAvailableSeasons() });
});

app.post('/api/admin/schedule/real-times', admin, (req, res) => {
  if (req.body.realStartDate && /^\d{4}-\d{2}-\d{2}$/.test(req.body.realStartDate)) {
    db.settings.realStartDate = req.body.realStartDate;
  }
  ensureDualTimes(S(), true);
  save();
  res.json({ ok: 1, realStartDate: db.settings.realStartDate, fixtures: seasonFx().length });
});

app.get('/api/live/:id', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  res.write('data: {"type":"hello"}\n\n');
  const l = live[req.params.id] ||= { clients: new Set() };
  l.clients.add(res);
  const ka = setInterval(() => res.write(': ka\n\n'), 20000);
  req.on('close', () => {
    clearInterval(ka);
    l.clients.delete(res);
  });
});

app.get('/api/leaders', (req, res) => {
  const comp = String(req.query.comp || 'rpl');
  const A = agg();
  const P = Object.values<any>(A.P).filter(x => x.comp === comp).map(x => ({
    ...x,
    team: tn(x.t),
    teamLogo: teamLogo(x.t),
    xg: +x.xg.toFixed(2)
  }));
  const existingTeams = new Set<string>();
  const T = Object.values<any>(A.T).filter(x => x.comp === comp).map(x => {
    existingTeams.add(String(x.tid));
    return {
      ...x,
      team: tn(x.tid),
      teamLogo: teamLogo(x.tid),
      xg: +x.xg.toFixed(2),
      xga: +x.xga.toFixed(2)
    };
  });
  const compTeams = db.teams.filter((t: any) => t.comp === comp);
  for (const t of compTeams) {
    if (!existingTeams.has(t.id)) {
      T.push({
        tid: t.id,
        comp,
        m: 0, g: 0, ga: 0, xg: 0, xga: 0, co: 0,
        penF: 0, penA: 0, refF: 0, refA: 0, fo: 0, foA: 0,
        yc: 0, rc: 0, tk: 0, sv: 0, cs: 0,
        team: t.name,
        teamLogo: teamLogo(t.id)
      });
    }
  }
  res.json({ players: P, teams: T });
});

app.get('/api/players/search', (req, res) => {
  const q = norm(req.query.q);
  if (q.length < 2) return res.json([]);
  res.json(db.players.filter((p: any) => norm(p.name).includes(q)).sort((a: any, b: any) => (norm(a.name).startsWith(q) ? 0 : 1) - (norm(b.name).startsWith(q) ? 0 : 1)).slice(0, 12).map(pubPlayer));
});

app.get('/api/derbies', (req, res) => {
  res.json(db.derbies.map((d: any) => ({
    ...d,
    aName: tn(d.a),
    bName: tn(d.b),
    aLogo: teamLogo(d.a),
    bLogo: teamLogo(d.b)
  })));
});

/* — клуб — */
app.get('/api/club', needClub, (req: any, res) => {
  const t = team(req.tid), sq = squadOf(req.tid);
  const today = new Date().toISOString().slice(0, 10);
  const up = seasonFx().filter((f: any) => (f.home === req.tid || f.away === req.tid) && f.status === 'scheduled').sort((a: any, b: any) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
  const legionLimit = getRplLegionLimit(S());
  const legionSquadCount = sq.filter(isLegionnaire).length;
  
  const incoming = (db.transfers || []).filter((x: any) => x.from === req.tid && x.status === 'pending').map((x: any) => ({
    ...x,
    pName: player(x.pid)?.name || x.playerName,
    pos: player(x.pid)?.pos || x.pos,
    fromName: tn(x.from) || x.fromName,
    toName: tn(x.to) || x.toName,
    toLogo: teamLogo(x.to)
  }));

  const outgoing = (db.transfers || []).filter((x: any) => x.to === req.tid && x.status === 'pending').map((x: any) => ({
    ...x,
    pName: player(x.pid)?.name || x.playerName,
    pos: player(x.pid)?.pos || x.pos,
    fromName: tn(x.from) || x.fromName,
    fromLogo: teamLogo(x.from),
    toName: tn(x.to) || x.toName
  }));

  res.json({
    team: { ...pubTeam(t), code: req.me.role === 'admin' ? t.code : undefined },
    squadMax: db.settings.squadMax,
    legionLimit,
    legionSquadCount,
    squadSubmitted: !!db.squads[req.tid],
    squad: sq.map((p: any) => ({ ...pubPlayer(p), available: isAvail(p, today), card: p })),
    tactic: db.tactics[req.tid] || null,
    upcoming: up.map((f: any) => ({
      ...pubFx(f),
      lineup: db.lineups[f.id + ':' + req.tid] || null,
      auto: getLineup(f, req.tid),
      opp: tn(f.home === req.tid ? f.away : f.home),
      oppLogo: teamLogo(f.home === req.tid ? f.away : f.home)
    })),
    transfers: db.transfers.filter((x: any) => x.to === req.tid).slice(-10),
    incomingTransfers: incoming,
    outgoingTransfers: outgoing,
    budget: t.budget || 0,
    formattedBudget: '€' + (t.budget || 0).toLocaleString('ru-RU'),
    budgetHistory: (Array.isArray(db.budgetHistory) ? db.budgetHistory : []).filter((h: any) => h.teamId === req.tid).slice(-20).reverse()
  });
});

app.post('/api/club/squad/add', needClub, async (req: any, res) => {
  try {
    let p: any;
    if (req.body.playerId) {
      p = player(req.body.playerId);
    } else {
      [p] = await createPlayers([req.body.name], null, req.body.hint);
      if (p && req.body.pos && POSES.includes(req.body.pos) && !p.verified) p.pos = req.body.pos;
    }
    if (!p) return fail(res, 'Игрок не найден');
    const cur = squadOf(req.tid);
    if (cur.some((x: any) => x.id === p.id)) return res.json({ ok: 1 });
    if (cur.length >= db.settings.squadMax) return fail(res, `В заявке максимум ${db.settings.squadMax} игроков`);

    // Лимит легионеров в заявке РПЛ (12+7 в 2026/27, 11+6 в 2027/28, 10+5 в 2028/29)
    const tm = team(req.tid);
    if (tm && tm.comp === 'rpl') {
      const limit = getRplLegionLimit(S());
      const curLegions = cur.filter(isLegionnaire);
      if (isLegionnaire(p) && curLegions.length >= limit.inSquad) {
        return fail(res, `Превышен лимит легионеров в заявке РПЛ: максимум ${limit.inSquad} по лимиту ${limit.label} на сезон ${S()} (сейчас в заявке: ${curLegions.length} легионеров)`);
      }
    }

    const owner = p.teamId && p.teamId !== req.tid && team(p.teamId) && (team(p.teamId).code || squadOf(p.teamId).length);
    if (owner && req.me.role !== 'admin') {
      const fromTeam = team(p.teamId);
      const toTeam = team(req.tid);
      const isRplToRpl = fromTeam?.comp === 'rpl' && toTeam?.comp === 'rpl';
      const feeStr = String(req.body.fee || '€5.0M').trim();
      const feeNum = parseFeeAmount(feeStr);
      const isLoan = String(req.body.transferType || req.body.type || '').includes('loan');
      const note = String(req.body.note || (isLoan ? 'Аренда' : 'Полноценный трансфер')).slice(0, 300);

      const trObj = {
        id: uid(),
        pid: p.id,
        playerName: p.name,
        pos: p.pos || 'ЦП',
        from: p.teamId,
        fromName: fromTeam?.name || 'Клуб',
        to: req.tid,
        toName: toTeam?.name || 'Клуб',
        fee: feeStr,
        feeAmount: feeNum,
        type: isLoan ? 'loan' : 'transfer',
        note,
        status: 'pending',
        isRplToRpl,
        clubApproval: 'pending',
        adminApproval: 'pending',
        clubApprovedBy: p.teamId,
        initiator: req.tid,
        date: new Date().toISOString().slice(0, 10),
        at: Date.now()
      };

      db.transfers.unshift(trObj);
      save();
      return res.json({
        pending: 1,
        isRplToRpl,
        transfer: trObj,
        message: isRplToRpl
          ? `${p.name} числится в «${tn(p.teamId)}». Запрос (${feeStr}) отправлен владельцу «${tn(p.teamId)}» и администратору лиги. Переход состоится при обоюдном согласии.`
          : `${p.name} числится в «${tn(p.teamId)}». Заявка на трансфер отправлена администратору.`
      });
    }
    p.teamId = req.tid;
    db.squads[req.tid] = [...cur.map((x: any) => x.id), p.id];
    save();
    res.json({ ok: 1, player: pubPlayer(p) });
  } catch (e: any) {
    fail(res, e.message);
  }
});

app.post('/api/club/transfer/respond', needClub, (req: any, res) => {
  const { transferId, action, comment } = req.body;
  const t = db.transfers.find((x: any) => x.id === transferId);
  if (!t || t.status !== 'pending') return fail(res, 'Заявка на трансфер не найдена или уже завершена');
  if (t.from !== req.tid && t.to !== req.tid) {
    return fail(res, 'Этот трансфер не относится к вашему клубу');
  }

  if (action === 'approve') {
    t.clubApproval = 'approved';
    t.clubRespondedAt = new Date().toISOString();
    if (comment) t.clubComment = String(comment).slice(0, 200);
    const executed = executeTransferIfBothApproved(t);
    save();
    return res.json({
      ok: 1,
      approved: true,
      executed,
      message: executed
        ? 'Сделка окончательно согласована и завершена! Футболист переведен в состав.'
        : 'Вы дали согласие на сделку. Ожидается финальное подтверждение от администратора лиги.'
    });
  } else {
    t.clubApproval = 'rejected';
    t.status = 'rejected';
    t.rejectReason = `Отклонено владельцем клуба «${tn(req.tid)}»`;
    save();
    return res.json({ ok: 1, rejected: true, message: `Вы отклонили сделку по игроку ${t.playerName}.` });
  }
});

app.post('/api/club/squad/remove', needClub, (req: any, res) => {
  const cur = squadOf(req.tid).filter((p: any) => p.id !== req.body.playerId);
  db.squads[req.tid] = cur.map((p: any) => p.id);
  const p = player(req.body.playerId);
  if (p && p.teamId === req.tid) p.teamId = null;
  save();
  res.json({ ok: 1 });
});

app.post('/api/club/squad/submit', needClub, (req: any, res) => {
  db.squads[req.tid] = squadOf(req.tid).map((p: any) => p.id);
  save();
  res.json({ ok: 1 });
});

app.post('/api/club/lineup', needClub, (req: any, res) => {
  const f = fx(req.body.fid);
  if (!f || (f.home !== req.tid && f.away !== req.tid)) return fail(res, 'Это не матч вашего клуба');
  if (f.status !== 'scheduled') return fail(res, 'Матч уже начался — состав закрыт');
  const sq = new Set(squadOf(req.tid).map((p: any) => p.id));
  const st = (req.body.starters || []).filter((id: string) => sq.has(id));
  if (new Set(st).size !== st.length) return fail(res, 'Игрок указан дважды');
  if (st.length !== 11) return fail(res, 'В старте должно быть ровно 11 игроков');
  if (!st.some((id: string) => player(id)?.pos === 'ВР')) return fail(res, 'В старте нужен вратарь');
  const bad = st.map(player).filter((p: any) => !isAvail(p, f.date));
  if (bad.length) return fail(res, `Недоступны: ${bad.map((p: any) => p.name).join(', ')}`);

  // Лимит на легионеров на поле в РПЛ (12+7 в 2026/27, 11+6 в 2027/28, 10+5 в 2028/29)
  if (f.comp === 'rpl') {
    const limit = getRplLegionLimit(S());
    const legionStarters = st.map(player).filter(isLegionnaire);
    if (legionStarters.length > limit.onPitch) {
      return fail(res, `Превышен лимит легионеров на поле в РПЛ: в стартовом составе ${legionStarters.length} легионеров, разрешено максимум ${limit.onPitch} (лимит ${limit.label} на сезон ${S()})`);
    }
  }

  const fm = /^\d(-\d){1,3}$/.test(req.body.formation || '') ? req.body.formation : '4-3-3';
  const bench = (req.body.bench || []).filter((id: string) => sq.has(id) && !st.includes(id)).slice(0, 12);
  const L = {
    formation: fm,
    starters: st,
    bench,
    speech: String(req.body.speech || '').slice(0, 4000),
    training: String(req.body.training || '').slice(0, 4000),
    at: Date.now()
  };
  db.lineups[f.id + ':' + req.tid] = L;
  db.tactics[req.tid] = { ...L };
  save();
  res.json({ ok: 1 });
});

/* — админ — */
app.get('/api/admin/overview', admin, (req, res) => {
  res.json({
    teams: db.teams.map((t: any) => ({
      ...pubTeam(t),
      squad: squadOf(t.id).length,
      submitted: !!db.squads[t.id],
      code: t.code
    })),
    settings: {
      ...db.settings,
      keys: undefined,
      tgToken: db.settings.tgToken ? '••••' : '',
      adminCode: db.settings.adminCode,
      systemPrompt: db.settings.systemPrompt || SYS_DEFAULT
    },
    keys: {
      gemini: !!(getGeminiKeys().length),
      geminiCount: getGeminiKeys().length,
      groq: !!(process.env.GROQ_API_KEY || db.settings.keys.groq),
      openrouter: !!(process.env.OPENROUTER_API_KEY || db.settings.keys.openrouter)
    },
    models: db.settings.models,
    log: db.llmlog.slice(-25).reverse(),
    transfers: (db.transfers || []).filter((t: any) => t.status === 'pending').map((t: any) => ({
      ...t,
      pName: player(t.pid)?.name || t.playerName,
      pos: player(t.pid)?.pos || t.pos || 'ЦП',
      fromName: tn(t.from) || t.fromName || 'Клуб',
      toName: tn(t.to) || t.toName || 'Клуб',
      fromLogo: teamLogo(t.from),
      toLogo: teamLogo(t.to)
    })),
    allTransfers: (db.transfers || []).slice(0, 30).map((t: any) => ({
      ...t,
      pName: player(t.pid)?.name || t.playerName,
      pos: player(t.pid)?.pos || t.pos || 'ЦП',
      fromName: tn(t.from) || t.fromName || 'Клуб',
      toName: tn(t.to) || t.toName || 'Клуб',
      fromLogo: teamLogo(t.from),
      toLogo: teamLogo(t.to)
    }))
  });
});

app.post('/api/admin/settings', admin, (req, res) => {
  const b = req.body, s = db.settings;
  for (const k of ['season', 'siteUrl', 'tgChat']) if (typeof b[k] === 'string') s[k] = b[k].trim();
  if (typeof b.tgToken === 'string' && !b.tgToken.includes('•')) s.tgToken = b.tgToken.trim();
  for (const k of ['secPerMin', 'breakSec', 'squadMax']) if (b[k] !== undefined && +b[k] > 0) s[k] = +b[k];
  if (b.chunks !== undefined) s.chunks = +b.chunks === 6 ? 6 : 2;
  if (b.auto !== undefined) s.auto = !!b.auto;
  if (b.grounding !== undefined) s.grounding = !!b.grounding;
  if (typeof b.systemPrompt === 'string') s.systemPrompt = b.systemPrompt.trim() === SYS_DEFAULT.trim() ? '' : b.systemPrompt;
  for (const k of ['gemini', 'groq', 'openrouter']) {
    if (typeof b.keys?.[k] === 'string' && b.keys[k].trim()) s.keys[k] = b.keys[k].trim();
    if (b.keys?.[k] === '') delete s.keys[k];
    if (typeof b.models?.[k] === 'string') {
      if (b.models[k].trim()) s.models[k] = b.models[k].trim();
      else delete s.models[k];
    }
  }
  save();
  res.json({ ok: 1 });
});

app.post('/api/admin/season', admin, (req, res) => {
  let start = String(req.body.start || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return fail(res, 'Укажите дату старта (ГГГГ-ММ-ДД)');
  const name = String(req.body.name || S()).trim();
  if (seasonFx().length && db.settings.season === name && !req.body.force) {
    return fail(res, 'Для этого сезона расписание уже есть. Измените название сезона или подтвердите пересоздание.');
  }
  if (db.settings.season === name) db.fixtures = db.fixtures.filter((f: any) => f.season !== name);
  db.settings.manualDraw = false;
  genSeason(start, name);
  save();
  res.json({ ok: 1, fixtures: seasonFx().length });
});

app.post('/api/admin/clear-fixtures', admin, (req, res) => {
  db.fixtures = [];
  db.cupState2026 = null;
  db.settings.manualDraw = true;
  invalidateAgg();
  save();
  res.json({ ok: 1, message: 'Все турнирные матчи очищены. База готова к новой жеребьёвке.' });
});

app.post('/api/admin/team', admin, (req, res) => {
  const b = req.body;
  let t = b.id && team(b.id);
  if (b.delete) {
    if (!t) return fail(res, 'Нет такой команды');
    if (db.fixtures.some((f: any) => f.home === t.id || f.away === t.id)) return fail(res, 'У команды есть матчи — удалять нельзя');
    db.teams = db.teams.filter((x: any) => x !== t);
    save();
    return res.json({ ok: 1 });
  }
  if (!String(b.name || '').trim()) return fail(res, 'Нужно название');
  if (!t) {
    t = { id: uid(), code: '' };
    db.teams.push(t);
  }
  const name = b.name.trim();
  const comp = db.comps.some((c: any) => c.id === b.comp) ? b.comp : 'rpl';
  const logo = b.logo ? b.logo.trim() : (t.logo || getTeamLogo(name, null, comp));
  Object.assign(t, {
    name,
    comp,
    logo,
    city: b.city || '',
    stadium: b.stadium || '',
    lat: b.lat === '' || b.lat == null ? t.lat ?? null : +b.lat,
    lon: b.lon === '' || b.lon == null ? t.lon ?? null : +b.lon
  });
  if (b.regen || (b.comp === 'rpl' && !t.code)) t.code = mkCode();
  if (b.clearCode) t.code = '';
  save();
  res.json({ ok: 1, team: pubTeam(t) });
});

app.post('/api/admin/import', admin, async (req, res) => {
  const names = String(req.body.names || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  if (!req.body.teamId || !team(req.body.teamId)) return fail(res, 'Выберите команду');
  if (!names.length) return fail(res, 'Вставьте список игроков');
  try {
    const out: any[] = [];
    for (let i = 0; i < names.length; i += 10) {
      out.push(...await createPlayers(names.slice(i, i + 10), req.body.teamId, team(req.body.teamId).name));
    }
    const tid = req.body.teamId;
    for (const p of out) p.teamId = tid;
    db.squads[tid] = [...new Set([...squadOf(tid).map((p: any) => p.id), ...out.map((p: any) => p.id)])];
    save();
    res.json({ ok: 1, added: out.length, verified: out.filter(p => p.verified).length });
  } catch (e: any) {
    fail(res, e.message);
  }
});

app.get('/api/admin/players', admin, (req, res) => {
  const q = norm(req.query.q || '');
  let l = db.players;
  if (req.query.teamId) l = l.filter((p: any) => p.teamId === req.query.teamId);
  if (q) l = l.filter((p: any) => norm(p.name).includes(q));
  res.json(l.slice(0, 300).map(pubPlayer));
});

app.post('/api/admin/player', admin, (req, res) => {
  const b = req.body;
  if (b.delete) {
    db.players = db.players.filter((p: any) => p.id !== b.id);
    for (const k of Object.keys(db.squads)) db.squads[k] = db.squads[k].filter((i: string) => i !== b.id);
    save();
    return res.json({ ok: 1 });
  }
  let p = b.id && player(b.id);
  if (!p) {
    p = cardFrom({ name: b.name }, { teamId: b.teamId });
    db.players.push(p);
  }
  for (const k of ['name', 'pos', 'born', 'nation', 'realClub', 'style', 'stats2y', 'form', 'character', 'news', 'otherNationalTeam']) {
    if (typeof b[k] === 'string') p[k] = b[k];
  }
  if (b.playedForOtherNationalTeam !== undefined) {
    p.playedForOtherNationalTeam = !!b.playedForOtherNationalTeam;
  }
  if (b.achievements !== undefined) {
    p.achievements = Array.isArray(b.achievements) ? b.achievements : String(b.achievements).split('\n').map(s => s.trim()).filter(Boolean);
  }
  if ('teamId' in b) {
    p.teamId = b.teamId || null;
    if (p.teamId) {
      db.squads[p.teamId] = [...new Set([...squadOf(p.teamId).map((x: any) => x.id), p.id])];
    }
  }
  if ('out' in b) p.out = b.out && b.out.until ? b.out : null;
  if (b.banLeft !== undefined) p.banLeft = +b.banLeft || 0;
  p.updatedAt = new Date().toISOString();
  save();
  res.json({ ok: 1, player: p });
});

app.post('/api/admin/refresh', admin, async (req, res) => {
  const names = squadOf(req.body.teamId).map((p: any) => p.name);
  if (!hasLLM()) return fail(res, 'Нет ключей нейросети');
  let n = 0;
  try {
    for (let i = 0; i < names.length; i += 10) {
      const r = await llmJSON(CARD_SYS, `Игроки: ${names.slice(i, i + 10).map((x: any, j: number) => `${j + 1}. ${x}`).join('; ')}. Клуб: ${tn(req.body.teamId)}. Обнови актуальную форму и новости.`, { task: 'refresh', temp: 0.3, max: 8000, grounded: !!db.settings.grounding && provList()[0]?.n === 'gemini' });
      (r.players || []).forEach((c: any, j: number) => {
        const p = findPlayerByName(names[i + j]);
        if (p && c && c.found !== false) {
          for (const k of ['style', 'stats2y', 'form', 'character', 'news']) if (c[k]) p[k] = c[k];
          if (Array.isArray(c.achievements) && c.achievements.length) p.achievements = c.achievements;
          p.verified = true;
          p.updatedAt = new Date().toISOString();
          n++;
        }
      });
    }
    save();
    res.json({ ok: 1, updated: n });
  } catch (e: any) {
    fail(res, e.message);
  }
});

app.post('/api/admin/run', admin, async (req, res) => {
  const b = req.body;
  let list = seasonFx().filter((f: any) => f.status === 'scheduled');
  if (b.fid) list = list.filter((f: any) => f.id === b.fid);
  else if (b.date) list = list.filter((f: any) => f.date === b.date);
  else if (b.comp && b.round) list = list.filter((f: any) => f.comp === b.comp && f.round === +b.round);
  else if (b.upto) list = list.filter((f: any) => f.date <= b.upto);
  else return fail(res, 'Не указано, что запускать');
  if (!list.length) return fail(res, 'Нет матчей для запуска');
  res.json(await runBatch(list));
});

app.post('/api/admin/fixture', admin, (req, res) => {
  const f = fx(req.body.id);
  if (!f) return fail(res, 'Матч не найден');
  if (req.body.reset) {
    if (f.status === 'live') { clearTimeout(timers[f.id]); }
    Object.assign(f, { status: 'scheduled', hg: null, ag: null, pen: null, st: null, pos: 0, final: null, err: '' });
    try { fs.unlinkSync(path.join(MDIR, f.id + '.json')); } catch { }
    mcache.delete(f.id);
    invalidateAgg();
    save();
    return res.json({ ok: 1 });
  }
  if (f.status !== 'scheduled' && !req.body.force) return fail(res, 'Матч уже сыгран');
  
  // Game date and time
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.body.gameDate || req.body.date || '')) {
    f.gameDate = req.body.gameDate || req.body.date;
    f.date = f.gameDate;
  }
  if (/^\d{2}:\d{2}$/.test(req.body.gameTime || req.body.time || '')) {
    f.gameTime = req.body.gameTime || req.body.time;
    f.time = f.gameTime;
  }

  // Real date and time
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.body.realDate || '')) {
    f.realDate = req.body.realDate;
  }
  if (/^\d{2}:\d{2}$/.test(req.body.realTime || '')) {
    f.realTime = req.body.realTime;
  }
  if (req.body.hg !== undefined && req.body.ag !== undefined && f.status === 'scheduled') {
    f.hg = +req.body.hg;
    f.ag = +req.body.ag;
    f.status = 'done';
    f.st = null;
    if ((f.comp === 'cup' || f.comp === 'supercup') && f.hg === f.ag) f.pen = shootout(f);
    checkPlayoffShootout(f);
    invalidateAgg();
    advanceCup();
  }
  save();
  res.json({ ok: 1 });
});

app.get('/api/admin/lineups/:fid', admin, (req, res) => {
  const f = fx(req.params.fid);
  if (!f) return fail(res, 'Нет матча');
  const o: Record<string, any> = {};
  for (const s of ['home', 'away']) {
    const L = getLineup(f, f[s]);
    o[s] = {
      team: tn(f[s]),
      logo: teamLogo(f[s]),
      ...L,
      starters: L.starters.map((id: string) => player(id)?.name),
      bench: L.bench.map((id: string) => player(id)?.name)
    };
  }
  res.json(o);
});

app.post('/api/admin/derby', admin, (req, res) => {
  const b = req.body;
  if (b.delete) {
    db.derbies = db.derbies.filter((d: any) => d.id !== b.id);
    save();
    return res.json({ ok: 1 });
  }
  if (!team(b.a) || !team(b.b) || b.a === b.b) return fail(res, 'Выберите две разные команды');
  db.derbies.push({ id: uid(), a: b.a, b: b.b, name: b.name || 'Принципиальное противостояние', note: b.note || '' });
  save();
  res.json({ ok: 1 });
});

app.post('/api/admin/transfer', admin, (req, res) => {
  const t = db.transfers.find((x: any) => x.id === req.body.id);
  if (!t || t.status !== 'pending') return fail(res, 'Заявка не найдена');
  if (req.body.approve) {
    t.adminApproval = 'approved';
    if (req.body.force || !t.isRplToRpl) {
      t.clubApproval = 'approved';
    }
    const executed = executeTransferIfBothApproved(t);
    save();
    res.json({ ok: 1, approved: true, executed, isRplToRpl: t.isRplToRpl, clubApproval: t.clubApproval });
  } else {
    t.adminApproval = 'rejected';
    t.status = 'rejected';
    t.rejectReason = 'Отклонено администратором';
    save();
    res.json({ ok: 1, rejected: true });
  }
});

app.post('/api/admin/transfer/respond', admin, (req, res) => {
  const { transferId, action, force } = req.body;
  const t = db.transfers.find((x: any) => x.id === transferId);
  if (!t || t.status !== 'pending') return fail(res, 'Заявка не найдена или уже закрыта');
  if (action === 'approve') {
    t.adminApproval = 'approved';
    if (force || !t.isRplToRpl) {
      t.clubApproval = 'approved';
    }
    const executed = executeTransferIfBothApproved(t);
    save();
    res.json({
      ok: 1,
      approved: true,
      executed,
      transfer: t,
      message: executed
        ? 'Сделка окончательно одобрена и завершена!'
        : 'Администратор одобрил сделку. Ожидается подтверждение от владельца клуба.'
    });
  } else {
    t.adminApproval = 'rejected';
    t.status = 'rejected';
    t.rejectReason = 'Отклонено администратором';
    save();
    res.json({ ok: 1, rejected: true, message: 'Сделка отклонена администратором' });
  }
});

app.post('/api/admin/transfer/ai-advice', admin, async (req, res) => {
  const { transferId } = req.body;
  const t = db.transfers.find((x: any) => x.id === transferId);
  if (!t) return fail(res, 'Трансфер не найден');
  const p = player(t.pid);
  const fromT = team(t.from);
  const toT = team(t.to);

  try {
    const advice = await getTransferAiAdvice(t, p, fromT, toT);
    t.aiAdvice = advice;
    save();
    res.json({ ok: 1, advice, transferId: t.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Ошибка генерации совета' });
  }
});

app.post('/api/admin/ask', admin, async (req, res) => {
  const f = fx(req.body.fid), m = f && getMatch(f.id);
  if (!m || f.status !== 'done') return fail(res, 'Сначала дождитесь конца матча');
  if (!req.body.question) return fail(res, 'Введите вопрос');
  if (!hasLLM()) return fail(res, 'Нужен ключ нейросети');
  const ev = m.events.map((e: any) => `${e.min}:${String(e.sec).padStart(2, '0')} [${e.type}] ${e.team} ${e.players.join(' / ')} — ${e.text}${e.xg ? ` (xG ${e.xg})` : ''}`).join('\n');
  const st = m.stats, H = m.ctx.sides.home.name, A = m.ctx.sides.away.name;
  const sys = 'Ты — аналитик симулятора «Вирт РПЛ». Отвечай на вопросы админа ТОЛЬКО по предоставленным данным матча (события, статистика, составы, контекст). Ссылайся на конкретные минуты и игроков. Если данных для ответа нет — так и скажи. Пиши по-русски, ясно и по делу.';
  const user = `МАТЧ ${H} ${f.hg}:${f.ag} ${A}${f.pen ? ` (пен. ${f.pen.hg}:${f.pen.ag})` : ''}. ${m.ctx.comp}, ${m.ctx.roundLabel}.\nКонтекст: ${m.ctx.motiv.home} | ${m.ctx.motiv.away} | Противостояние: ${m.ctx.derby} | Погода: ${m.ctx.weather}\nУсталость: ${m.ctx.fat.home} | ${m.ctx.fat.away}\nРечь ${H}: «${m.ctx.lineup.home.speech || 'молчание'}» Тренировки: «${m.ctx.lineup.home.training || '—'}»\nРечь ${A}: «${m.ctx.lineup.away.speech || 'молчание'}» Тренировки: «${m.ctx.lineup.away.training || '—'}»\nСхемы: ${m.ctx.lineup.home.formation} / ${m.ctx.lineup.away.formation}\nСтатистика: ${JSON.stringify(st.teams)} владение ${st.poss.join('-')}\nИгроки: ${Object.values<any>(st.players).map(p => `${p.n}: ${p.min}', ${p.g}г ${p.a}п ${p.sh}уд xG${p.xg} ${p.tk}отб ${p.sv}сейв ${p.yc}жк ${p.rc}кк`).join('; ')}\nСОБЫТИЯ:\n${ev}\n\nВОПРОС АДМИНА: ${req.body.question}`;
  try {
    res.json({ answer: (await llm(sys, user, { json: false, task: 'ask', temp: 0.4, max: 4000 })).trim() });
  } catch (e: any) {
    fail(res, e.message);
  }
});

/* ───────── бюджеты команд и начисление призовых (только админ) ───────── */
app.get('/api/admin/budgets', admin, (req, res) => {
  try {
    ensureInitialBudgets();
    const teams = db.teams.map((t: any) => ({
      id: t.id,
      name: t.name,
      comp: t.comp,
      city: t.city,
      stadium: t.stadium,
      logo: teamLogo(t.id),
      budget: t.budget || 0,
      formattedBudget: '€' + (t.budget || 0).toLocaleString('ru-RU')
    })).sort((a: any, b: any) => {
      if (a.comp === 'rpl' && b.comp !== 'rpl') return -1;
      if (a.comp !== 'rpl' && b.comp === 'rpl') return 1;
      return (b.budget || 0) - (a.budget || 0);
    });

    const rplStandings = table('rpl').map((row: any, idx: number) => ({
      place: idx + 1,
      teamId: row.id,
      teamName: row.name,
      logo: teamLogo(row.id),
      points: row.pts || 0,
      played: row.p || 0,
      defaultPrize: RPL_PRIZE_SCALE[idx]?.prize || 3_400_000,
      label: RPL_PRIZE_SCALE[idx]?.label || `${idx + 1} место`
    }));

    const cupSuggestions = calculateCupPrizeSuggestions();

    res.json({
      teams,
      history: (Array.isArray(db.budgetHistory) ? db.budgetHistory : []).slice(-200).reverse(),
      rplScale: RPL_PRIZE_SCALE,
      cupScale: CUP_PRIZE_SCALE,
      rplStandings,
      cupSuggestions,
      totalLeagueBudget: teams.reduce((acc: number, t: any) => acc + (t.budget || 0), 0)
    });
  } catch (e: any) {
    fail(res, e.message);
  }
});

app.post('/api/admin/budget/adjust', admin, (req, res) => {
  ensureInitialBudgets();
  const { teamId, amount, mode, reason } = req.body;
  const t = team(teamId);
  if (!t) return fail(res, 'Клуб не найден');
  const numAmt = Number(amount);
  if (isNaN(numAmt)) return fail(res, 'Некорректная сумма');

  const prevBudget = t.budget || 0;
  let newBudget = prevBudget;
  let diff = 0;

  if (mode === 'set') {
    newBudget = Math.max(0, Math.round(numAmt));
    diff = newBudget - prevBudget;
  } else if (mode === 'subtract') {
    diff = -Math.abs(Math.round(numAmt));
    newBudget = Math.max(0, prevBudget + diff);
  } else {
    diff = Math.abs(Math.round(numAmt));
    newBudget = prevBudget + diff;
  }

  t.budget = newBudget;

  const entry = {
    id: uid(),
    teamId: t.id,
    teamName: t.name,
    amount: diff,
    prevBudget,
    newBudget,
    type: 'admin_adjustment',
    typeLabel: 'Ручная корректировка админа',
    description: reason || (diff >= 0 ? `Пополнение бюджета: +€${Math.abs(diff).toLocaleString('ru-RU')}` : `Списание из бюджета: -€${Math.abs(diff).toLocaleString('ru-RU')}`),
    date: new Date().toISOString(),
    byAdmin: true
  };

  if (!Array.isArray(db.budgetHistory)) db.budgetHistory = [];
  db.budgetHistory.push(entry);
  save();

  res.json({ ok: 1, newBudget, entry, formattedBudget: '€' + newBudget.toLocaleString('ru-RU') });
});

app.post('/api/admin/budget/award-prizes', admin, (req, res) => {
  ensureInitialBudgets();
  const { rplAwards, cupAwards, seasonName } = req.body;
  const curSeason = seasonName || db.settings.season || '2026/27';

  let count = 0;
  let totalAwarded = 0;
  const now = new Date().toISOString();

  if (Array.isArray(rplAwards)) {
    for (const aw of rplAwards) {
      if (!aw.teamId) continue;
      const t = team(aw.teamId);
      const prize = Number(aw.prize);
      if (!t || isNaN(prize) || prize <= 0) continue;

      const prevBudget = t.budget || 0;
      t.budget = prevBudget + prize;
      const placeText = aw.place ? `${aw.place} место в РПЛ` : 'Призовые РПЛ';

      if (!Array.isArray(db.budgetHistory)) db.budgetHistory = [];
      db.budgetHistory.push({
        id: uid(),
        teamId: t.id,
        teamName: t.name,
        amount: prize,
        prevBudget,
        newBudget: t.budget,
        type: 'rpl_prize',
        typeLabel: 'Призовые РПЛ',
        description: `Начислены призовые за ${placeText} (Сезон ${curSeason}): +€${prize.toLocaleString('ru-RU')}`,
        date: now,
        byAdmin: true
      });
      count++;
      totalAwarded += prize;
    }
  }

  if (Array.isArray(cupAwards)) {
    for (const aw of cupAwards) {
      if (!aw.teamId) continue;
      const t = team(aw.teamId);
      const prize = Number(aw.prize);
      if (!t || isNaN(prize) || prize <= 0) continue;

      const prevBudget = t.budget || 0;
      t.budget = prevBudget + prize;
      const stageText = aw.stageLabel || 'Участие в Кубке России';
      const winsNote = aw.wins ? ` (${aw.wins} побед)` : '';

      if (!Array.isArray(db.budgetHistory)) db.budgetHistory = [];
      db.budgetHistory.push({
        id: uid(),
        teamId: t.id,
        teamName: t.name,
        amount: prize,
        prevBudget,
        newBudget: t.budget,
        type: 'cup_prize',
        typeLabel: 'Призовые Кубка России',
        description: `Призовые Кубка России: ${stageText}${winsNote} (Сезон ${curSeason}): +€${prize.toLocaleString('ru-RU')}`,
        date: now,
        byAdmin: true
      });
      count++;
      totalAwarded += prize;
    }
  }

  save();
  res.json({
    ok: 1,
    awardedCount: count,
    totalAwarded,
    formattedTotal: '€' + totalAwarded.toLocaleString('ru-RU'),
    message: `Успешно начислены призовые для ${count} клубов на сумму €${totalAwarded.toLocaleString('ru-RU')}!`
  });
});

/* ───────── старт и инициализация ───────── */
load();
/* ───────── судьи (только админ) ───────── */
app.get('/api/admin/referees', admin, (req, res) => {
  const list = [...(db.referees || [])].sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
  res.json({ referees: list, assistants: db.assistants || [] });
});

app.post('/api/admin/referees/portfolios-all', admin, async (req, res) => {
  const refs = db.referees || [];
  const assts = db.assistants || [];
  if (hasLLM()) {
    try {
      const refNames = refs.map((r: any) => `${r.name} (${r.role || 'Главный'}, ${r.city}, ${r.varRole || 'без ВАР'})`).join('; ');
      const rPrompt = `Составь подробные профессиональные портреты для каждого из этих российских футбольных арбитров: ${refNames}.
Для каждого укажи: как судит в поле, манеру общения, строгость, как работает на ВАР и АВАР, известные реальные матчи.
Ответь строго в JSON: { "items": [ { "name": "Имя Фамилия", "bio": "подробный портрет 3-4 предложения" } ] }`;
      const rRes = await llmJSON('Ты — эксперт по судейству РПЛ.', rPrompt, { temp: 0.4, max: 6000 });
      for (const item of (rRes.items || [])) {
        const found = refs.find((x: any) => x.name.toLowerCase() === String(item.name || '').toLowerCase());
        if (found && item.bio) found.bio = String(item.bio);
      }

      const asstNames = assts.map((a: any) => a.name).join(', ');
      const aPrompt = `Составь подробные профессиональные портреты для каждого из этих 30 помощников судьи (лайнов) РПЛ: ${asstNames}.
Для каждого укажи: как судит на линии, точность определения офсайдов, манеру работы и с кем из главных арбитров РПЛ лучше всего работает в бригаде.
Ответь строго в JSON: { "items": [ { "name": "Имя Фамилия", "bio": "подробный портрет 2-3 предложения" } ] }`;
      const aRes = await llmJSON('Ты — эксперт по судейству РПЛ.', aPrompt, { temp: 0.4, max: 6000 });
      for (const item of (aRes.items || [])) {
        const found = assts.find((x: any) => x.name.toLowerCase() === String(item.name || '').toLowerCase());
        if (found && item.bio) found.bio = String(item.bio);
      }
      save();
      return res.json({ ok: 1, count: refs.length + assts.length });
    } catch (e: any) {
      console.error('portfolios-all:', e.message);
    }
  }
  for (const r of refs) {
    r.bio = `${r.name} (${r.city}) — ${r.role || 'главный арбитр'}. В поле: ${r.styleDesc || r.style}. ${r.varRole ? 'Активно работает на ВАР и АВАР, оперативно проверяет ключевые эпизоды в штрафной.' : 'Специализируется на работе в поле.'}`;
  }
  for (const a of assts) {
    a.bio = `${a.name} — квалифицированный помощник судьи РПЛ. Отличается высокой концентрацией при фиксации офсайдов и чётким взаимодействием с главным арбитром.`;
  }
  save();
  res.json({ ok: 1, count: refs.length + assts.length });
});

app.post('/api/admin/referee', admin, (req, res) => {
  const { id, name, city, age, style, styleDesc, leagues, rating, bio } = req.body;
  if (!name) return fail(res, 'Укажите имя судьи');
  if (id) {
    const r = db.referees.find((x: any) => x.id === id);
    if (!r) return fail(res, 'Судья не найден');
    Object.assign(r, {
      name,
      city: city || r.city,
      age: Number(age) || r.age,
      style: style || r.style,
      styleDesc: styleDesc || r.styleDesc,
      leagues: Array.isArray(leagues) ? leagues : r.leagues,
      rating: Number(rating) || r.rating,
      bio: bio ?? r.bio
    });
  } else {
    db.referees.push({
      id: 'ref_' + uid(),
      name,
      city: city || 'Москва',
      age: Number(age) || 38,
      style: style || 'balanced',
      styleDesc: styleDesc || bio || 'Индивидуальная манера судейства',
      leagues: Array.isArray(leagues) && leagues.length ? leagues : ['rpl', 'cup'],
      rating: Number(rating) || 8.0,
      matches: 0,
      yellows: 0,
      reds: 0,
      penalties: 0,
      bio: bio || 'Арбитр РПЛ и Кубка России.'
    });
  }
  save();
  res.json({ ok: 1 });
});

app.post('/api/admin/fixture/referee', admin, (req, res) => {
  const f = fx(req.body.fid);
  if (!f) return fail(res, 'Матч не найден');
  if (f.comp !== 'rpl' && f.comp !== 'cup') {
    return fail(res, 'Арбитры назначаются только на матчи РПЛ и Кубка России');
  }
  const r = db.referees.find((x: any) => x.id === req.body.refereeId);
  if (!r) return fail(res, 'Судья не найден');

  const tourKey = getFixtureTourKey(f);
  const conflict = (db.fixtures || []).find((x: any) => x.id !== f.id && getFixtureTourKey(x) === tourKey && x.refereeId === r.id);
  if (conflict) {
    return fail(res, `Арбитр ${r.name} уже назначен главным на матч «${tn(conflict.home)} — ${tn(conflict.away)}» в этом туре! Главный арбитр может судить только 1 матч в туре.`);
  }

  f.refereeId = r.id;
  f.refereeName = r.name;
  save();
  res.json({ ok: 1, refereeName: r.name });
});

app.post('/api/admin/referee/portfolio', admin, async (req, res) => {
  const r = db.referees.find((x: any) => x.id === req.body.refereeId);
  if (!r) return fail(res, 'Судья не найден');
  if (hasLLM()) {
    try {
      const sys = 'Ты — опытный футбольный аналитик и инспектор судейства РФС. Пиши развёрнуто, живым профессиональным языком, без канцелярита и банальных ярлыков вроде «сбалансированный» или «ровное судейство».';
      const prompt = `Найди в интернете реальную информацию о российском футбольном арбитре: ${r.name} (город: ${r.city}, лиги: ${(r.leagues || []).join(', ').toUpperCase()}).
Представь этого арбитра так, как будто ты подробно рассказываешь о нём тренеру или спортивному директору перед важным матчем.
Напиши большой, осмысленный и логический рассказ (не менее 15 подробных предложений!) о том, кто этот судья и как именно он судит в реальной жизни:
1. Какой он категории (ФИФА, всероссийская, первая и т.д.), сколько лет судит на профессиональном уровне и сколько примерно матчей отсудил в РПЛ, ФНЛ и Кубке России.
2. Как он контролирует игру: держит ли нить матча в руках или порой теряет контроль, как реагирует на высокий темп и давление трибун.
3. Какая у него планка фолов: даёт ли вести жёсткую силовую борьбу или свистит малейшие контакты, как относится к тактическим фолам в центре поля.
4. Как работает с карточками: часто ли достаёт жёлтые и красные, поспешные ли решения принимает или долго терпит, как наказывает за споры, симуляции и затяжку времени.
5. Как действует в штрафной площади и с ВАР: охотно ли ставит пенальти, любит ли ждать подсказок ВАР у монитора или уверенно решает сам.
6. Какие известные матчи или резонансные эпизоды были в его карьере, и как он общается с игроками и тренерами у бровки.`;
      const bio = await llm(sys, prompt, { json: false, task: 'referee_portfolio', temp: 0.5, max: 2500, grounded: true });
      r.bio = bio.trim();
      save();
      return res.json({ ok: 1, bio: r.bio });
    } catch (e: any) {
      console.error('referee/portfolio:', e.message);
      return fail(res, 'Ошибка генерации портрета: ' + e.message);
    }
  }
  return fail(res, 'Не настроен ключ нейросети для генерации портрета');
});

app.post('/api/admin/referees/assign-round', admin, (req, res) => {
  const { comp, label, round } = req.body || {};
  if (!comp) return fail(res, 'Укажите турнир');
  const matches = seasonFx().filter((f: any) =>
    f.comp === comp &&
    f.status !== 'done' &&
    (label ? f.label === label : (round !== undefined ? String(f.round) === String(round) : true))
  );
  if (!matches.length) return fail(res, 'Нет запланированных матчей в выбранном туре');
  assignTourReferees(matches);
  save();
  res.json({ ok: 1, count: matches.length });
});

function getMediaCupGroups() {
  const mFx = seasonFx().filter((f: any) => f.comp === 'media_cup' && !f.cupStage);
  const groups: Record<string, any[]> = { A: [], B: [], C: [], D: [] };
  for (const gid of ['A', 'B', 'C', 'D']) {
    const gFx = mFx.filter((f: any) => f.group === gid);
    const ids: string[] = [...new Set<string>(gFx.flatMap((f: any) => [f.home, f.away]).filter(Boolean))];
    const R: Record<string, any> = {};
    ids.forEach((id: string) => {
      const tm = team(id);
      R[id] = { id, name: tn(id), logo: teamLogo(id), colors: getTeamColors(tm?.name || ''), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
    });
    for (const f of gFx.filter((x: any) => x.status === 'done')) {
      for (const [tid, gf, ga] of [[f.home, f.hg, f.ag], [f.away, f.ag, f.hg]]) {
        const r = R[tid];
        if (!r) continue;
        r.p++; r.gf += gf; r.ga += ga;
        if (gf > ga) { r.w++; r.pts += 3; r.form.push('В'); }
        else if (gf === ga) { r.d++; r.pts++; r.form.push('Н'); }
        else { r.l++; r.form.push('П'); }
      }
    }
    const rows = Object.values(R).sort((a: any, b: any) => b.pts - a.pts || b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
    rows.forEach((r: any, i: number) => {
      r.pos = i + 1;
      r.gd = r.gf - r.ga;
      r.form = r.form.slice(-5).join('');
      if (r.pos === 1) { r.zone = 'zone-cl'; r.zoneLabel = 'Плей-офф (1/4)'; }
      else if (r.pos === 2 || r.pos === 3) { r.zone = 'zone-el'; r.zoneLabel = 'Стыки'; }
    });
    groups[gid] = rows;
  }
  return groups;
}

function advanceMediaCupPlayoffs() {
  const allMc = seasonFx().filter((f: any) => f.comp === 'media_cup');
  if (!allMc.length) return;
  const groupFx = allMc.filter((f: any) => !f.cupStage);
  if (!groupFx.length || groupFx.some((f: any) => f.status !== 'done')) return;

  const season = S();
  const winnerOf = (f: any) => {
    if (!f || f.status !== 'done') return null;
    if (f.hg > f.ag) return f.home;
    if (f.ag > f.hg) return f.away;
    if (f.penHome != null && f.penAway != null) return f.penHome > f.penAway ? f.home : f.away;
    return f.home;
  };

  // 1. Стыки за плей-офф (2-е и 3-и места)
  let playIn = allMc.filter((f: any) => f.cupStage === 'playin');
  if (!playIn.length) {
    const g = getMediaCupGroups();
    if (g.A.length >= 3 && g.B.length >= 3 && g.C.length >= 3 && g.D.length >= 3) {
      const pairs = [
        { home: g.B[1].id, away: g.C[2].id, label: 'Стыки за плей-офф · Матч 1 (2B — 3C)' },
        { home: g.C[1].id, away: g.D[2].id, label: 'Стыки за плей-офф · Матч 2 (2C — 3D)' },
        { home: g.D[1].id, away: g.A[2].id, label: 'Стыки за плей-офф · Матч 3 (2D — 3A)' },
        { home: g.A[1].id, away: g.B[2].id, label: 'Стыки за плей-офф · Матч 4 (2A — 3B)' },
      ];
      const lastDate = groupFx.map((f: any) => f.date).sort().pop() || '2026-10-01';
      pairs.forEach((p, idx) => {
        db.fixtures.push({
          id: uid(), season, comp: 'media_cup', round: 11, cupStage: 'playin',
          label: p.label, date: addDays(lastDate, 7), time: '19:00',
          home: p.home, away: p.away, status: 'scheduled', hg: null, ag: null, pos: idx + 1
        });
      });
      save();
      playIn = seasonFx().filter((f: any) => f.comp === 'media_cup' && f.cupStage === 'playin');
    }
  }
  if (!playIn.length || playIn.some((f: any) => f.status !== 'done')) return;

  // 2. 1/4 финала (1-е места групп играют с победителями стыков)
  let qf = seasonFx().filter((f: any) => f.comp === 'media_cup' && f.cupStage === 'qf');
  if (!qf.length) {
    const g = getMediaCupGroups();
    const w1 = winnerOf(playIn[0]), w2 = winnerOf(playIn[1]), w3 = winnerOf(playIn[2]), w4 = winnerOf(playIn[3]);
    if (w1 && w2 && w3 && w4) {
      const pairs = [
        { home: g.A[0].id, away: w1, label: '1/4 финала · Матч 1 (1A — Поб. 2B/3C)' },
        { home: g.B[0].id, away: w2, label: '1/4 финала · Матч 2 (1B — Поб. 2C/3D)' },
        { home: g.C[0].id, away: w3, label: '1/4 финала · Матч 3 (1C — Поб. 2D/3A)' },
        { home: g.D[0].id, away: w4, label: '1/4 финала · Матч 4 (1D — Поб. 2A/3B)' },
      ];
      const lastDate = playIn.map((f: any) => f.date).sort().pop() || '2026-10-08';
      pairs.forEach((p, idx) => {
        db.fixtures.push({
          id: uid(), season, comp: 'media_cup', round: 12, cupStage: 'qf',
          label: p.label, date: addDays(lastDate, 7), time: '19:00',
          home: p.home, away: p.away, status: 'scheduled', hg: null, ag: null, pos: idx + 1
        });
      });
      save();
      qf = seasonFx().filter((f: any) => f.comp === 'media_cup' && f.cupStage === 'qf');
    }
  }
  if (!qf.length || qf.some((f: any) => f.status !== 'done')) return;

  // 3. 1/2 финала
  let sf = seasonFx().filter((f: any) => f.comp === 'media_cup' && f.cupStage === 'sf');
  if (!sf.length) {
    const w1 = winnerOf(qf[0]), w2 = winnerOf(qf[1]), w3 = winnerOf(qf[2]), w4 = winnerOf(qf[3]);
    if (w1 && w2 && w3 && w4) {
      const lastDate = qf.map((f: any) => f.date).sort().pop() || '2026-10-15';
      [
        { home: w1, away: w2, label: '1/2 финала · Матч 1' },
        { home: w3, away: w4, label: '1/2 финала · Матч 2' },
      ].forEach((p, idx) => {
        db.fixtures.push({
          id: uid(), season, comp: 'media_cup', round: 13, cupStage: 'sf',
          label: p.label, date: addDays(lastDate, 7), time: '19:00',
          home: p.home, away: p.away, status: 'scheduled', hg: null, ag: null, pos: idx + 1
        });
      });
      save();
      sf = seasonFx().filter((f: any) => f.comp === 'media_cup' && f.cupStage === 'sf');
    }
  }
  if (!sf.length || sf.some((f: any) => f.status !== 'done')) return;

  // 4. Финал
  const fin = seasonFx().filter((f: any) => f.comp === 'media_cup' && f.cupStage === 'final');
  if (!fin.length) {
    const w1 = winnerOf(sf[0]), w2 = winnerOf(sf[1]);
    if (w1 && w2) {
      const lastDate = sf.map((f: any) => f.date).sort().pop() || '2026-10-22';
      db.fixtures.push({
        id: uid(), season, comp: 'media_cup', round: 14, cupStage: 'final',
        label: 'Финал Winline Кубка Лиги', date: addDays(lastDate, 7), time: '20:00',
        home: w1, away: w2, status: 'scheduled', hg: null, ag: null, pos: 1
      });
      save();
    }
  }
}

app.get('/api/media_cup/structure', (req, res) => {
  advanceMediaCupPlayoffs();
  const groups = getMediaCupGroups();
  const allMc = seasonFx().filter((f: any) => f.comp === 'media_cup');
  const enrich = (f: any) => ({
    ...f,
    homeName: tn(f.home),
    awayName: tn(f.away),
    homeLogo: teamLogo(f.home),
    awayLogo: teamLogo(f.away),
  });
  res.json({
    groups,
    playIn: allMc.filter((f: any) => f.cupStage === 'playin').map(enrich),
    quarterfinals: allMc.filter((f: any) => f.cupStage === 'qf').map(enrich),
    semifinals: allMc.filter((f: any) => f.cupStage === 'sf').map(enrich),
    final: allMc.filter((f: any) => f.cupStage === 'final').map(enrich),
  });
});

/* ───────── главные тренеры и тренерский штаб (только админ) ───────── */
app.get('/api/admin/coaches', admin, (req, res) => {
  res.json({
    coaches: (db.staff || []).filter((s: any) => s.role === 'head'),
    staff: db.staff || [],
    roles: STAFF_ROLES
  });
});

app.post('/api/admin/coach', admin, async (req, res) => {
  const { name, role = 'head', teamId = '', age: reqAge, nationality: reqNat, specialty: reqSpec, favoriteFormation = '4-3-3', bio: reqBio, style: reqStyle } = req.body;
  if (!name) return fail(res, 'Укажите ФИО специалиста');
  if (!db.staff) db.staff = [];
  const validRole: StaffRole = ['head', 'assistant', 'gk', 'fitness', 'attack', 'doctor'].includes(role) ? role : 'head';
  const roleMeta = STAFF_ROLES[validRole] || STAFF_ROLES.head;

  let age = Number(reqAge) || 45;
  let nat = reqNat ? String(reqNat).trim() : 'Россия';
  let specialty = reqSpec ? String(reqSpec).trim() : roleMeta.desc;
  let bio = reqBio ? String(reqBio).trim() : '';

  if (hasLLM() && !bio) {
    try {
      const tm = team(teamId);
      const prompt = `Составь профиль футбольного специалиста на должность "${roleMeta.title}" (${name})${tm ? ` в клуб "${tm.name}"` : ''}.
Определи его примерный возраст (число), гражданство (на русском), узкую специализацию (1 предложение) и подробный опыт/биографию (2-3 предложения).
Ответь строго в JSON: { "age": 46, "nat": "Россия", "specialty": "...", "bio": "..." }`;
      const info = await llmJSON('Ты — футбольная спортивная энциклопедия.', prompt, { temp: 0.4, max: 500 });
      if (info.age) age = Number(info.age) || age;
      if (info.nat) nat = String(info.nat);
      if (info.specialty) specialty = String(info.specialty);
      if (info.bio) bio = String(info.bio);
    } catch {}
  }

  const tm = team(teamId);
  const member: StaffMember = {
    id: 'staff_' + uid(),
    name: String(name).trim(),
    role: validRole,
    roleTitle: roleMeta.title,
    teamId: teamId || '',
    teamName: tm ? tm.name : '',
    age,
    nationality: nat,
    specialty,
    favoriteFormation: validRole === 'head' ? (favoriteFormation || '4-3-3') : undefined,
    style: validRole === 'head' ? (reqStyle || 'possession') : undefined,
    styleTitle: validRole === 'head' ? 'Сбалансированный стиль' : undefined,
    bio: bio || `${name} — ${roleMeta.title.toLowerCase()}${tm ? ` клуба «${tm.name}»` : ''}. ${specialty}.`
  };

  db.staff.push(member);
  save();
  res.json({ ok: 1, coach: member, member });
});

app.post('/api/admin/coach/assign', admin, (req, res) => {
  const { coachId, teamId, role } = req.body;
  const c = (db.staff || []).find((x: any) => x.id === coachId);
  if (!c) return fail(res, 'Специалист не найден');
  c.teamId = teamId || '';
  const tm = team(teamId);
  c.teamName = tm ? tm.name : '';
  if (role && ['head', 'assistant', 'gk', 'fitness', 'attack', 'doctor'].includes(role)) {
    c.role = role;
    c.roleTitle = STAFF_ROLES[role as StaffRole]?.title || c.roleTitle;
  }
  save();
  res.json({ ok: 1, coach: c, member: c });
});

app.post('/api/admin/coach/update', admin, (req, res) => {
  const { id, name, role, teamId, age, nationality, specialty, favoriteFormation, bio } = req.body;
  const c = (db.staff || []).find((x: any) => x.id === id);
  if (!c) return fail(res, 'Специалист не найден');
  if (name) c.name = String(name).trim();
  if (role && ['head', 'assistant', 'gk', 'fitness', 'attack', 'doctor'].includes(role)) {
    c.role = role;
    c.roleTitle = STAFF_ROLES[role as StaffRole]?.title || c.roleTitle;
  }
  if (teamId !== undefined) {
    c.teamId = teamId || '';
    const tm = team(teamId);
    c.teamName = tm ? tm.name : '';
  }
  if (age) c.age = Number(age) || c.age;
  if (nationality) c.nationality = String(nationality).trim();
  if (specialty) c.specialty = String(specialty).trim();
  if (favoriteFormation && c.role === 'head') c.favoriteFormation = String(favoriteFormation).trim();
  if (bio) c.bio = String(bio).trim();
  save();
  res.json({ ok: 1, coach: c, member: c });
});

app.post('/api/admin/coach/delete', admin, (req, res) => {
  const { id } = req.body;
  const idx = (db.staff || []).findIndex((x: any) => x.id === id);
  if (idx < 0) return fail(res, 'Специалист не найден');
  db.staff.splice(idx, 1);
  save();
  res.json({ ok: 1 });
});

app.post('/api/admin/club/custom', admin, (req, res) => {
  const { name, city, country } = req.body;
  if (!name) return fail(res, 'Укажите название клуба');
  const nm = String(name).trim();
  const existing = db.teams.find((t: any) => t.name.toLowerCase() === nm.toLowerCase());
  if (existing) return res.json({ ok: 1, team: existing });
  const newTeam = {
    id: 'tm_' + uid(),
    name: nm,
    comp: 'friendly',
    city: String(city || '').trim(),
    country: String(country || '').trim(),
    lat: null,
    lon: null,
    stadium: '',
    logo: getTeamLogo(nm, '', 'friendly'),
    code: Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
  };
  db.teams.push(newTeam);
  save();
  res.json({ ok: 1, team: newTeam });
});

/* ───────── турниры во время зимней и летней паузы ───────── */
app.get('/api/tournaments', (req, res) => {
  res.json({ tournaments: db.tournaments || [] });
});

app.post('/api/admin/tournament', admin, (req, res) => {
  const { name, pauseType, country, city, startDate, teamIds } = req.body;
  if (!name || !country || !city || !startDate) return fail(res, 'Заполните название, страну, город и дату');
  const teams = Array.isArray(teamIds) ? teamIds.filter((id: string) => team(id)) : [];
  if (teams.length < 2) return fail(res, 'Выберите минимум 2 команды');
  const tid = 'trn_' + uid();
  const compId = 'tournament_' + tid;
  const trn = {
    id: tid,
    compId,
    name: String(name).trim(),
    pauseType: pauseType === 'winter' ? 'winter' : 'summer',
    country: String(country).trim(),
    city: String(city).trim(),
    startDate,
    teamIds: teams,
    createdAt: new Date().toISOString()
  };
  db.tournaments.push(trn);

  // Генерируем круговой турнир
  const arr: (string | null)[] = [...teams];
  if (arr.length % 2) arr.push(null);
  const n = arr.length;
  let dayOffset = 0;
  for (let k = 0; k < n - 1; k++) {
    const matchDate = addDays(startDate, dayOffset);
    let slot = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a && b) {
        const fxObj: any = {
          id: uid(),
          season: S(),
          comp: compId,
          round: k + 1,
          date: matchDate,
          time: ['14:00', '17:00', '19:30'][slot % 3],
          home: k % 2 ? b : a,
          away: k % 2 ? a : b,
          status: 'scheduled',
          hg: null,
          ag: null,
          pos: 0,
          tournamentName: trn.name,
          venue: `${trn.city}, ${trn.country}`
        };
        assignReferee(fxObj);
        db.fixtures.push(fxObj);
        slot++;
      }
    }
    arr.splice(1, 0, arr.pop()!);
    dayOffset += 3;
  }
  save();
  res.json({ ok: 1, tournament: trn });
});

app.delete('/api/admin/tournament/:id', admin, (req, res) => {
  const trn = db.tournaments.find((x: any) => x.id === req.params.id);
  if (!trn) return fail(res, 'Турнир не найден');
  db.tournaments = db.tournaments.filter((x: any) => x.id !== req.params.id);
  db.fixtures = db.fixtures.filter((f: any) => f.comp !== trn.compId);
  save();
  res.json({ ok: 1 });
});

/* ───────── прямой трансфер админа (с указанием суммы, сохранением статистики и согласованием РПЛ) ───────── */
app.post('/api/admin/transfer/direct', admin, (req, res) => {
  const { pid, toTeamId, transferType, fee, force } = req.body;
  const p = player(pid);
  const toTeam = team(toTeamId);
  if (!p || !toTeam) return fail(res, 'Игрок или клуб не найден');
  const fromTeamId = p.teamId;
  const fromTeam = team(fromTeamId);

  const feeStr = String(fee || '€5.0M').trim();
  const feeNum = parseFeeAmount(feeStr);
  const loanMap: Record<string, string> = {
    'loan_0.5': 'Аренда (0.5 года)',
    'loan_1': 'Аренда (1 год)',
    'loan_1.5': 'Аренда (1.5 года)',
    'loan_2': 'Аренда (2 года)'
  };
  const isLoan = !!loanMap[transferType];
  const note = loanMap[transferType] || 'Полноценный трансфер';

  const isRplToRpl = fromTeam?.comp === 'rpl' && toTeam?.comp === 'rpl';

  const trObj: any = {
    id: uid(),
    pid: p.id,
    playerName: p.name,
    pos: p.pos || 'ЦП',
    from: fromTeamId || 'free_agent',
    fromName: fromTeam?.name || 'Свободный агент',
    to: toTeamId,
    toName: toTeam.name,
    fee: feeStr,
    feeAmount: feeNum,
    type: isLoan ? 'loan' : 'transfer',
    note,
    status: 'pending',
    isRplToRpl,
    adminApproval: 'approved',
    clubApproval: (isRplToRpl && !force) ? 'pending' : 'approved',
    clubApprovedBy: fromTeamId,
    date: new Date().toISOString().slice(0, 10),
    byAdmin: true
  };

  db.transfers.unshift(trObj);

  if (!isRplToRpl || force) {
    executeTransferIfBothApproved(trObj);
    save();
    return res.json({
      ok: 1,
      executed: true,
      player: p,
      transfer: trObj,
      message: `Трансфер игрока ${p.name} в «${toTeam.name}» (${feeStr}) успешно оформлен.`
    });
  }

  save();
  res.json({
    ok: 1,
    executed: false,
    pendingClub: true,
    transfer: trObj,
    message: `Запрос на ${isLoan ? 'аренду' : 'трансфер'} игрока ${p.name} (${feeStr}) отправлен владельцу «${fromTeam?.name}». Переход состоится при согласии клуба.`
  });
});

/* ───────── Сборная России (паузы, расширенный/итоговый состав, товарищеские матчи, архив) ───────── */
function ensureNationalTeam() {
  db.nationalTeam ||= {
    current: {
      title: 'Ближайшая пауза на матчи сборных',
      stage: 'extended',
      extended: [],
      final: [],
      matches: []
    },
    archive: []
  };
  return db.nationalTeam;
}

function enrichNationalBreak(brk: any) {
  const enrichIds = (ids: string[]) => (ids || []).map((id: string) => {
    const p = player(id);
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      pos: p.pos,
      teamId: p.teamId,
      teamName: tn(p.teamId),
      teamLogo: teamLogo(p.teamId),
      ovr: p.ovr || 70,
      goals: p.goals || 0,
      assists: p.assists || 0,
      matches: p.matches || 0,
      rating: p.rating || 0
    };
  }).filter(Boolean);
  const matches = (brk.matches || []).map((m: any) => ({
    ...m,
    russiaLogo: '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg',
    opponentLogo: teamLogo(m.opponent)
  }));
  return {
    ...brk,
    teamLogo: '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg',
    matches,
    extendedPlayers: enrichIds(brk.extended),
    finalPlayers: enrichIds(brk.final)
  };
}

app.get('/api/national', (req, res) => {
  const nt = ensureNationalTeam();
  const nationalBreaks = (db.internationalBreaks || DEFAULT_INTERNATIONAL_BREAKS).filter((b: any) => b.id.startsWith('ib_'));
  res.json({
    current: enrichNationalBreak(nt.current),
    archive: (nt.archive || []).map(enrichNationalBreak),
    breaks: nationalBreaks
  });
});

app.post('/api/admin/national/generate', admin, async (req, res) => {
  const nt = ensureNationalTeam();
  const stage = req.body.stage === 'final' ? 'final' : 'extended';
  const count = stage === 'final' ? 25 : 40;
  if (req.body.title) nt.current.title = String(req.body.title).trim();

  let pool = db.players.filter((p: any) => !p.nat || p.nat === 'RUS' || p.nat === 'Россия');
  if (stage === 'final' && nt.current.extended?.length >= 25) {
    const extSet = new Set(nt.current.extended);
    pool = pool.filter((p: any) => extSet.has(p.id));
  }

  const sortedPool = [...pool].sort((a: any, b: any) =>
    ((b.rating || 0) * 10 + (b.goals || 0) * 3 + (b.assists || 0) * 2 + (b.ovr || 70) * 0.2) -
    ((a.rating || 0) * 10 + (a.goals || 0) * 3 + (a.assists || 0) * 2 + (a.ovr || 70) * 0.2)
  );

  let chosenIds: string[] = [];
  if (hasLLM() && sortedPool.length > 0) {
    try {
      const candidates = sortedPool.slice(0, 75).map((p: any) =>
        `${p.id}|${p.name}|${p.pos}|${tn(p.teamId)}|OVR:${p.ovr || 70}|М:${p.matches || 0}|Г:${p.goals || 0}|П:${p.assists || 0}|Рейт:${Number(p.rating || 0).toFixed(2)}`
      ).join('\n');
      const sys = 'Ты — главный тренер сборной России по футболу. Выбирай состав строго по позиции (минимум 3 вратаря, 8 защитников, 8 полузащитников, 4 нападающих) и текущей игровой форме/статистике.';
      const prompt = `Сформируй ${stage === 'final' ? 'ИТОГОВЫЙ состав (ровно 25 игроков)' : 'РАСШИРЕННЫЙ состав (ровно 40 игроков)'} сборной России на ближайшую паузу из списка кандидатов:\n${candidates}\n\nВерни JSON: {"ids": ["id1", "id2", ...]}`;
      const raw = await llm(sys, prompt, { json: true, task: 'national_squad', temp: 0.3, max: 2000 });
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.ids)) {
        const validSet = new Set(sortedPool.map((p: any) => p.id));
        chosenIds = parsed.ids.filter((id: string) => validSet.has(id)).slice(0, count);
      }
    } catch (e: any) {
      console.error('national/generate:', e.message);
    }
  }

  if (chosenIds.length < Math.min(count, sortedPool.length)) {
    const have = new Set(chosenIds);
    for (const p of sortedPool) {
      if (!have.has(p.id)) {
        chosenIds.push(p.id);
        have.add(p.id);
        if (chosenIds.length >= count) break;
      }
    }
  }

  nt.current.stage = stage;
  nt.current[stage] = chosenIds;
  save();
  res.json({ ok: 1, current: enrichNationalBreak(nt.current) });
});

app.post('/api/admin/national/squad', admin, (req, res) => {
  const nt = ensureNationalTeam();
  const { action, pid, stage } = req.body;
  const st = stage || nt.current.stage || 'extended';
  nt.current[st] ||= [];
  if (action === 'add' && pid) {
    if (!nt.current[st].includes(pid)) nt.current[st].push(pid);
  } else if (action === 'remove' && pid) {
    nt.current[st] = nt.current[st].filter((id: string) => id !== pid);
  } else if (action === 'stage' && (stage === 'extended' || stage === 'final')) {
    nt.current.stage = stage;
  }
  save();
  res.json({ ok: 1, current: enrichNationalBreak(nt.current) });
});

app.post('/api/admin/national/match', admin, (req, res) => {
  const nt = ensureNationalTeam();
  const { opponent, date, time, home } = req.body;
  if (!opponent) return fail(res, 'Укажите соперника');
  if (!date) return fail(res, 'Укажите дату матча');
  const nationalBreaks = (db.internationalBreaks || DEFAULT_INTERNATIONAL_BREAKS).filter((b: any) => b.id.startsWith('ib_'));
  const isValidDate = nationalBreaks.some((b: any) => date >= b.start && date <= b.end);
  if (!isValidDate) return fail(res, 'Матч сборной может проводиться только в даты официальных пауз на сборные!');

  nt.current.matches ||= [];
  nt.current.matches.push({
    id: uid(),
    opponent: String(opponent).trim(),
    date: date,
    time: time || '19:00',
    home: home !== false
  });
  save();
  res.json({ ok: 1, current: enrichNationalBreak(nt.current) });
});

app.post('/api/admin/national/match/delete', admin, (req, res) => {
  const nt = ensureNationalTeam();
  const matchId = req.body.matchId || req.body.id;
  if (matchId) {
    nt.current.matches = (nt.current.matches || []).filter((m: any) => m.id !== matchId);
    save();
  }
  res.json({ ok: 1, current: enrichNationalBreak(nt.current) });
});

app.post('/api/admin/national/archive', admin, (req, res) => {
  const nt = ensureNationalTeam();
  nt.archive ||= [];
  nt.archive.unshift({
    ...nt.current,
    archivedAt: new Date().toISOString().slice(0, 10)
  });
  nt.current = {
    title: 'Следующая пауза на матчи сборных',
    stage: 'extended',
    extended: [],
    final: [],
    matches: []
  };
  save();
  res.json({ ok: 1 });
});

/* ───────── проверка состава на реализм (ИИ, только админ) ───────── */
app.post('/api/admin/check-squad', admin, async (req, res) => {
  const t = team(req.body.teamId);
  if (!t) return fail(res, 'Клуб не найден');
  const sq = squadOf(t.id);
  if (!sq.length) return res.json({ realistic: true, summary: 'Состав пуст.', flaggedPlayers: [] });

  const squadText = sq.map((p: any) => `${p.name} (${p.pos}, ${p.age || 25} лет, ${p.nat || 'RUS'}, OVR ${p.ovr || 70})`).join('\n');
  if (hasLLM()) {
    try {
      const prompt = `Ты — футбольный скаут и эксперт по российскому футболу. Проверь состав клуба "${t.name}" (лига: ${t.comp.toUpperCase()}) на реализм.
Выяви нереалистичных игроков (например, мировых суперзвёзд уровня Месси, Роналду, Мбаппе в середняках/аутсайдерах РПЛ или ФНЛ, несоответствие уровня лиги, странные имена).
Состав:
${squadText}

Ответь строго в JSON:
{
  "realistic": true/false,
  "summary": "краткий вывод по составу на русском (2-3 предложения)",
  "flaggedPlayers": [
    { "name": "Имя игрока", "reason": "почему нереалистично", "suggestion": "кем заменить или что исправить" }
  ]
}`;
      const r = await llmJSON('Ты — строгий футбольный эксперт по реализму составов.', prompt, { temp: 0.3, max: 2000 });
      return res.json({
        realistic: !!r.realistic,
        summary: r.summary || 'Проверка завершена.',
        flaggedPlayers: Array.isArray(r.flaggedPlayers) ? r.flaggedPlayers : []
      });
    } catch (e: any) {
      console.error('check-squad:', e.message);
    }
  }
  // Fallback без LLM
  const stars = ['месси', 'messi', 'роналду', 'ronaldo', 'мбаппе', 'mbappe', 'холанд', 'haaland', 'неймар', 'neymar', 'винициус', 'vinicius', 'беллингем', 'bellingham'];
  const flagged = sq.filter((p: any) => stars.some(s => String(p.name || '').toLowerCase().includes(s))).map((p: any) => ({
    name: p.name,
    reason: `Игрок мирового уровня (${p.name}) нереалистичен для клуба ${t.name}`,
    suggestion: 'Заменить на игрока уровня РПЛ/ФНЛ'
  }));
  res.json({
    realistic: flagged.length === 0,
    summary: flagged.length ? `Обнаружено ${flagged.length} нереалистичных игроков в составе ${t.name}.` : `Состав клуба ${t.name} выглядит реалистично.`,
    flaggedPlayers: flagged
  });
});

/* ───────── заявки на трансфер от клубов (группировка по клубу + ИИ-поиск и проверка) ───────── */
app.post('/api/club/transfer-request', needClub, async (req: any, res) => {
  const { playerName, fee } = req.body;
  if (!playerName) return fail(res, 'Укажите полностью ФИО игрока');
  let pos = 'ЦП', age = 24, nationality = 'Иностранец', fromClub = 'Зарубежный клуб';
  if (hasLLM()) {
    try {
      const prompt = `Найди информацию о футболисте "${playerName}". Определи его основную позицию на поле (одна из: ВР, ЦЗ, ЛЗ, ПЗ, ОП, ЦП, АП, ЛВ, ПВ, ЦФ), текущий возраст (число), гражданство (на русском) и текущий/последний клуб.
Ответь строго в JSON: { "pos": "ЦП", "age": 25, "nationality": "Бразилия", "fromClub": "Фламенго" }`;
      const info = await llmJSON('Ты — футбольная база данных.', prompt, { temp: 0.2, max: 300 });
      if (info.pos) pos = String(info.pos);
      if (info.age) age = Number(info.age) || 24;
      if (info.nationality) nationality = String(info.nationality);
      if (info.fromClub) fromClub = String(info.fromClub);
    } catch {}
  }
  const reqObj = {
    id: 'trq_' + uid(),
    clubId: req.me.teamId,
    playerName: String(playerName).trim(),
    pos,
    age,
    nationality,
    fromClub,
    fee: String(fee || 'По согласованию').trim(),
    status: 'pending',
    aiVerdict: null as any,
    createdAt: new Date().toISOString()
  };
  db.transferRequests.unshift(reqObj);
  save();
  res.json({ ok: 1, request: reqObj });
});

app.get('/api/club/transfer-requests', needClub, (req: any, res) => {
  const list = (db.transferRequests || []).filter((r: any) => r.clubId === req.me.teamId);
  res.json({ requests: list });
});

app.get('/api/admin/transfer-requests', admin, (req, res) => {
  const byClub: Record<string, any> = {};
  for (const r of (db.transferRequests || [])) {
    if (!byClub[r.clubId]) {
      const t = team(r.clubId);
      byClub[r.clubId] = {
        clubId: r.clubId,
        clubName: t?.name || r.clubId,
        clubLogo: teamLogo(r.clubId),
        comp: t?.comp || 'rpl',
        requests: []
      };
    }
    byClub[r.clubId].requests.push(r);
  }
  res.json({ groups: Object.values(byClub) });
});

app.post('/api/admin/transfer-requests/check-ai', admin, async (req, res) => {
  const { clubId } = req.body;
  const t = team(clubId);
  if (!t) return fail(res, 'Клуб не найден');
  const pending = (db.transferRequests || []).filter((r: any) => r.clubId === clubId && r.status === 'pending');
  if (!pending.length) return fail(res, 'Нет активных заявок от этого клуба');

  const reqText = pending.map((r: any, i: number) => `${i + 1}. ${r.playerName} (${r.pos}, ${r.age} лет, ${r.nationality}, из клуба "${r.fromClub}", сумма: ${r.fee})`).join('\n');
  if (hasLLM()) {
    try {
      const prompt = `Ты — футбольный директор и эксперт по трансферам. Клуб "${t.name}" (лига: ${t.comp.toUpperCase()}) подал заявки на трансферы игроков из-за рубежа:
${reqText}

Оцени реалистичность и возможность каждого трансфера для этого клуба (учитывая статус клуба, лигу, финансы и уровень игрока).
Ответь строго в JSON:
{
  "overallVerdict": "общий вывод по трансферной кампании клуба (2-3 предложения)",
  "results": [
    { "index": 1, "playerName": "Имя", "realistic": true/false, "verdict": "Реалистично" или "Нереалистично", "reason": "краткое объяснение" }
  ]
}`;
      const r = await llmJSON('Ты — эксперт по футбольным трансферам.', prompt, { temp: 0.3, max: 2000 });
      const results = Array.isArray(r.results) ? r.results : [];
      pending.forEach((pReq: any, idx: number) => {
        const match = results.find((x: any) => x.index === idx + 1 || x.playerName === pReq.playerName);
        if (match) {
          pReq.aiVerdict = { realistic: !!match.realistic, verdict: match.verdict, reason: match.reason };
        }
      });
      save();
      return res.json({ clubId, overallVerdict: r.overallVerdict || 'Проверка завершена.', results });
    } catch (e: any) {
      console.error('transfer-check-ai:', e.message);
    }
  }
  // Fallback без LLM
  const results = pending.map((pReq: any, idx: number) => {
    const isSuperstar = /месси|messi|роналду|ronaldo|мбаппе|mbappe|холанд|haaland/i.test(pReq.playerName);
    const v = {
      realistic: !isSuperstar,
      verdict: isSuperstar ? 'Нереалистично' : 'Реалистично',
      reason: isSuperstar ? `Трансфер ${pReq.playerName} в ${t.name} невозможен по финансовым и спортивным причинам.` : `Трансфер ${pReq.playerName} соответствует уровню клуба ${t.name}.`
    };
    pReq.aiVerdict = v;
    return { index: idx + 1, playerName: pReq.playerName, ...v };
  });
  save();
  res.json({ clubId, overallVerdict: `Проверено заявок: ${pending.length}.`, results });
});

app.post('/api/admin/transfer-requests/resolve', admin, (req, res) => {
  const { requestId, action } = req.body;
  const r = (db.transferRequests || []).find((x: any) => x.id === requestId);
  if (!r || r.status !== 'pending') return fail(res, 'Заявка не найдена');
  if (action === 'approve') {
    r.status = 'approved';
    const newPlayer = {
      id: 'p_' + uid(),
      name: r.playerName,
      pos: r.pos,
      age: r.age,
      nat: r.nationality,
      teamId: r.clubId,
      ovr: 74,
      goals: 0,
      assists: 0,
      matches: 0,
      yellowCards: 0,
      redCards: 0,
      saves: 0,
      tackles: 0,
      shots: 0,
      xg: 0,
      cleanSheets: 0,
      rating: 7.0,
      seasonYC: 0,
      banLeft: 0
    };
    db.players.push(newPlayer);
    db.squads[r.clubId] = [...new Set([...squadOf(r.clubId).map((x: any) => x.id), newPlayer.id])];
  } else {
    r.status = 'rejected';
  }
  save();
  res.json({ ok: 1 });
});

function syncRplFridaySchedules() {
  const rplCupDates = new Set(
    (db.fixtures || []).filter((f: any) => f.comp === 'cup' && f.cupPath === 'rpl_group').map((f: any) => f.date)
  );
  const rplFx = (db.fixtures || []).filter((f: any) => f.comp === 'rpl' && f.status !== 'done');
  const byRound: Record<number, any[]> = {};
  rplFx.forEach((f: any) => {
    byRound[f.round] = byRound[f.round] || [];
    byRound[f.round].push(f);
  });
  let changed = false;
  for (const [rStr, list] of Object.entries(byRound)) {
    const ri = Number(rStr) - 1;
    if (!list || list.length < 8) continue;
    let sat = list.map((f: any) => f.date).find((d: string) => new Date(d + 'T12:00:00Z').getUTCDay() === 6);
    if (!sat) {
      const d0 = list[0].date;
      const day = new Date(d0 + 'T12:00:00Z').getUTCDay();
      sat = addDays(d0, (6 - day + 7) % 7);
    }
    const tue = addDays(sat, -4), wed = addDays(sat, -3), thu = addDays(sat, -2);
    const hasRplCup = rplCupDates.has(tue) || rplCupDates.has(wed) || rplCupDates.has(thu);

    if (!hasRplCup) {
      // Без кубка Пути РПЛ на неделе: первый матч — в пятницу, суббота 3-4, воскресенье 4-3
      const satCount = (ri % 2 === 0) ? 3 : 4;
      list.forEach((f: any, mi: number) => {
        let newDate = sat, newTime = '16:30';
        if (mi === 0) {
          newDate = addDays(sat, -1);
          newTime = '19:00';
        } else if (mi <= satCount) {
          newDate = sat;
          const times = satCount === 3 ? ['14:00', '16:30', '19:00'] : ['13:00', '15:15', '17:30', '20:00'];
          newTime = times[(mi - 1) % times.length];
        } else {
          newDate = addDays(sat, 1);
          const sunTimes = satCount === 3 ? ['14:00', '16:30', '19:00', '21:00'] : ['14:00', '16:30', '19:00'];
          newTime = sunTimes[(mi - 1 - satCount) % sunTimes.length];
        }
        if (f.date !== newDate || f.time !== newTime) {
          f.date = newDate;
          f.time = newTime;
          changed = true;
        }
      });
    } else {
      // Есть кубок Пути РПЛ на неделе: с субботы, воскресенье, понедельник
      list.forEach((f: any, mi: number) => {
        let newDate = sat, newTime = '16:30';
        if (mi < 3) {
          newDate = sat;
          newTime = ['14:00', '16:30', '19:00'][mi];
        } else if (mi < 7) {
          newDate = addDays(sat, 1);
          newTime = ['14:00', '16:30', '19:00', '21:00'][mi - 3];
        } else {
          newDate = addDays(sat, 2);
          newTime = '19:30';
        }
        if (f.date !== newDate || f.time !== newTime) {
          f.date = newDate;
          f.time = newTime;
          changed = true;
        }
      });
    }
  }
  if (changed) save();
}

syncRplFridaySchedules();
ensureDualTimes();
invalidateAgg();
resumeLive();

setInterval(() => {
  if (!db.settings.auto) return;
  const now = new Date();
  const allSeason = seasonFx();

  // Strict rule for RPL and Russian Cup:
  // "А также если я хочу чтобы матчи сами автоматически игрались по достижению времени реального - 
  // это касается не только, но и кубка России. Это действует только на кубок России и рпл, 
  // получается если идет рпл, то в этот день только рпл, если наступило время кубка России, 
  // то идет кубок России, мы двигаемся строго по расписанию виртуального времени."
  const rplAndCupDue = allSeason.filter((f: any) => {
    if (f.status !== 'scheduled') return false;
    if (f.comp !== 'rpl' && f.comp !== 'cup' && f.comp !== 'supercup') return false;
    return realAt(f) <= now;
  });

  const othersDue = allSeason.filter((f: any) => {
    if (f.status !== 'scheduled') return false;
    if (f.comp === 'rpl' || f.comp === 'cup' || f.comp === 'supercup') return false;
    const matchTime = f.realDate && f.realTime ? realAt(f) : at(f);
    return matchTime <= now;
  });

  const due = [...rplAndCupDue, ...othersDue];
  if (due.length) {
    runBatch(due).catch(console.error);
  }
}, 30000);

process.on('SIGINT', () => { saveNow(); process.exit(0); });
process.on('SIGTERM', () => { saveNow(); process.exit(0); });

// Сервинг фронтенда: в dev через Vite middlewares, в prod через статику
async function startServer() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'))) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch {
      app.use(express.static(path.join(__dirname, 'public')));
      app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Вирт РПЛ запущен: http://localhost:${PORT}`);
    console.log(`Код администратора: ${process.env.ADMIN_CODE || db.settings.adminCode}`);
    if (!hasLLM()) {
      console.log('Ключей нейросети нет — симуляция работает на запасном генераторе. Добавьте ключ в настройках админки или через переменные окружения.');
    }
  });
}

// Запускаем сервер если запускается напрямую
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { db };
