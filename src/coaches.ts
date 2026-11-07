/**
 * Тренерский штаб, стили и тактическая синергия клубов
 * Реализует влияние философии тренера на игру команды:
 * - bus: «Автобус / Низкий блок» (упор на дисциплину, отборы, сухие матчи)
 * - counter: «Быстрые кинжальные контратаки» (компактность, взрывные выпады)
 * - possession: «Контроль мяча / Доминирование» (короткий пас, комбинации)
 * - attack: «Тотальная атака / Атакующий футбол» (высокий темп, фланги, много ударов и xG)
 * - press: «Высокий интенсивный прессинг» (Gegenpressing, отборы на чужой половине)
 */

export type CoachStyle = 'bus' | 'counter' | 'possession' | 'attack' | 'press';

export interface Coach {
  id: string;
  name: string;
  clubName: string;
  nationality: string;
  age: number;
  style: CoachStyle;
  styleTitle: string;
  styleDesc: string;
  favoriteFormation: string;
  reputation: number; // 50-99
  temperament: string;
  quote: string;
}

export interface CoachSynergy {
  score: number; // 0-100
  status: 'excellent' | 'good' | 'neutral' | 'poor' | 'clash';
  statusTitle: string;
  statusBadgeClass: string;
  xgMultiplier: number;
  xgaMultiplier: number;
  defenseBonus: number;
  tackleBonus: number;
  foulModifier: number;
  description: string;
}

export const COACH_STYLES_INFO: Record<CoachStyle, { title: string; desc: string; favoredFormations: string[] }> = {
  bus: {
    title: '«Автобус» (Глухая оборона и низкий блок)',
    desc: 'Предельная дисциплина у своей штрафной, ставка на сухие матчи, стандарты и минимизацию ошибок.',
    favoredFormations: ['5-3-2', '5-4-1', '4-5-1', '4-4-2']
  },
  counter: {
    title: 'Быстрые контратаки',
    desc: 'Компактная средняя линия, перехваты мяча и мгновенные кинжальные выпады через скоростных вингеров.',
    favoredFormations: ['4-3-3', '3-5-2', '4-2-3-1', '4-4-2']
  },
  possession: {
    title: 'Контроль мяча и позиционная игра',
    desc: 'Доминирование во владении, методичное расшатывание обороны коротким пасом и треугольниками.',
    favoredFormations: ['4-3-3', '4-2-3-1', '3-4-3', '4-1-4-1']
  },
  attack: {
    title: 'Тотальный атакующий футбол',
    desc: 'Высочайший темп, подключение крайних защитников, масса ударов по воротам и высокий xG.',
    favoredFormations: ['4-3-3', '3-4-3', '4-2-4', '4-2-3-1']
  },
  press: {
    title: 'Высокий интенсивный прессинг',
    desc: 'Агрессивный отбор на чужой трети поля, постоянное давление и физическое подавление соперника.',
    favoredFormations: ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2']
  }
};

/**
 * База главных тренеров клубов России
 */
export const DEFAULT_COACHES: Record<string, Coach> = {
  // РПЛ
  'зенит': {
    id: 'semak',
    name: 'Сергей Семак',
    clubName: 'Зенит',
    nationality: 'Россия',
    age: 50,
    style: 'possession',
    styleTitle: 'Контроль мяча и доминирование',
    styleDesc: 'Сбалансированный позиционный футбол с контролем темпа и индивидуальным классом лидеров.',
    favoriteFormation: '4-3-3',
    reputation: 92,
    temperament: 'Спокойный, рассудительный прагматик',
    quote: '«Главное — баланс между атакой и обороной, в каждом матче нужно играть с позиции силы».'
  },
  'краснодар': {
    id: 'musaev',
    name: 'Мурад Мусаев',
    clubName: 'Краснодар',
    nationality: 'Россия',
    age: 43,
    style: 'attack',
    styleTitle: 'Доминирующая эстетичная атака',
    styleDesc: 'Красивый комбинационный футбол Галицкого — быстрый выход из обороны, умный пас и давление.',
    favoriteFormation: '4-3-3',
    reputation: 86,
    temperament: 'Эмоциональный, нацеленный на атаку романтик',
    quote: '«Мы играем для зрителей — футбол должен быть ярким, смелым и результативным».'
  },
  'локомотив': {
    id: 'galaktionov',
    name: 'Михаил Галактионов',
    clubName: 'Локомотив',
    nationality: 'Россия',
    age: 42,
    style: 'press',
    styleTitle: 'Молодёжный скоростной прессинг',
    styleDesc: 'Высокая интенсивность, доверие молодым российским талантам, динамика и вертикализация.',
    favoriteFormation: '4-2-3-1',
    reputation: 85,
    temperament: 'Энергичный методист-мотиватор',
    quote: '«Дисциплина, движение и самоотдача — молодые парни должны бежать вперёд все 90 минут».'
  },
  'спартак': {
    id: 'stankovic',
    name: 'Деян Станкович',
    clubName: 'Спартак',
    nationality: 'Сербия',
    age: 48,
    style: 'attack',
    styleTitle: 'Страстная эмоциональная атака',
    styleDesc: 'Агрессивный, напористый футбол с высоким индивидуальным прессингом и заряженностью на борьбу.',
    favoriteFormation: '4-3-3',
    reputation: 88,
    temperament: 'Бурный лидер с менталитетом победителя',
    quote: '«В "Спартаке" нужно отдавать сердце на поле. Ни шагу назад, только победа!».'
  },
  'цска': {
    id: 'nikolic',
    name: 'Марко Николич',
    clubName: 'ЦСКА',
    nationality: 'Сербия',
    age: 47,
    style: 'counter',
    styleTitle: 'Организованный прагматичный контр-атакующий стиль',
    styleDesc: 'Плотные линии обороны, отточенные стандарты и мгновенный переход из обороны в атаку.',
    favoriteFormation: '3-5-2',
    reputation: 87,
    temperament: 'Холоднокровный тактический аналитик',
    quote: '«Трофеи выигрывает оборона и железная дисциплина на каждом участке газона».'
  },
  'динамо': {
    id: 'lichka',
    name: 'Марцел Личка',
    clubName: 'Динамо',
    nationality: 'Чехия',
    age: 49,
    style: 'attack',
    styleTitle: 'Открытый бесшабашный тотальный футбол',
    styleDesc: 'Атака без оглядки на свои ворота, высокий темп, изобилие голевых моментов и риск.',
    favoriteFormation: '4-3-3',
    reputation: 85,
    temperament: 'Искренний, смелый и открытый душевный тренер',
    quote: '«Лучше победить 4:3, чем тоскливо сыграть 0:0. Футбол существует ради забитых мячей!».'
  },
  'ростов': {
    id: 'karpin',
    name: 'Валерий Карпин',
    clubName: 'Ростов',
    nationality: 'Россия',
    age: 57,
    style: 'press',
    styleTitle: 'Агрессивный прессинг и выход через короткий пас',
    styleDesc: 'Розыгрыш от своих ворот любой ценой, удушающий прессинг на половине соперника.',
    favoriteFormation: '4-3-3',
    reputation: 89,
    temperament: 'Харизматичный, резкий и бескомпромиссный',
    quote: '«Играйте в футбол, а не бейте мяч куда попало! Ошибся — исправь и продолжай играть».'
  },
  'рубин': {
    id: 'rakhimov',
    name: 'Рашид Рахимов',
    clubName: 'Рубин',
    nationality: 'Россия',
    age: 61,
    style: 'bus',
    styleTitle: 'Казанский оборонительный бастион',
    styleDesc: 'Эшелонированная оборона, плотная опека, силовая борьба и максимальная реализация стандартов.',
    favoriteFormation: '5-3-2',
    reputation: 83,
    temperament: 'Строгий тактический диктатор',
    quote: '«Сначала закроем свои ворота на замок, а впереди свой шанс мы обязательно найдём».'
  },
  'ахмат': {
    id: 'tashuev',
    name: 'Сергей Ташуев',
    clubName: 'Ахмат',
    nationality: 'Россия',
    age: 67,
    style: 'press',
    styleTitle: 'Вертикальный интенсивный силовой прессинг',
    styleDesc: 'Жесткие единоборства, вертикальные передачи в свободные зоны и мощное давление.',
    favoriteFormation: '4-2-3-1',
    reputation: 81,
    temperament: 'Опытный тренер старой закалки',
    quote: '«Нам нужна максимальная плотность и единоборства. Футбол не прощает мягкости».'
  },
  'крылья советов': {
    id: 'osinkin',
    name: 'Игорь Осинькин',
    clubName: 'Крылья Советов',
    nationality: 'Россия',
    age: 60,
    style: 'possession',
    styleTitle: 'Умный позиционный комбинационный футбол',
    styleDesc: 'Тонкая игра в пас, развитие молодых талантов, умные перемещения между линиями.',
    favoriteFormation: '4-2-3-1',
    reputation: 84,
    temperament: 'Мудрый футбольный учитель и тактик',
    quote: '«Мяч двигается быстрее любого игрока. Научитесь мыслить на шаг быстрее соперника».'
  },
  'балтика': {
    id: 'talalaev',
    name: 'Андрей Талалаев',
    clubName: 'Балтика',
    nationality: 'Россия',
    age: 53,
    style: 'press',
    styleTitle: 'Тотальный прессинг и бешеная самоотдача',
    styleDesc: 'Физическая мощь, агрессивный отбор мяча, высокая линия обороны и стремительные фланги.',
    favoriteFormation: '4-3-3',
    reputation: 84,
    temperament: 'Взрывной мотиватор с железными требованиями',
    quote: '«Если соперник владеет мячом больше трёх секунд — мы недоработали. Прессинг до свистка!».'
  },
  'оренбург': {
    id: 'deogracia',
    name: 'Давид Деограсия',
    clubName: 'Оренбург',
    nationality: 'Испания',
    age: 52,
    style: 'possession',
    styleTitle: 'Испанский позиционный комбинационный стиль',
    styleDesc: 'Техничный футбол, короткие стенки, подключение инсайдов и розыгрыш лишнего игрока.',
    favoriteFormation: '4-3-3',
    reputation: 79,
    temperament: 'Тактичный европейский методист',
    quote: '«Владея мячом, мы контролируем ход игры и снижаем опасность у своих ворот».'
  },
  'акрон': {
    id: 'tedeev',
    name: 'Заур Тедеев',
    clubName: 'Акрон',
    nationality: 'Россия',
    age: 44,
    style: 'attack',
    styleTitle: 'Дерзкий атакующий футбол без авторитетов',
    styleDesc: 'Смелая игра первым номером, ставка на креативных форвардов (Дзюба) и фланговые подачи.',
    favoriteFormation: '4-3-3',
    reputation: 80,
    temperament: 'Смелый, амбициозный новатор',
    quote: '«Неважно, кто против нас — мы приехали играть в футбол и забивать голы».'
  },
  'динамо махачкала': {
    id: 'bidzhiev',
    name: 'Хасанби Биджиев',
    clubName: 'Динамо Махачкала',
    nationality: 'Россия',
    age: 59,
    style: 'bus',
    styleTitle: 'Дагестанский монолитный железобетон',
    styleDesc: 'Непроходимый низкий блок, самоотверженные подкаты, жесткий отбор и минимум пропущенных мячей.',
    favoriteFormation: '5-3-2',
    reputation: 81,
    temperament: 'Невозмутимый кавказский стратег',
    quote: '«Сломать наш характер невозможно. Каждый метр поля будет стоить сопернику крови».'
  },
  'факел': {
    id: 'pyatibratov',
    name: 'Дмитрий Пятибратов',
    clubName: 'Факел',
    nationality: 'Россия',
    age: 49,
    style: 'bus',
    styleTitle: 'Огненный воронежский бойцовский футбол',
    styleDesc: 'Силовая борьба, выгрызание мяча, верховые дуэли и бешеная энергетика воронежских трибун.',
    favoriteFormation: '5-3-2',
    reputation: 80,
    temperament: 'Страстный народный боец',
    quote: '«В Воронеже никому не будет легко. Мы выходим сражаться за наш город и болельщиков».'
  },
  'родина': {
    id: 'sokolinskiy',
    name: 'Филипп Соколинский',
    clubName: 'Родина',
    nationality: 'Россия',
    age: 39,
    style: 'possession',
    styleTitle: 'Современный комбинационный позиционный футбол',
    styleDesc: 'Техничные полузащитники, поиск свободных зон, быстрый пас низом и компактность.',
    favoriteFormation: '4-3-3',
    reputation: 77,
    temperament: 'Молодой прогрессивный тактик',
    quote: '«Умное движение без мяча создает пространство для голевого удара».'
  },

  // Первая лига и Вторая лига (ключевые наставники)
  'арсенал': {
    id: 'storozhuk',
    name: 'Александр Сторожук',
    clubName: 'Арсенал Тула',
    nationality: 'Россия',
    age: 44,
    style: 'counter',
    styleTitle: 'Быстрые тульские контратаки',
    styleDesc: 'Организованная оборона и быстрый разгон атак через фланги.',
    favoriteFormation: '4-2-3-1',
    reputation: 79,
    temperament: 'Спокойный требовательный специалист',
    quote: '«Каждая ошибка соперника должна превращаться в голевой момент».'
  },
  'торпедо': {
    id: 'kononov',
    name: 'Олег Кононов',
    clubName: 'Торпедо Москва',
    nationality: 'Беларусь',
    age: 59,
    style: 'possession',
    styleTitle: 'Романтический комбинационный спартаковский пас',
    styleDesc: 'Стеночки, забегания, контроль мяча в финальной трети поля.',
    favoriteFormation: '4-3-3',
    reputation: 81,
    temperament: 'Интеллигентный романтик футбола',
    quote: '«Футбол должен приносить эстетическое удовольствие».'
  },
  'урал': {
    id: 'averianov',
    name: 'Евгений Аверьянов',
    clubName: 'Урал',
    nationality: 'Россия',
    age: 47,
    style: 'press',
    styleTitle: 'Уральский силовой характер и прессинг',
    styleDesc: 'Плотный прессинг, фланговые подачи, силовое давление в штрафной.',
    favoriteFormation: '4-2-3-1',
    reputation: 77,
    temperament: 'Уральский боец и воспитанник клуба',
    quote: '«Урал всегда славился характером, мы вернемся в Премьер-Лигу».'
  },
  'сочи': {
    id: 'moreno',
    name: 'Роберт Морено',
    clubName: 'Сочи',
    nationality: 'Испания',
    age: 48,
    style: 'possession',
    styleTitle: 'Испанская тики-така и позиционное доминирование',
    styleDesc: 'Тотальный контроль мяча, геометрия паса, экс-наставник сборной Испании.',
    favoriteFormation: '4-3-3',
    reputation: 85,
    temperament: 'Педантичный европейский профессор тактики',
    quote: '«Без владения мячом невозможно контролировать результат».'
  },
  'пари нн': {
    id: 'goncharenko',
    name: 'Виктор Гончаренко',
    clubName: 'Пари НН',
    nationality: 'Беларусь',
    age: 49,
    style: 'counter',
    styleTitle: 'Тактическая гибкость и резкие контратаки',
    styleDesc: 'Адаптация под соперника, дисциплинированный блок и кинжальные контрвыпады.',
    favoriteFormation: '3-5-2',
    reputation: 84,
    temperament: 'Эмоциональный тактический мастер',
    quote: '«Нужно уметь терпеть и наказывать соперника за малейшую расслабленность».'
  },
  'ротор': {
    id: 'boyarintsev',
    name: 'Денис Бояринцев',
    clubName: 'Ротор',
    nationality: 'Россия',
    age: 47,
    style: 'counter',
    styleTitle: 'Волгоградский бойцовский дух и быстрый фланг',
    styleDesc: 'Бескомпромиссная борьба, ярость на флангах, голы на последних минутах.',
    favoriteFormation: '4-4-2',
    reputation: 77,
    temperament: 'Легендарный спартаковский боец-заводила',
    quote: '«Играть до последней секунды компенсированного времени!».'
  },
  'амкар': {
    id: 'bobrov',
    name: 'Андрей Бобров',
    clubName: 'Амкар Пермь',
    nationality: 'Россия',
    age: 46,
    style: 'bus',
    styleTitle: 'Пермский неуступчивый блок',
    styleDesc: 'Фирменная пермская жесткость, строгая оборона и реализация стандартов.',
    favoriteFormation: '5-3-2',
    reputation: 75,
    temperament: 'Уральский суровый наставник',
    quote: '«Амкар никогда не сдавался без боя на домашнем поле».'
  },

  // Медиалига
  '2drots': {
    id: 'kuznetsov',
    name: 'Дмитрий Кузнецов',
    clubName: '2DROTS',
    nationality: 'Россия',
    age: 60,
    style: 'press',
    styleTitle: 'Профессиональный чемпионский прессинг «самураев»',
    styleDesc: 'Легенда ЦСКА и Эспаньола, ставит дисциплину профи-уровня с мощнейшим прессингом.',
    favoriteFormation: '4-3-3',
    reputation: 87,
    temperament: 'Харизматичный строгий мэтр медиафутбола',
    quote: '«В медиафутболе побеждает тот, кто пашет как профессионал».'
  },
  'амкал': {
    id: 'panov',
    name: 'Виталий Панов',
    clubName: 'Амкал',
    nationality: 'Россия',
    age: 46,
    style: 'attack',
    styleTitle: 'Быстрый комбинационный медийный штурм',
    styleDesc: 'Яркая открытая игра, прессинг, смелые подключения крайних защитников.',
    favoriteFormation: '4-3-3',
    reputation: 83,
    temperament: 'Современный энергичный тактик',
    quote: '«"Амкал" обязан играть в атаку и радовать миллионы болельщиков».'
  },
  'броук бойз': {
    id: 'soslan',
    name: 'Сослан Гатагов',
    clubName: 'Broke Boys',
    nationality: 'Россия',
    age: 33,
    style: 'possession',
    styleTitle: 'Техничный позиционный футбол броуков',
    styleDesc: 'Умный контроль мяча, техника ветеранов РПЛ и нестандартные решения.',
    favoriteFormation: '4-3-3',
    reputation: 81,
    temperament: 'Креативный медийный лидер',
    quote: '«Броуки играют красиво и доказывают класс на поле».'
  },
  'чисто питер': {
    id: 'radimov',
    name: 'Владислав Радимов',
    clubName: 'Чисто Питер',
    nationality: 'Россия',
    age: 50,
    style: 'possession',
    styleTitle: 'Петербургский умный футбол в пас',
    styleDesc: 'Интеллектуальная игра в центре поля, зенитовский дух и контроль.',
    favoriteFormation: '4-3-3',
    reputation: 84,
    temperament: 'Острый на язык легендарный капитан',
    quote: '«В футбол играют головой, а ноги только помогают».'
  }
};

/**
 * Получить тренера для команды по имени или сгенерировать подходящего
 */
export function getTeamCoach(teamName: string, compId: string = 'rpl'): Coach {
  const normName = (teamName || '').toLowerCase().trim();

  for (const [k, c] of Object.entries(DEFAULT_COACHES)) {
    if (normName.includes(k) || k.includes(normName)) {
      return { ...c, clubName: teamName };
    }
  }

  // Генератор для остальных клубов в зависимости от дивизиона
  const styles: CoachStyle[] = compId === 'rpl'
    ? ['possession', 'attack', 'press', 'counter']
    : (compId === 'media' ? ['attack', 'press', 'counter'] : ['bus', 'counter', 'press']);

  const hash = normName.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const pickedStyle = styles[hash % styles.length];
  const info = COACH_STYLES_INFO[pickedStyle];

  const firstNames = ['Александр', 'Сергей', 'Дмитрий', 'Андрей', 'Владимир', 'Игорь', 'Олег', 'Михаил', 'Евгений', 'Валерий'];
  const lastNames = ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Морозов', 'Новиков', 'Фёдоров'];
  const fn = firstNames[hash % firstNames.length];
  const ln = lastNames[(hash * 7) % lastNames.length];

  return {
    id: `coach_${hash}`,
    name: `${fn} ${ln}`,
    clubName: teamName,
    nationality: 'Россия',
    age: 40 + (hash % 25),
    style: pickedStyle,
    styleTitle: info.title,
    styleDesc: info.desc,
    favoriteFormation: info.favoredFormations[0] || '4-3-3',
    reputation: compId === 'rpl' ? 75 + (hash % 15) : 65 + (hash % 18),
    temperament: 'Дисциплинированный наставник',
    quote: '«Только командная работа и выполнение установки принесут результат».'
  };
}

/**
 * Рассчитать тактическую синергию между тренером и тактикой команды
 */
export function computeCoachSynergy(coach: Coach, tactics: any): CoachSynergy {
  const coachStyle = coach.style;
  const teamFormation = (tactics?.formation || '4-3-3').trim();
  const teamSpeech = (tactics?.speech || '').toLowerCase();
  const teamTraining = (tactics?.training || '').toLowerCase();

  // Определяем вектор установки команды
  let teamOrientation: 'bus' | 'counter' | 'possession' | 'attack' | 'press' | 'balanced' = 'balanced';

  if (teamSpeech.includes('автобус') || teamSpeech.includes('глухая оборона') || teamSpeech.includes('бетон') || teamSpeech.includes('на ноль') || teamTraining.includes('оборон')) {
    teamOrientation = 'bus';
  } else if (teamSpeech.includes('контратак') || teamSpeech.includes('вторым номером') || teamSpeech.includes('ловить на ошибк') || teamTraining.includes('контратак')) {
    teamOrientation = 'counter';
  } else if (teamSpeech.includes('прессинг') || teamSpeech.includes('душить') || teamSpeech.includes('давить') || teamSpeech.includes('высоко встречать') || teamTraining.includes('прессинг')) {
    teamOrientation = 'press';
  } else if (teamSpeech.includes('владение') || teamSpeech.includes('контрол') || teamSpeech.includes('пас') || teamSpeech.includes('не спешить') || teamTraining.includes('пас')) {
    teamOrientation = 'possession';
  } else if (teamSpeech.includes('атака') || teamSpeech.includes('вперёд') || teamSpeech.includes('штурм') || teamSpeech.includes('забивать') || teamTraining.includes('удар') || teamTraining.includes('атак')) {
    teamOrientation = 'attack';
  } else {
    // По схеме
    if (teamFormation.startsWith('5-') || teamFormation === '4-5-1') teamOrientation = 'bus';
    else if (teamFormation === '3-5-2' || teamFormation === '4-4-2') teamOrientation = 'counter';
    else if (teamFormation === '4-3-3' || teamFormation === '3-4-3') teamOrientation = 'attack';
    else teamOrientation = 'balanced';
  }

  // Расчет баллов совместимости
  let score = 70; // базовый нейтральный уровень
  let desc = '';

  // Сравнение философии тренера и ориентации команды
  if (coachStyle === teamOrientation) {
    score += 25;
    desc = `Полная гармония: тренер и состав мыслят одинаково в стиле «${coach.styleTitle}». Игроки безупречно понимают установку.`;
  } else if (
    (coachStyle === 'attack' && teamOrientation === 'possession') ||
    (coachStyle === 'possession' && teamOrientation === 'attack') ||
    (coachStyle === 'counter' && teamOrientation === 'press') ||
    (coachStyle === 'press' && teamOrientation === 'attack') ||
    (coachStyle === 'bus' && teamOrientation === 'counter')
  ) {
    score += 15;
    desc = `Хорошая тактическая сочетаемость: принципы тренера дополняют текущую игровую модель клуба.`;
  } else if (teamOrientation === 'balanced') {
    score += 5;
    desc = `Сбалансированная модель: команда выполняет базовые требования наставника без перекосов.`;
  } else if (
    (coachStyle === 'bus' && (teamOrientation === 'attack' || teamOrientation === 'press')) ||
    (coachStyle === 'attack' && teamOrientation === 'bus')
  ) {
    // Прямой тактический конфликт (автобусник с шашками наголо)
    score -= 42;
    desc = `Тактический диссонанс: тренер ставит ${COACH_STYLES_INFO[coachStyle].title}, а команда играет в противофазе (${COACH_STYLES_INFO[teamOrientation]?.title || teamOrientation}). Возникают разрывы между линиями и потери.`;
  } else {
    score -= 15;
    desc = `Умеренные разногласия: тактические требования наставника не полностью ложатся на схему и привычки игроков.`;
  }

  // Учет схемы тренера
  const favored = COACH_STYLES_INFO[coachStyle].favoredFormations || [];
  if (favored.includes(teamFormation)) {
    score += 8;
  } else if (teamFormation.startsWith('5-') && coachStyle === 'attack') {
    score -= 10;
  } else if (teamFormation.startsWith('3-') && coachStyle === 'bus') {
    score -= 8;
  }

  score = Math.max(15, Math.min(100, score));

  let status: 'excellent' | 'good' | 'neutral' | 'poor' | 'clash' = 'neutral';
  let statusTitle = 'Умеренная совместимость';
  let statusBadgeClass = 'neutral';

  let xgMultiplier = 1.0;
  let xgaMultiplier = 1.0;
  let defenseBonus = 0;
  let tackleBonus = 0;
  let foulModifier = 1.0;

  if (score >= 85) {
    status = 'excellent';
    statusTitle = 'Идеальная синергия';
    statusBadgeClass = 'top';
    xgMultiplier = coachStyle === 'attack' || coachStyle === 'possession' ? 1.15 : 1.08;
    xgaMultiplier = coachStyle === 'bus' || coachStyle === 'counter' ? 0.85 : 0.92;
    defenseBonus = 0.2;
    tackleBonus = 0.25;
    foulModifier = 0.85;
  } else if (score >= 70) {
    status = 'good';
    statusTitle = 'Высокая сыгранность';
    statusBadgeClass = 'gold';
    xgMultiplier = 1.06;
    xgaMultiplier = 0.94;
    defenseBonus = 0.1;
    tackleBonus = 0.12;
  } else if (score >= 50) {
    status = 'neutral';
    statusTitle = 'Рабочая стабильность';
    statusBadgeClass = 'playoff';
    xgMultiplier = 1.0;
    xgaMultiplier = 1.0;
  } else if (score >= 35) {
    status = 'poor';
    statusTitle = 'Тактический разлад';
    statusBadgeClass = 'bad';
    xgMultiplier = 0.90;
    xgaMultiplier = 1.14;
    foulModifier = 1.2;
  } else {
    status = 'clash';
    statusTitle = 'Тактический кризис';
    statusBadgeClass = 'bad';
    xgMultiplier = 0.82;
    xgaMultiplier = 1.25;
    foulModifier = 1.35;
  }

  return {
    score,
    status,
    statusTitle,
    statusBadgeClass,
    xgMultiplier,
    xgaMultiplier,
    defenseBonus,
    tackleBonus,
    foulModifier,
    description: desc
  };
}

/* ───────── Полный тренерский и медицинский штаб ───────── */

export type StaffRole = 'head' | 'assistant' | 'gk' | 'fitness' | 'attack' | 'doctor';

export const STAFF_ROLES: Record<StaffRole, { title: string; short: string; desc: string; icon: string }> = {
  head: { title: 'Главный тренер', short: 'Гл. тренер', desc: 'Руководство командой, стратегия, выбор тактики и состава', icon: '👔' },
  assistant: { title: 'Ассистент главного тренера', short: 'Ассистент', desc: 'Помощник наставника, моделирование тактических упражнений и анализ', icon: '📋' },
  gk: { title: 'Тренер вратарей', short: 'Тр. вратарей', desc: 'Специальная подготовка голкиперов, реакция, игра на выходах и пенальти', icon: '🧤' },
  fitness: { title: 'Тренер по физподготовке', short: 'Физподготовка', desc: 'Выносливость, взрывная скорость, кондиции и профилактика травм', icon: '⚡' },
  attack: { title: 'Тренер нападающих и стандартов', short: 'Тр. нападающих', desc: 'Завершение атак, стандарты, реализация моментов и работа форвардов', icon: '🎯' },
  doctor: { title: 'Главный врач клуба', short: 'Главврач', desc: 'Медицинский штаб, реабилитация после травм и медицинский контроль', icon: '🩺' }
};

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  roleTitle: string;
  teamId: string;
  teamName?: string;
  age: number;
  nationality: string;
  style?: string;
  styleTitle?: string;
  favoriteFormation?: string;
  specialty?: string;
  bio: string;
}

export const REAL_RPL_STAFFS: Record<string, Omit<StaffMember, 'id' | 'teamId' | 'teamName'>[]> = {
  'зенит': [
    { name: 'Сергей Семак', role: 'head', roleTitle: 'Главный тренер', age: 50, nationality: 'Россия', style: 'possession', styleTitle: 'Контроль мяча и доминирование', favoriteFormation: '4-3-3', specialty: 'Управление звёздным составом и позиционная структура', bio: 'Пятикратный чемпион России во главе «Зенита». Ставит сбалансированный футбол с доминированием в центре поля.' },
    { name: 'Вильям де Оливейра', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 43, nationality: 'Бразилия', specialty: 'Интеграция латиноамериканских легионеров и тактика', bio: 'Правая рука Семака, отвечает за тактические схемы и коммуникацию с лидерами.' },
    { name: 'Анатолий Тимощук', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 46, nationality: 'Украина', specialty: 'Опорная зона и стандарты в обороне', bio: 'Легендарный экс-капитан «Зенита», победитель Кубка УЕФА. Отвечает за бойцовский дух и плотность линий.' },
    { name: 'Михаил Бирюков', role: 'gk', roleTitle: 'Тренер вратарей', age: 67, nationality: 'Россия', specialty: 'Техника ловли, психологическая устойчивость вратарей', bio: 'Мэтр отечественного вратарского цеха, чемпион СССР 1984 года. Воспитал целое поколение голкиперов.' },
    { name: 'Иван Карминати', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 71, nationality: 'Италия', specialty: 'Пиковая функциональная готовность и выносливость', bio: 'Экс-тренер сборной Англии и «Манчестер Сити» времён Роберто Манчини.' },
    { name: 'Александр Низелик', role: 'attack', roleTitle: 'Тренер нападающих и аналитик', age: 39, nationality: 'Россия', specialty: 'Завершение атак, открывания форвардов и разбор соперников', bio: 'Тактический аналитик штаба, изучал футбол в Португалии и Италии.' },
    { name: 'Михаил Гришин', role: 'doctor', roleTitle: 'Главный врач клуба', age: 48, nationality: 'Россия', specialty: 'Спортивная травматология и быстрое восстановление', bio: 'Руководитель медицинского департамента «Зенита» с многолетним стажем в еврокубках.' }
  ],
  'краснодар': [
    { name: 'Мурад Мусаев', role: 'head', roleTitle: 'Главный тренер', age: 43, nationality: 'Россия', style: 'attack', styleTitle: 'Доминирующая эстетичная атака', favoriteFormation: '4-3-3', specialty: 'Комбинационная атака и развитие воспитанников академии', bio: 'Главный тренер «быков». Воплощает философию Сергея Галицкого — смелый открытый футбол.' },
    { name: 'Артур Оленин', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 54, nationality: 'Россия', specialty: 'Тактическая дисциплина и перестроения', bio: 'Опытный тренер-методист, работает в тандеме с Мусаевым.' },
    { name: 'Алексей Чистяков', role: 'gk', roleTitle: 'Тренер вратарей', age: 48, nationality: 'Россия', specialty: 'Игра на выходах и начало атак через голкипера (ногами)', bio: 'Специалист академии и главной команды, развивает современную вратарскую игру.' },
    { name: 'Даниэль Бенедито', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 45, nationality: 'Испания', specialty: 'Аэробная база и интенсивный рывковый тренинг', bio: 'Испанский тренер по физической подготовке с европейским сертификатом.' },
    { name: 'Сергей Матвеев', role: 'attack', roleTitle: 'Тренер нападающих и аналитик', age: 53, nationality: 'Россия', specialty: 'Взаимодействие вингеров и нападающего в штрафной', bio: 'Специалист по атакующим фазам игры и стандарты.' },
    { name: 'Андрей Багдасарян', role: 'doctor', roleTitle: 'Главный врач клуба', age: 46, nationality: 'Россия', specialty: 'Спортивная медицина и мониторинг кардионагрузок', bio: 'Возглавляет медицинский штаб «Краснодара», эксперт в реабилитации связок.' }
  ],
  'локомотив': [
    { name: 'Михаил Галактионов', role: 'head', roleTitle: 'Главный тренер', age: 42, nationality: 'Россия', style: 'press', styleTitle: 'Молодёжный скоростной прессинг', favoriteFormation: '4-2-3-1', specialty: 'Развитие молодых талантов и вертикальные выпады', bio: 'Экс-наставник молодёжной сборной России. Построил одну из самых молодых и дерзких команд РПЛ.' },
    { name: 'Олег Левин', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 40, nationality: 'Россия', specialty: 'Организация тренировочного процесса', bio: 'Ближайший соратник Галактионова, курирует упражнения с высокой интенсивностью.' },
    { name: 'Дмитрий Лоськов', role: 'attack', roleTitle: 'Тренер нападающих и стандартов', age: 52, nationality: 'Россия', specialty: 'Стандарты, завершающие пасы и удары из-за штрафной', bio: 'Живая легенда «Локомотива», рекордсмен по голевым передачам в истории РПЛ.' },
    { name: 'Заур Хапов', role: 'gk', roleTitle: 'Тренер вратарей', age: 61, nationality: 'Россия', specialty: 'Реакция, игра один на один и подсказ защитникам', bio: 'Чемпион России 1995 года. Многолетний хранитель вратарских традиций «Локо».' },
    { name: 'Сергей Алексеев', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 44, nationality: 'Россия', specialty: 'Скорость и спринтерская выносливость', bio: 'Отвечает за атлетизм и физические кондиции игроков основы.' },
    { name: 'Игорь Калюжный', role: 'doctor', roleTitle: 'Главный врач клуба', age: 49, nationality: 'Россия', specialty: 'Травматология и восстановление мышц', bio: 'Главный врач «железнодорожников» с опытом работы в еврокубках.' }
  ],
  'спартак': [
    { name: 'Деян Станкович', role: 'head', roleTitle: 'Главный тренер', age: 48, nationality: 'Сербия', style: 'attack', styleTitle: 'Страстная эмоциональная атака', favoriteFormation: '4-3-3', specialty: 'Победитель Лиги чемпионов, лидерская ментальность и агрессивный штурм', bio: 'Легенда миланского «Интера» и сборной Сербии. Прививает спартаковцам несгибаемую волю и атаку.' },
    { name: 'Ненад Сакич', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 54, nationality: 'Сербия', specialty: 'Тактика защитных линий и компактность', bio: 'Правая рука Станковича со времён «Црвены Звезды» и «Сампдории».' },
    { name: 'Пьерлуиджи Бривио', role: 'gk', roleTitle: 'Тренер вратарей', age: 57, nationality: 'Италия', specialty: 'Итальянская вратарская школа: выбор позиции и чтение эпизодов', bio: 'Опытный итальянский тренер вратарей из Серии А.' },
    { name: 'Федерико Паннончини', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 46, nationality: 'Италия', specialty: 'Силовая подготовка и высокоинтенсивные интервалы', bio: 'Европейский специалист по кондициям и профилактике переутомления.' },
    { name: 'Вадим Романов', role: 'attack', roleTitle: 'Тренер нападающих и аналитик', age: 47, nationality: 'Россия', specialty: 'Анализ слабостей обороны соперников', bio: 'Воспитанник спартаковской школы, отвечает за атакующие связки.' },
    { name: 'Кирилл Козлов', role: 'doctor', roleTitle: 'Главный врач клуба', age: 43, nationality: 'Россия', specialty: 'Спортивная травматология и экстренная помощь на поле', bio: 'Главный врач красно-белых, специалист по суставным травмам.' }
  ],
  'цска': [
    { name: 'Марко Николич', role: 'head', roleTitle: 'Главный тренер', age: 47, nationality: 'Сербия', style: 'counter', styleTitle: 'Организованный прагматичный контр-атакующий стиль', favoriteFormation: '3-5-2', specialty: 'Тактическая строгость, оборона и игра на результат', bio: 'Обладатель Кубка России. Мастер построения плотной и надежной игровой структуры.' },
    { name: 'Радое Смилянич', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 49, nationality: 'Сербия', specialty: 'Аналитика и координация линий', bio: 'Многолетний тактический ассистент Николича.' },
    { name: 'Алексей Березуцкий', role: 'assistant', roleTitle: 'Тренер защитников и стандартов', age: 44, nationality: 'Россия', specialty: 'Оборонительная линия и игра головой', bio: 'Легендарный защитник ЦСКА и сборной России, обладатель Кубка УЕФА 2005.' },
    { name: 'Дмитрий Крамаренко', role: 'gk', roleTitle: 'Тренер вратарей', age: 51, nationality: 'Азербайджан', specialty: 'Психология первого номера и реакция', bio: 'Работает с Игорем Акинфеевым и молодыми армейскими голкиперами.' },
    { name: 'Горан Басич', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 48, nationality: 'Сербия', specialty: 'Мощность, контактный атлетизм и восстановление', bio: 'Сербский специалист высшей квалификации по физподготовке.' },
    { name: 'Эдуард Безуглов', role: 'doctor', roleTitle: 'Главный врач клуба', age: 44, nationality: 'Россия', specialty: 'Спортивная фармакология, биохимия и реабилитация', bio: 'Один из самых авторитетных спортивных врачей страны, экс-главврач сборной России.' }
  ],
  'динамо москва': [
    { name: 'Марцел Личка', role: 'head', roleTitle: 'Главный тренер', age: 49, nationality: 'Чехия', style: 'attack', styleTitle: 'Открытый бесшабашный тотальный футбол', favoriteFormation: '4-3-3', specialty: 'Высочайший темп, атакующий азарт и стандарты', bio: 'Главный тренер бело-голубых. Ставит самый результативный и яркий футбол в чемпионате.' },
    { name: 'Ролан Гусев', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 48, nationality: 'Россия', specialty: 'Фланговые подачи, стандарты и мотивация игроков', bio: 'Экс-звезда «Динамо», ЦСКА и сборной России. Отвечает за стандарты и работу с полузащитой.' },
    { name: 'Марио Личка', role: 'attack', roleTitle: 'Тренер нападающих и аналитик', age: 44, nationality: 'Чехия', specialty: 'Комбинации в финальной трети поля', bio: 'Брат Марцела Лички, специалист по завершающей стадии атак.' },
    { name: 'Роман Березовский', role: 'gk', roleTitle: 'Тренер вратарей', age: 51, nationality: 'Армения', specialty: 'Отражение пенальти и хладнокровие в створе', bio: 'Легенда вратарского цеха РПЛ, рекордсмен лиги по отражённым пенальти.' },
    { name: 'Хосе Пастор Верчури', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 47, nationality: 'Испания', specialty: 'Высокоскоростная работа и динамический прессинг', bio: 'Испанский тренер по физической подготовке с богатым европейским опытом.' },
    { name: 'Александр Родионов', role: 'doctor', roleTitle: 'Главный врач клуба', age: 45, nationality: 'Россия', specialty: 'Миофасциальная терапия и мышечные микроповреждения', bio: 'Главный врач ФК «Динамо» Москва.' }
  ],
  'ростов': [
    { name: 'Валерий Карпин', role: 'head', roleTitle: 'Главный тренер', age: 57, nationality: 'Россия', style: 'press', styleTitle: 'Агрессивный прессинг и выход через пас', favoriteFormation: '4-3-3', specialty: 'Тактическая строгость, выход из обороны и прессинг', bio: 'Главный тренер «Ростова» и сборной России. Непререкаемый авторитет и тактический лидер.' },
    { name: 'Виктор Онопко', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 56, nationality: 'Россия', specialty: 'Организация оборонительных порядков', bio: 'Легендарный капитан сборной России (113 матчей), столп обороны и мудрый наставник.' },
    { name: 'Виталий Кафанов', role: 'gk', roleTitle: 'Тренер вратарей', age: 65, nationality: 'Россия', specialty: 'Лучшая вратарская методология в стране, ввод мяча и тактика вратарей', bio: 'Мэтр отечественного футбола, главный тренер вратарей сборной России и «Ростова».' },
    { name: 'Альваро Саябера', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 44, nationality: 'Испания', specialty: 'Тестирование функциональной формы и аэробный фундамент', bio: 'Испанский специалист штаба Карпина, ставит знаменитую ростовскую выносливость.' },
    { name: 'Джонатан Альба', role: 'attack', roleTitle: 'Тренер нападающих и тактический аналитик', age: 43, nationality: 'Испания', specialty: 'Поиск свободных зон и прессинг форвардов', bio: 'Испанский тренер-аналитик, работает над синхронным прессингом нападающих.' },
    { name: 'Владимир Хохлов', role: 'doctor', roleTitle: 'Главный врач клуба', age: 50, nationality: 'Россия', specialty: 'Спортивное питание и экспресс-восстановление', bio: 'Многолетний главный врач ростовского клуба.' }
  ],
  'рубин': [
    { name: 'Рашид Рахимов', role: 'head', roleTitle: 'Главный тренер', age: 61, nationality: 'Россия', style: 'bus', styleTitle: 'Казанский оборонительный бастион', favoriteFormation: '5-3-2', specialty: 'Силовая борьба, плотный низкий блок и характер', bio: 'Опытный наставник австрийской и российской школы. Построил непробиваемый казанский коллектив.' },
    { name: 'Бенджамин Дюррей', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 45, nationality: 'Германия', specialty: 'Немецкая тактическая дисциплина', bio: 'Немецкий ассистент Рахимова, курирует моделирование оборонительных схем.' },
    { name: 'Сергей Козко', role: 'gk', roleTitle: 'Тренер вратарей', age: 50, nationality: 'Россия', specialty: 'Вратарская реакция и координация', bio: 'Чемпион России в составе «Рубина», много лет готовит казанских вратарей.' },
    { name: 'Хавьер Нойя Сальседо', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 46, nationality: 'Испания', specialty: 'Мощность и скоростная выносливость в борьбе', bio: 'Испанский специалист по силовой подготовке.' },
    { name: 'Олег Кузьмин', role: 'attack', roleTitle: 'Тренер по стандартам и фланговой игре', age: 44, nationality: 'Россия', specialty: 'Кроссы, фланговые передачи и стандарты', bio: 'Экс-капитан «Рубина» и сборной России.' },
    { name: 'Михаил Бутовский', role: 'doctor', roleTitle: 'Главный врач клуба', age: 47, nationality: 'Россия', specialty: 'Спортивная травматология', bio: 'Главный врач «Рубина», один из лучших диагностов спортивных травм.' }
  ],
  'крылья советов': [
    { name: 'Игорь Осинькин', role: 'head', roleTitle: 'Главный тренер', age: 60, nationality: 'Россия', style: 'possession', styleTitle: 'Умный позиционный комбинационный футбол', favoriteFormation: '4-2-3-1', specialty: 'Раскрытие молодых дарований и интеллектуальный пас', bio: 'Один из лучших тренеров-педагогов в российском футболе, открывший Пиняева, Зиньковского, Сергеева.' },
    { name: 'Сергей Булатов', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 53, nationality: 'Россия', specialty: 'Тактическая подготовка и работа с полузащитой', bio: 'Опытный помощник Осинькина.' },
    { name: 'Виктор Гаус', role: 'gk', roleTitle: 'Тренер вратарей', age: 61, nationality: 'Россия', specialty: 'Вратарская техника и самообладание', bio: 'Многолетний наставник вратарей самарского клуба.' },
    { name: 'Михаил Соловей', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 43, nationality: 'Россия', specialty: 'Легкость движения и выносливость молодых игроков', bio: 'Специалист по скоростной выносливости.' },
    { name: 'Артем Булойчик', role: 'attack', roleTitle: 'Тренер нападающих', age: 33, nationality: 'Беларусь', specialty: 'Движение в штрафной и завершение атак', bio: 'Молодой прогрессивный специалист атакующего профиля.' },
    { name: 'Кюри Султанбиев', role: 'doctor', roleTitle: 'Главный врач клуба', age: 49, nationality: 'Россия', specialty: 'Профилактика перегрузок и реабилитация', bio: 'Главный врач «Крыльев Советов».' }
  ],
  'ахмат': [
    { name: 'Сергей Ташуев', role: 'head', roleTitle: 'Главный тренер', age: 67, nationality: 'Россия', style: 'press', styleTitle: 'Вертикальный интенсивный силовой прессинг', favoriteFormation: '4-2-3-1', specialty: 'Агрессивный отбор, высокая плотность и верховая борьба', bio: 'Опытный тренер с железными требованиями к самоотдаче.' },
    { name: 'Вячеслав Молчанов', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 53, nationality: 'Россия', specialty: 'Координация оборонительного блока', bio: 'Многолетний помощник Ташуева.' },
    { name: 'Рамзан Цуцулаев', role: 'gk', roleTitle: 'Тренер вратарей', age: 49, nationality: 'Россия', specialty: 'Реакция и смелость на выходах', bio: 'Грозненский наставник вратарей.' },
    { name: 'Артем Ташуев', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 35, nationality: 'Россия', specialty: 'Силовые кондиции и рывковая работа', bio: 'Отвечает за физику и мышечный тонус.' },
    { name: 'Адлан Кацаев', role: 'attack', roleTitle: 'Тренер нападающих', age: 37, nationality: 'Россия', specialty: 'Индивидуальная техника и дриблинг форвардов', bio: 'Экс-хавбек «Терека»/«Ахмата».' },
    { name: 'Аслан Кабисов', role: 'doctor', roleTitle: 'Главный врач клуба', age: 46, nationality: 'Россия', specialty: 'Спортивная медицина', bio: 'Главный врач ФК «Ахмат».' }
  ],
  'балтика': [
    { name: 'Андрей Талалаев', role: 'head', roleTitle: 'Главный тренер', age: 53, nationality: 'Россия', style: 'press', styleTitle: 'Тотальный прессинг и бешеная самоотдача', favoriteFormation: '4-3-3', specialty: 'Физическая мощь, агрессивный отбор мяча и фланговые прорывы', bio: 'Один из самых ярких и эмоциональных тренеров страны. Ставит атлетичный и энергозатратный футбол.' },
    { name: 'Юрий Нагайцев', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 52, nationality: 'Россия', specialty: 'Тактика и разбор соперников', bio: 'Бессменный ассистент и аналитик в штабе Талалаева.' },
    { name: 'Глеб Пресняков', role: 'gk', roleTitle: 'Тренер вратарей', age: 46, nationality: 'Россия', specialty: 'Игра ногами и концентрация', bio: 'Тренер вратарей калининградцев.' },
    { name: 'Серхио Джованни', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 44, nationality: 'Италия', specialty: 'Высокоинтенсивный беговой объём', bio: 'Итальянский специалист по атлетической готовности.' },
    { name: 'Евгений Варламов', role: 'attack', roleTitle: 'Тренер по стандартам и обороне', age: 50, nationality: 'Россия', specialty: 'Верховые дуэли и угловые', bio: 'Экс-защитник ЦСКА и сборной России.' },
    { name: 'Павел Дзюба', role: 'doctor', roleTitle: 'Главный врач клуба', age: 42, nationality: 'Россия', specialty: 'Травматология и восстановление', bio: 'Главный врач «Балтики».' }
  ],
  'оренбург': [
    { name: 'Давид Деограсия', role: 'head', roleTitle: 'Главный тренер', age: 52, nationality: 'Испания', style: 'possession', styleTitle: 'Испанский позиционный комбинационный стиль', favoriteFormation: '4-3-3', specialty: 'Короткий пас, геометрия атак и владение мячом', bio: 'Испанский наставник, возглавлявший академию клуба до назначения главным тренером.' },
    { name: 'Ильдар Ахметзянов', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 42, nationality: 'Россия', specialty: 'Помощь главному тренеру и адаптация схемы', bio: 'Российский специалист тренерского штаба.' },
    { name: 'Платон Захарчук', role: 'gk', roleTitle: 'Тренер вратарей', age: 53, nationality: 'Россия', specialty: 'Позиционная игра в воротах', bio: 'Известный голкипер 90-х и 2000-х.' },
    { name: 'Евгений Стукалов', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 40, nationality: 'Россия', specialty: 'Интервальный бег и скорость', bio: 'Тренер по кондициям.' },
    { name: 'Радик Ямлиханов', role: 'attack', roleTitle: 'Тренер нападающих', age: 57, nationality: 'Россия', specialty: 'Действия нападающих в штрафной', bio: 'Опытный тренер атакующей линии.' },
    { name: 'Максим Вахлаков', role: 'doctor', roleTitle: 'Главный врач клуба', age: 44, nationality: 'Россия', specialty: 'Реабилитация и медицина', bio: 'Главврач «Оренбурга».' }
  ],
  'акрон': [
    { name: 'Заур Тедеев', role: 'head', roleTitle: 'Главный тренер', age: 44, nationality: 'Россия', style: 'attack', styleTitle: 'Дерзкий атакующий футбол без авторитетов', favoriteFormation: '4-3-3', specialty: 'Смелая игра первым номером и интеграция форвардов', bio: 'Вывел тольяттинский «Акрон» в элиту российского футбола.' },
    { name: 'Илья Калашников', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 42, nationality: 'Россия', specialty: 'Тактическая слаженность', bio: 'Ассистент штаба Тедеева.' },
    { name: 'Дмитрий Лукошкин', role: 'gk', roleTitle: 'Тренер вратарей', age: 48, nationality: 'Россия', specialty: 'Отражение ударов в упор', bio: 'Тренер вратарей «Акрона».' },
    { name: 'Рамиль Шарипов', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 39, nationality: 'Россия', specialty: 'Скорость и подвижность', bio: 'Специалист по атлетизму.' },
    { name: 'Алан Кусов', role: 'attack', roleTitle: 'Тренер нападающих', age: 44, nationality: 'Россия', specialty: 'Техника удара и хладнокровие', bio: 'Экс-нападающий сборной России.' },
    { name: 'Дмитрий Баринов', role: 'doctor', roleTitle: 'Главный врач клуба', age: 43, nationality: 'Россия', specialty: 'Спортивная медицина', bio: 'Главврач «Акрона».' }
  ],
  'динамо махачкала': [
    { name: 'Хасанби Биджиев', role: 'head', roleTitle: 'Главный тренер', age: 59, nationality: 'Россия', style: 'bus', styleTitle: 'Дагестанский монолитный железобетон', favoriteFormation: '5-3-2', specialty: 'Оборонительная дисциплина и самоотверженность', bio: 'Наставник махачкалинцев, построивший одну из самых малопропускающих команд лиги.' },
    { name: 'Артем Куликов', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 46, nationality: 'Россия', specialty: 'Тактический анализ соперников', bio: 'Старший тренер штаба Биджиева.' },
    { name: 'Сергей Кращенко', role: 'gk', roleTitle: 'Тренер вратарей', age: 55, nationality: 'Россия', specialty: 'Вратарская школа и уверенность в рамке', bio: 'Многолетний вратарский специалист.' },
    { name: 'Магомед Рамазанов', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 41, nationality: 'Россия', specialty: 'Силовая мощь и мышечная выносливость', bio: 'Тренер по физической подготовке.' },
    { name: 'Шамиль Лахиялов', role: 'attack', roleTitle: 'Тренер нападающих', age: 46, nationality: 'Россия', specialty: 'Удары и нестандартные решения', bio: 'Легендарный дагестанский форвард.' },
    { name: 'Марат Магомедов', role: 'doctor', roleTitle: 'Главный врач клуба', age: 45, nationality: 'Россия', specialty: 'Спортивная травматология', bio: 'Главврач махачкалинского «Динамо».' }
  ],
  'факел': [
    { name: 'Дмитрий Пятибратов', role: 'head', roleTitle: 'Главный тренер', age: 49, nationality: 'Россия', style: 'bus', styleTitle: 'Огненный воронежский бойцовский футбол', favoriteFormation: '5-3-2', specialty: 'Бешеная энергетика, стандарты и верховые единоборства', bio: 'Харизматичный наставник «наглецов из Воронежа».' },
    { name: 'Валерий Климов', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 52, nationality: 'Россия', specialty: 'Организация контратак и стандартов', bio: 'Известный в прошлом полузащитник РПЛ.' },
    { name: 'Александр Чихрадзе', role: 'gk', roleTitle: 'Тренер вратарей', age: 50, nationality: 'Россия', specialty: 'Игра на выходах при верховых подачах', bio: 'Тренер вратарей «Факела».' },
    { name: 'Александр Зайцев', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 42, nationality: 'Россия', specialty: 'Бойцовская функциональная готовность', bio: 'Отвечает за атлетизм воронежцев.' },
    { name: 'Михаил Смирнов', role: 'attack', roleTitle: 'Тренер нападающих', age: 35, nationality: 'Россия', specialty: 'Агрессия в чужой штрафной', bio: 'Тренер атакующей группы.' },
    { name: 'Максим Румянцев', role: 'doctor', roleTitle: 'Главный врач клуба', age: 46, nationality: 'Россия', specialty: 'Спортивная медицина', bio: 'Главврач «Факела».' }
  ],
  'родина': [
    { name: 'Филипп Соколинский', role: 'head', roleTitle: 'Главный тренер', age: 39, nationality: 'Россия', style: 'possession', styleTitle: 'Современный комбинационный позиционный футбол', favoriteFormation: '4-3-3', specialty: 'Короткий пас, поиск свободных зон и прессинг', bio: 'Молодой прогрессивный специалист столичной «Родины».' },
    { name: 'Александр Павленко', role: 'assistant', roleTitle: 'Ассистент главного тренера', age: 41, nationality: 'Россия', specialty: 'Креативная полузащита и техника паса', bio: 'Экс-плеймейкер «Спартака» и сборной России.' },
    { name: 'Алексей Зуев', role: 'gk', roleTitle: 'Тренер вратарей', age: 45, nationality: 'Россия', specialty: 'Вратарская реакция и прыгучесть', bio: 'Экс-голкипер московского «Спартака».' },
    { name: 'Денис Голобородов', role: 'fitness', roleTitle: 'Тренер по физподготовке', age: 38, nationality: 'Россия', specialty: 'Современный фитнес-мониторинг', bio: 'Тренер по кондициям.' },
    { name: 'Роман Павлюченко', role: 'attack', roleTitle: 'Тренер нападающих', age: 44, nationality: 'Россия', specialty: 'Ударное мастерство, голевое чутьё и выбор позиции в штрафной', bio: 'Бронзовый призёр Евро-2008, легенда «Спартака», «Тоттенхэма» и сборной России.' },
    { name: 'Артур Сафаров', role: 'doctor', roleTitle: 'Главный врач клуба', age: 42, nationality: 'Россия', specialty: 'Медицинский контроль и реабилитация', bio: 'Главврач «Родины».' }
  ]
};

/**
 * Создать полный штаб для любого клуба
 */
export function generateClubStaff(team: { id: string; name: string; comp?: string }): StaffMember[] {
  const normName = (team.name || '').toLowerCase().trim();

  // 1. Проверяем готовый штаб из базы реальных штабов РПЛ
  for (const [k, list] of Object.entries(REAL_RPL_STAFFS)) {
    if (normName.includes(k) || k.includes(normName)) {
      return list.map((item, idx) => ({
        ...item,
        id: `staff_${team.id}_${item.role}_${idx}`,
        teamId: team.id,
        teamName: team.name
      }));
    }
  }

  // 2. Для остальных клубов генерируем реалистичный штаб из 6 специалистов
  const headCoach = getTeamCoach(team.name, team.comp || 'fnl');
  const hash = normName.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const assistantFirstNames = ['Олег', 'Сергей', 'Андрей', 'Игорь', 'Михаил', 'Алексей', 'Дмитрий', 'Виталий'];
  const assistantLastNames = ['Васильев', 'Попов', 'Григорьев', 'Николаев', 'Кузьмин', 'Семёнов', 'Богданов'];

  const gkFirstNames = ['Платон', 'Евгений', 'Дмитрий', 'Виктор', 'Геннадий', 'Александр', 'Роман'];
  const gkLastNames = ['Гончаров', 'Корнеев', 'Щербаков', 'Афанасьев', 'Кудрявцев', 'Белов'];

  const fitFirstNames = ['Антонио', 'Марко', 'Иван', 'Денис', 'Сергей', 'Карлос', 'Максим'];
  const fitLastNames = ['Мартинес', 'Соловьев', 'Ковалев', 'Егоров', 'Степанов', 'Павлов'];

  const attFirstNames = ['Роман', 'Денис', 'Александр', 'Валерий', 'Евгений', 'Артем', 'Максим'];
  const attLastNames = ['Бузникин', 'Шишкин', 'Сенников', 'Пименов', 'Кириченко', 'Медведев'];

  const docFirstNames = ['Михаил', 'Владимир', 'Артур', 'Кирилл', 'Александр', 'Дмитрий', 'Павел'];
  const docLastNames = ['Виноградов', 'Белоусов', 'Суханов', 'Тарасов', 'Ильин', 'Сорокин'];

  return [
    {
      id: `staff_${team.id}_head`,
      name: headCoach.name,
      role: 'head',
      roleTitle: 'Главный тренер',
      teamId: team.id,
      teamName: team.name,
      age: headCoach.age,
      nationality: headCoach.nationality,
      style: headCoach.style,
      styleTitle: headCoach.styleTitle,
      favoriteFormation: headCoach.favoriteFormation,
      specialty: 'Руководство командой и тактическое моделирование',
      bio: headCoach.styleDesc
    },
    {
      id: `staff_${team.id}_assistant`,
      name: `${assistantFirstNames[(hash + 1) % assistantFirstNames.length]} ${assistantLastNames[(hash * 3) % assistantLastNames.length]}`,
      role: 'assistant',
      roleTitle: 'Ассистент главного тренера',
      teamId: team.id,
      teamName: team.name,
      age: 38 + (hash % 18),
      nationality: 'Россия',
      specialty: 'Координация тренировок и разбор стандартных положений',
      bio: `Старший тренер штаба клуба «${team.name}». Отвечает за подготовительную работу и связь с основой.`
    },
    {
      id: `staff_${team.id}_gk`,
      name: `${gkFirstNames[(hash + 2) % gkFirstNames.length]} ${gkLastNames[(hash * 5) % gkLastNames.length]}`,
      role: 'gk',
      roleTitle: 'Тренер вратарей',
      teamId: team.id,
      teamName: team.name,
      age: 44 + (hash % 20),
      nationality: 'Россия',
      specialty: 'Игра на выходах, реакция и психология голкиперов',
      bio: `Специалист по работе с вратарями ФК «${team.name}». Экс-профессиональный голкипер.`
    },
    {
      id: `staff_${team.id}_fitness`,
      name: `${fitFirstNames[(hash + 3) % fitFirstNames.length]} ${fitLastNames[(hash * 7) % fitLastNames.length]}`,
      role: 'fitness',
      roleTitle: 'Тренер по физподготовке',
      teamId: team.id,
      teamName: team.name,
      age: 35 + (hash % 15),
      nationality: hash % 3 === 0 ? 'Испания' : 'Россия',
      specialty: 'Аэробная выносливость, взрывная сила и профилактика травматизма',
      bio: `Отвечает за физическое состояние и функциональную готовность команды к матчам.`
    },
    {
      id: `staff_${team.id}_attack`,
      name: `${attFirstNames[(hash + 4) % attFirstNames.length]} ${attLastNames[(hash * 11) % attLastNames.length]}`,
      role: 'attack',
      roleTitle: 'Тренер нападающих и стандартов',
      teamId: team.id,
      teamName: team.name,
      age: 38 + (hash % 16),
      nationality: 'Россия',
      specialty: 'Завершение атак, стандарты и открывания нападающих',
      bio: `Тренер атакующей группы игроков. Отрабатывает удары, стандарты и игру в чужой штрафной.`
    },
    {
      id: `staff_${team.id}_doctor`,
      name: `${docFirstNames[(hash + 5) % docFirstNames.length]} ${docLastNames[(hash * 13) % docLastNames.length]}`,
      role: 'doctor',
      roleTitle: 'Главный врач клуба',
      teamId: team.id,
      teamName: team.name,
      age: 42 + (hash % 18),
      nationality: 'Россия',
      specialty: 'Спортивная травматология, функциональная диагностика и восстановление',
      bio: `Руководитель медицинского штаба «${team.name}». Обеспечивает здоровье и скорейшее восстановление игроков.`
    }
  ];
}

/**
 * Инициализировать штаб для всех клубов приложения
 */
export function getAllInitialStaff(teams: any[]): StaffMember[] {
  const result: StaffMember[] = [];
  for (const t of teams) {
    result.push(...generateClubStaff(t));
  }
  return result;
}
