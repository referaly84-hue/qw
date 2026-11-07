/**
 * Логотипы и фирменный стиль футбольных клубов России для «Вирт РПЛ».
 * Использует официальные SVG-векторы клубов, загруженные пользователем.
 */

export interface ClubStyle {
  logo: string;
  primary: string;
  secondary: string;
  short: string;
}

// Официальные логотипы соревнований
export const COMPETITION_LOGOS: Record<string, string> = {
  rpl: '/logos/leagues/rpl.svg',
  supercup: '/logos/leagues/supercup.svg',
  'supercup-trophy': '/logos/leagues/supercup.svg',
  'суперкубок': '/logos/leagues/supercup.svg',
  'суперкубок россии': '/logos/leagues/supercup.svg',
  fnl: '/logos/leagues/fnl.svg',
  cup: '/logos/leagues/cup.svg',
  playoff: '/logos/leagues/rpl.svg',
  'cup-trophy': '/logos/leagues/cup-trophy.svg',
  rfu: '/assets/aistudio/russia_russian-football-union.football-logos.cc_21f191ca.svg',
  '2la': '/logos/leagues/2la.svg',
  '2la_gold': '/logos/leagues/2la.svg',
  '2la_silver': '/logos/leagues/2la.svg',
  '2lb': '/logos/leagues/2lb.svg',
  '2lb_1': '/logos/leagues/2lb.svg',
  '2lb_2': '/logos/leagues/2lb.svg',
  '2lb_3': '/logos/leagues/2lb.svg',
  '2lb_4': '/logos/leagues/2lb.svg',
  media: '/logos/leagues/media.svg',
  russia: '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg',
  national: '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg',
  'сборная': '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg',
  'сборная россии': '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg'
};

export function getCompetitionLogo(compId: string): string {
  const clean = (compId || '').toLowerCase().trim();
  if (COMPETITION_LOGOS[clean]) return COMPETITION_LOGOS[clean];
  if (clean.includes('supercup') || clean.includes('суперкубок')) return COMPETITION_LOGOS.supercup;
  if (clean.startsWith('2la')) return COMPETITION_LOGOS['2la'];
  if (clean.startsWith('2lb')) return COMPETITION_LOGOS['2lb'];
  return COMPETITION_LOGOS.rpl;
}

// Официальные логотипы клубов (пути к загруженным SVG и высококачественным PNG файлам)
export const OFFICIAL_LOGOS: Record<string, string> = {
  // РПЛ
  'зенит': '/assets/aistudio/russia_zenit.football-logos.cc_c93ec0ee.svg',
  'спартак': '/assets/aistudio/russia_spartak-moskva.football-logos.cc_cd7a4eb7.svg',
  'спартак москва': '/assets/aistudio/russia_spartak-moskva.football-logos.cc_cd7a4eb7.svg',
  'цска': '/assets/aistudio/PFC_CSKA_9a6b044d.svg',
  'цска москва': '/assets/aistudio/PFC_CSKA_9a6b044d.svg',
  'пфк цска': '/assets/aistudio/PFC_CSKA_9a6b044d.svg',
  'локомотив': '/assets/aistudio/russia_lokomotiv-moskva.football-logos.cc_af3d5476.svg',
  'локомотив москва': '/assets/aistudio/russia_lokomotiv-moskva.football-logos.cc_af3d5476.svg',
  'динамо москва': '/assets/aistudio/russia_dynamo-moscow.football-logos.cc_00d01b39.svg',
  'динамо м': '/assets/aistudio/russia_dynamo-moscow.football-logos.cc_00d01b39.svg',
  'краснодар': '/assets/aistudio/russia_krasnodar.football-logos.cc_3eb2641e.svg',
  'ростов': '/assets/aistudio/russia_rostov.football-logos.cc_615b1535.svg',
  'рубин': '/assets/aistudio/russia_rubin.football-logos.cc_f471fd8f.svg',
  'рубин казань': '/assets/aistudio/russia_rubin.football-logos.cc_f471fd8f.svg',
  'крылья советов': '/assets/aistudio/russia_krylya-sovetov.football-logos.cc_1b424814.svg',
  'крылья': '/assets/aistudio/russia_krylya-sovetov.football-logos.cc_1b424814.svg',
  'ахмат': '/assets/aistudio/russia_akhmat.football-logos.cc_ec510264.svg',
  'ахмат грозный': '/assets/aistudio/russia_akhmat.football-logos.cc_ec510264.svg',
  'балтика': '/assets/aistudio/russia_baltika.football-logos.cc_dec89199.svg',
  'балтика калининград': '/assets/aistudio/russia_baltika.football-logos.cc_dec89199.svg',
  'сочи': '/assets/aistudio/russia_sochi.football-logos.cc_368db1f4.svg',
  'пари нн': '/assets/aistudio/russia_pari-nn.football-logos.cc_3e0b1012.svg',
  'пари нижний новгород': '/assets/aistudio/russia_pari-nn.football-logos.cc_3e0b1012.svg',
  'нижний новгород': '/assets/aistudio/russia_pari-nn.football-logos.cc_3e0b1012.svg',
  'оренбург': '/assets/aistudio/russia_orenburg.football-logos.cc_e7d8ed34.svg',
  'акрон': '/assets/aistudio/russia_akron.football-logos.cc_9b564896.svg',
  'акрон тольятти': '/assets/aistudio/russia_akron.football-logos.cc_9b564896.svg',
  'динамо махачкала': '/assets/aistudio/russia_dynamo-makhachkala.football-logos.cc_9e55fd99.svg',
  'динамо мх': '/assets/aistudio/russia_dynamo-makhachkala.football-logos.cc_9e55fd99.svg',
  'факел': '/assets/aistudio/russia_fakel.football-logos.cc_4beaea45.svg',
  'факел воронеж': '/assets/aistudio/russia_fakel.football-logos.cc_4beaea45.svg',

  // ФНЛ, ПФЛ и клубы России
  'урал': '/assets/aistudio/russia_ural.football-logos.cc_d02d7659.svg',
  'урал екатеринбург': '/assets/aistudio/russia_ural.football-logos.cc_d02d7659.svg',
  'торпедо': '/assets/aistudio/russia_torpedo-moskva.football-logos.cc_458824bb.svg',
  'торпедо москва': '/assets/aistudio/russia_torpedo-moskva.football-logos.cc_458824bb.svg',
  'шинник': '/assets/aistudio/russia_shinnik.football-logos.cc_b0a4c239.svg',
  'шинник ярославль': '/assets/aistudio/russia_shinnik.football-logos.cc_b0a4c239.svg',
  'арсенал': '/assets/aistudio/russia_arsenal-tula.football-logos.cc_1ce7619a.svg',
  'арсенал тула': '/assets/aistudio/russia_arsenal-tula.football-logos.cc_1ce7619a.svg',
  'ротор': '/assets/aistudio/russia_rotor.football-logos.cc_be212968.svg',
  'ротор волгоград': '/assets/aistudio/russia_rotor.football-logos.cc_be212968.svg',
  'родина': '/assets/aistudio/russia_rodina-moscow.football-logos.cc_9872b082.svg',
  'родина москва': '/assets/aistudio/russia_rodina-moscow.football-logos.cc_9872b082.svg',
  'камаз': '/assets/aistudio/russia_kamaz.football-logos.cc_5f0e30b1.svg',
  'черноморец': '/assets/aistudio/russia_chernomorets-novorossiisk.football-logos.cc_69abc7dc.svg',
  'черноморец новороссийск': '/assets/aistudio/russia_chernomorets-novorossiisk.football-logos.cc_69abc7dc.svg',
  'ска-хабаровск': '/assets/aistudio/russia_ska-khabarovsk.football-logos.cc_5d23a258.svg',
  'ска хабаровск': '/assets/aistudio/russia_ska-khabarovsk.football-logos.cc_5d23a258.svg',
  'енисей': '/assets/aistudio/russia_yenisey.football-logos.cc_277f7baf.svg',
  'уфа': '/assets/aistudio/russia_ufa.football-logos.cc_b2df7253.svg',
  'нефтехимик': '/assets/aistudio/russia_neftekhimik-nizhnekamsk.football-logos.cc_7baec74c.svg',
  'нефтехимик нижнекамск': '/assets/aistudio/russia_neftekhimik-nizhnekamsk.football-logos.cc_7baec74c.svg',
  'чайка': '/assets/aistudio/russia_chayka-peschanokopskoye.football-logos.cc_a336e808.svg',
  'сокол': '/assets/aistudio/russia_fc-sokol-saratov.football-logos.cc_340b39fc.svg',
  'сокол саратов': '/assets/aistudio/russia_fc-sokol-saratov.football-logos.cc_340b39fc.svg',
  'саратов': '/assets/aistudio/russia_fc-sokol-saratov.football-logos.cc_340b39fc.svg',
  'амкар': '/assets/aistudio/russia_amkar.football-logos.cc_64e4152c.svg',
  'амкар пермь': '/assets/aistudio/russia_amkar.football-logos.cc_64e4152c.svg',
  'ленинградец': '/assets/aistudio/russia_leningradets.football-logos.cc_3c0bef00.svg',
  'велес': '/assets/aistudio/russia_veles-moscow.football-logos.cc_ed792674.svg',
  'велес москва': '/assets/aistudio/russia_veles-moscow.football-logos.cc_ed792674.svg',
  'волга ульяновск': '/assets/aistudio/russia_volga-ulyanovsk.football-logos.cc_b8522fda.svg',
  'волга': '/assets/aistudio/russia_volga-ulyanovsk.football-logos.cc_b8522fda.svg',
  'текстильщик': '/assets/aistudio/russia_tekstilshchik-ivanovo.football-logos.cc_f9a5bacd.svg',
  'текстильщик иваново': '/assets/aistudio/russia_tekstilshchik-ivanovo.football-logos.cc_f9a5bacd.svg',
  'химик': '/assets/aistudio/russia_khimik-dzerzhinsk.football-logos.cc_36b7d5c1.svg',
  'химик дзержинск': '/assets/aistudio/russia_khimik-dzerzhinsk.football-logos.cc_36b7d5c1.svg',
  'челябинск': '/assets/aistudio/russia_chelyabinsk.football-logos.cc_74fddc7d.svg',
  'астрахань': '/assets/aistudio/astrakhan-logo-2024-145x100_cbd49f65.png',
  'волгарь': '/assets/aistudio/volgar-logo-145x100_5d3f5dfd.png',
  'динамо брянск': '/assets/aistudio/russia_fc-dynamo-bryansk.football-logos.cc_50cc0bb4.svg',
  'элиста': '/assets/aistudio/russia_fc-elista.football-logos.cc_0167d01a.svg',
  'уралан': '/assets/aistudio/russia_fc-elista.football-logos.cc_0167d01a.svg',
  'спартак кострома': '/assets/aistudio/russia_spartak-kostroma.football-logos.cc_4f38dbc1.svg',
  'спартак нальчик': '/assets/aistudio/spartak-nalchik-big_b44c2e71.png',
  'спартак-нальчик': '/assets/aistudio/spartak-nalchik-big_b44c2e71.png',
  'спартак владикавказ': '/assets/aistudio/fk-spartak-alaniya-vladikavkaz-2003-logo-png_seeklogo-538369_59af4f86.png',
  'спартак-алания': '/assets/aistudio/fk-spartak-alaniya-vladikavkaz-2003-logo-png_seeklogo-538369_59af4f86.png',
  'спартак-алания владикавказ': '/assets/aistudio/fk-spartak-alaniya-vladikavkaz-2003-logo-png_seeklogo-538369_59af4f86.png',
  'спартак алания': '/assets/aistudio/fk-spartak-alaniya-vladikavkaz-2003-logo-png_seeklogo-538369_59af4f86.png',
  'звезда': '/logos/zvezda-spb.svg',
  'звезда спб': '/logos/zvezda-spb.svg',
  'звезда санкт-петербург': '/logos/zvezda-spb.svg',
  'фк звезда': '/logos/zvezda-spb.svg',
  'чертаново': '/assets/aistudio/russia_chertanovo.football-logos.cc_91970b61.svg',
  'алания': '/assets/aistudio/alania-big_ca72efaa.png',
  'алания владикавказ': '/assets/aistudio/alania-big_ca72efaa.png',
  'амкал': '/assets/aistudio/amkal-big_9fc643af.png',
  '2drots': '/assets/aistudio/2drots-big-768x768_24a6f01f.png',
  '2дротс': '/assets/aistudio/2drots-big-768x768_24a6f01f.png',
  'тюмень': '/assets/aistudio/tyumen-big-2023_361d20f9.png',
  'динамо владивосток': '/assets/aistudio/dynamo-vladivostok-logo-145x100_35048b53.png',
  'динамо-владивосток': '/assets/aistudio/dynamo-vladivostok-logo-145x100_35048b53.png',
  'динамо ставрополь': '/assets/aistudio/dynamo-stavropol-logo-145x100_e57697c6.png',
  'динамо-ставрополь': '/assets/aistudio/dynamo-stavropol-logo-145x100_e57697c6.png',
  'динамо вологда': '/assets/aistudio/dynamo-vologda-logo-145x100_d7f12918.png',
  'динамо-вологда': '/assets/aistudio/dynamo-vologda-logo-145x100_d7f12918.png',
  'динамо спб': '/assets/aistudio/dynamo-saint-petersburg-logo-145x100_9b445321.png',
  'динамо-спб': '/assets/aistudio/dynamo-saint-petersburg-logo-145x100_9b445321.png',
  'динамо санкт-петербург': '/assets/aistudio/dynamo-saint-petersburg-logo-145x100_9b445321.png',
  'дружба': '/assets/aistudio/druzhba-maykop-big-768x635_e7d80d49.png',
  'дружба майкоп': '/assets/aistudio/druzhba-maykop-big-768x635_e7d80d49.png',
  'машук-кмв': '/assets/aistudio/mashuk-kmv-big-2023_b9aad6d1.png',
  'машук кмв': '/assets/aistudio/mashuk-kmv-big-2023_b9aad6d1.png',
  'нарт': '/assets/aistudio/nart-big-768x768_da8dae81.png',
  'нарт черкесск': '/assets/aistudio/nart-big-768x768_da8dae81.png',
  'севастополь': '/assets/aistudio/sevastopol-big-768x768_a839f7ec.png',
  'салют': '/assets/aistudio/salyut-belgorod-logo-145x100_eda88427.png',
  'салют белгород': '/assets/aistudio/salyut-belgorod-logo-145x100_eda88427.png',
  'сатурн': '/assets/aistudio/saturn-logo-145x100_52d01930.png',
  'сатурн раменское': '/assets/aistudio/saturn-logo-145x100_52d01930.png',
  'леон сатурн': '/assets/aistudio/saturn-logo-145x100_52d01930.png',
  'ска ростов': '/assets/aistudio/ska-rostov-on-don-big-2024_5888a199.png',
  'ска ростов-на-дону': '/assets/aistudio/ska-rostov-on-don-big-2024_5888a199.png',
  'муром': '/assets/aistudio/murom-logo-145x100_6cc929e1.png',
  'балтика-бфу': '/assets/aistudio/baltika-bfu-logo-145x100_7ed174fe.png',
  'балтика бфу': '/assets/aistudio/baltika-bfu-logo-145x100_7ed174fe.png',
  'волна': '/assets/aistudio/volna-logo-145x100_517e32ba.png',
  'волгарь астрахань': '/assets/aistudio/volgar-logo-145x100_5d3f5dfd.png',
  'торпедо миасс': '/assets/aistudio/torpedo-miass-logo-145x100_2882b291.png',
  'торпедо-2': '/assets/aistudio/torpedo-2-logo-2023-145x100_d926e9d3.png',
  'торпедо-2 москва': '/assets/aistudio/torpedo-2-logo-2023-145x100_d926e9d3.png',
  'тосно': '/assets/aistudio/tosno-logo-145x100_0a915235.png',
  'рубин ялта': '/assets/aistudio/rubin-yalta-logo-145x100_3fed7b5f.png',
  'рубин-ялта': '/assets/aistudio/rubin-yalta-logo-145x100_3fed7b5f.png',
  'кубань холдинг': '/assets/aistudio/kuban-holding-logo-145x100_a8d8b782.png',
  'кубань-холдинг': '/assets/aistudio/kuban-holding-logo-145x100_a8d8b782.png',
  'спартак тамбов': '/assets/aistudio/spartak-tambov-logo-2023-145x100_cbb80c10.png',
  'космос': '/assets/aistudio/kosmos-logo-145x100_de30adcf.png',
  'космос долгопрудный': '/assets/aistudio/kosmos-logo-145x100_de30adcf.png',
  'калуга': '/assets/aistudio/kaluga-logo-145x100_9361352d.png',
  'зенит пенза': '/assets/aistudio/zenit-penza-logo-145x100_7015bb97.png',
  'зенит ижевск': '/assets/aistudio/zenit-izhevsk-logo-145x100_912c7ca9.png',
  'зенит-ижевск': '/assets/aistudio/zenit-izhevsk-logo-145x100_912c7ca9.png',
  'ижевск': '/assets/aistudio/zenit-izhevsk-logo-145x100_912c7ca9.png',
  'знамя труда': '/assets/aistudio/znamya-truda-logo-2023-145x100_18414f3c.png',
  'динамо барнаул': '/assets/aistudio/dynamo-barnaul-logo-2022-145x100_5ea90613.png',
  'динамо-барнаул': '/assets/aistudio/dynamo-barnaul-logo-2022-145x100_5ea90613.png',
  'победа': '/assets/aistudio/pobeda-logo-145x100_c17677cd.png',
  'победа хасавюрт': '/assets/aistudio/pobeda-logo-145x100_c17677cd.png',
  'луки-энергия': '/assets/aistudio/luki-energiya-logo-145x100_8ab65adb.png',
  'авангард': '/assets/aistudio/avangard-kursk-logo-145x100_5e78c799.png',
  'авангард курск': '/assets/aistudio/avangard-kursk-logo-145x100_5e78c799.png',
  'армавир': '/assets/aistudio/armavir-logo-145x100_c9472b14.png',
  'ангушт': '/assets/aistudio/angusht-logo-145x100_65e74e2b.png',
  'сибирь': '/assets/aistudio/sibir-logo-145x100_32fa3466.png',
  'сибирь новосибирск': '/assets/aistudio/sibir-logo-145x100_32fa3466.png',
  'динамо киров': '/assets/aistudio/dynamo-kirov-logo-145x100_635140b3.png',
  'динамо-киров': '/assets/aistudio/dynamo-kirov-logo-145x100_635140b3.png',
  'броуки': '/assets/aistudio/Brokeboys_lightmode_4834bb47.png',
  'броуки (brokeboys)': '/assets/aistudio/Brokeboys_lightmode_4834bb47.png',
  'brokeboys': '/assets/aistudio/Brokeboys_lightmode_4834bb47.png',
  'broke boys': '/assets/aistudio/Brokeboys_lightmode_4834bb47.png',
  'синдекат': '/assets/aistudio/i_d0be2178.webp',
  'банка': '/assets/aistudio/Team_BANKA_lightmode_658cabb4.png',
  'team banka': '/assets/aistudio/Team_BANKA_lightmode_658cabb4.png',
  'fc banka': '/assets/aistudio/Team_BANKA_lightmode_658cabb4.png',
  'fight nights': '/assets/aistudio/20250710185733_Fight_Nights_lightmode_ed417a13.png',
  'файт найтс': '/assets/aistudio/20250710185733_Fight_Nights_lightmode_ed417a13.png',
  'prime squad': '/assets/aistudio/original__2__f34350ab.png',
  'прайм сквад': '/assets/aistudio/original__2__f34350ab.png',
  'фк 10': '/assets/aistudio/30549813_47b25a7b.jpg',
  'fc 10': '/assets/aistudio/30549813_47b25a7b.jpg',
  'народная команда': '/assets/aistudio/1713435283593698984_492496b6.png',
  'матч тв': '/assets/aistudio/original__1__0c5942f0.png',
  'lit energy': '/assets/aistudio/original_e9317d9e.png',
  'лит энерджи': '/assets/aistudio/original_e9317d9e.png',
  'иркутск': '/assets/aistudio/irkutsk-big_32a733f0.png',
  'фк иркутск': '/assets/aistudio/irkutsk-big_32a733f0.png',
  'эгриси': '/assets/aistudio/f14322dd6495d94f39ec68f33cf52_b5ba6e96.webp',
  'фк эгриси': '/assets/aistudio/f14322dd6495d94f39ec68f33cf52_b5ba6e96.webp',
  'чисто питер': '/assets/aistudio/original__3__dab66e2c.png',
  'rocket team': '/assets/aistudio/1713523892825857620_cf3b7ed4.png',
  'рокет тим': '/assets/aistudio/1713523892825857620_cf3b7ed4.png',
  'сборная россии': '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg',
  'сборная': '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg',
  'россия': '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg',
  'сборная рф': '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg',
  'национальная сборная': '/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg'
};

// Фирменные цвета клубов
export const OFFICIAL_COLORS: Record<string, { primary: string; secondary: string; short: string }> = {
  'зенит': { primary: '#00a3e0', secondary: '#ffffff', short: 'ЗЕН' },
  'спартак': { primary: '#e11d27', secondary: '#ffffff', short: 'СПА' },
  'спартак москва': { primary: '#e11d27', secondary: '#ffffff', short: 'СПА' },
  'цска': { primary: '#003b94', secondary: '#d3202a', short: 'ЦСК' },
  'цска москва': { primary: '#003b94', secondary: '#d3202a', short: 'ЦСК' },
  'локомотив': { primary: '#008542', secondary: '#e30613', short: 'ЛОК' },
  'локомотив москва': { primary: '#008542', secondary: '#e30613', short: 'ЛОК' },
  'динамо москва': { primary: '#004d9c', secondary: '#ffffff', short: 'ДИН' },
  'краснодар': { primary: '#144734', secondary: '#bba15a', short: 'КРА' },
  'ростов': { primary: '#ffd200', secondary: '#003da5', short: 'РОС' },
  'рубин': { primary: '#9d1c24', secondary: '#007a3d', short: 'РУБ' },
  'рубин казань': { primary: '#9d1c24', secondary: '#007a3d', short: 'РУБ' },
  'крылья советов': { primary: '#55acee', secondary: '#ffffff', short: 'КРС' },
  'ахмат': { primary: '#00843d', secondary: '#ffffff', short: 'АХМ' },
  'балтика': { primary: '#002d72', secondary: '#009cde', short: 'БАЛ' },
  'сочи': { primary: '#0a192f', secondary: '#00c0f3', short: 'СОЧ' },
  'пари нн': { primary: '#001838', secondary: '#00e5ff', short: 'ПНН' },
  'оренбург': { primary: '#0072ce', secondary: '#ffffff', short: 'ОРЕ' },
  'акрон': { primary: '#c8102e', secondary: '#111111', short: 'АКР' },
  'динамо махачкала': { primary: '#0066b2', secondary: '#ffffff', short: 'ДМХ' },
  'факел': { primary: '#003399', secondary: '#e52b2b', short: 'ФАК' },
  'урал': { primary: '#f36f21', secondary: '#1a1a1a', short: 'УРА' },
  'торпедо': { primary: '#111111', secondary: '#ffffff', short: 'ТОР' },
  'торпедо москва': { primary: '#111111', secondary: '#ffffff', short: 'ТОР' },
  'шинник': { primary: '#002d72', secondary: '#000000', short: 'ШИН' },
  'арсенал': { primary: '#e5a823', secondary: '#d3202a', short: 'АРС' },
  'арсенал тула': { primary: '#e5a823', secondary: '#d3202a', short: 'АРС' },
  'ротор': { primary: '#00a3e0', secondary: '#002d72', short: 'РОТ' },
  'родина': { primary: '#00a3e0', secondary: '#ffffff', short: 'РОД' },
  'камаз': { primary: '#003399', secondary: '#e30613', short: 'КАМ' },
  'черноморец': { primary: '#006699', secondary: '#ffffff', short: 'ЧЕР' },
  'ска-хабаровск': { primary: '#d3202a', secondary: '#002d72', short: 'СКА' },
  'енисей': { primary: '#d3202a', secondary: '#003399', short: 'ЕНИ' },
  'уфа': { primary: '#3b1c55', secondary: '#a8d8b9', short: 'УФА' },
  'нефтехимик': { primary: '#008542', secondary: '#e30613', short: 'НЕФ' },
  'чайка': { primary: '#0055ff', secondary: '#ffffff', short: 'ЧАЙ' },
  'сокол': { primary: '#0080ff', secondary: '#ffffff', short: 'СОК' },
  'амкар': { primary: '#d3202a', secondary: '#111111', short: 'АМК' },
  'ленинградец': { primary: '#0a192f', secondary: '#e30613', short: 'ЛЕН' },
  'велес': { primary: '#66b2ff', secondary: '#800020', short: 'ВЕЛ' },
  'волга ульяновск': { primary: '#ffd200', secondary: '#111111', short: 'ВОЛ' },
  'текстильщик': { primary: '#d3202a', secondary: '#111111', short: 'ТЕК' },
  'химик': { primary: '#00a651', secondary: '#111111', short: 'ХИМ' },
  'челябинск': { primary: '#00a3e0', secondary: '#ffffff', short: 'ЧЕЛ' },
  'астрахань': { primary: '#003399', secondary: '#d3202a', short: 'АСТ' },
  'динамо брянск': { primary: '#004d9c', secondary: '#ffffff', short: 'ДБР' },
  'элиста': { primary: '#ffd200', secondary: '#00a3e0', short: 'ЭЛИ' },
  'спартак кострома': { primary: '#d3202a', secondary: '#ffffff', short: 'СПК' },
  'спартак нальчик': { primary: '#d3202a', secondary: '#008542', short: 'СПН' },
  'спартак владикавказ': { primary: '#d3202a', secondary: '#ffd200', short: 'САЛ' },
  'спартак-алания': { primary: '#d3202a', secondary: '#ffd200', short: 'САЛ' },
  'звезда': { primary: '#b71212', secondary: '#ffffff', short: 'ЗВЕ' },
  'звезда спб': { primary: '#b71212', secondary: '#ffffff', short: 'ЗВЕ' },
  'чертаново': { primary: '#0055ff', secondary: '#ffffff', short: 'ЧЕР' },
  'алания': { primary: '#d3202a', secondary: '#ffd200', short: 'АЛА' },
  'алания владикавказ': { primary: '#d3202a', secondary: '#ffd200', short: 'АЛА' },
  'амкал': { primary: '#d3202a', secondary: '#111111', short: 'АМК' },
  '2drots': { primary: '#ff3366', secondary: '#111111', short: '2DR' },
  'тюмень': { primary: '#111111', secondary: '#ffffff', short: 'ТЮМ' },
  'динамо владивосток': { primary: '#004d9c', secondary: '#ffffff', short: 'ДВЛ' },
  'динамо ставрополь': { primary: '#004d9c', secondary: '#ffd200', short: 'ДСТ' },
  'динамо вологда': { primary: '#004d9c', secondary: '#ffffff', short: 'ДВГ' },
  'динамо спб': { primary: '#004d9c', secondary: '#ffffff', short: 'ДСП' },
  'динамо-спб': { primary: '#004d9c', secondary: '#ffffff', short: 'ДСП' },
  'дружба': { primary: '#008542', secondary: '#ffd200', short: 'ДРУ' },
  'дружба майкоп': { primary: '#008542', secondary: '#ffd200', short: 'ДРУ' },
  'машук-кмв': { primary: '#d3202a', secondary: '#ffffff', short: 'МАШ' },
  'нарт': { primary: '#008542', secondary: '#ffffff', short: 'НАР' },
  'нарт черкесск': { primary: '#008542', secondary: '#ffffff', short: 'НАР' },
  'севастополь': { primary: '#003399', secondary: '#d3202a', short: 'СЕВ' },
  'салют белгород': { primary: '#990000', secondary: '#ffffff', short: 'САЛ' },
  'сатурн': { primary: '#002d72', secondary: '#111111', short: 'САТ' },
  'леон сатурн': { primary: '#002d72', secondary: '#111111', short: 'САТ' },
  'ска ростов': { primary: '#d3202a', secondary: '#003399', short: 'СКР' },
  'иркутск': { primary: '#006633', secondary: '#d3202a', short: 'ИРК' },
  'кубань холдинг': { primary: '#111111', secondary: '#ffffff', short: 'КХ' },
  'кубань-холдинг': { primary: '#111111', secondary: '#ffffff', short: 'КХ' },
  'спартак тамбов': { primary: '#d3202a', secondary: '#ffffff', short: 'СПТ' },
  'космос': { primary: '#001838', secondary: '#e5a823', short: 'КОС' },
  'космос долгопрудный': { primary: '#001838', secondary: '#e5a823', short: 'КОС' },
  'калуга': { primary: '#14385f', secondary: '#b0c4de', short: 'КАЛ' },
  'зенит пенза': { primary: '#00a3e0', secondary: '#ffffff', short: 'ЗПН' },
  'зенит ижевск': { primary: '#0055a5', secondary: '#ffffff', short: 'ЗИЖ' },
  'зенит-ижевск': { primary: '#0055a5', secondary: '#ffffff', short: 'ЗИЖ' },
  'ижевск': { primary: '#0055a5', secondary: '#ffffff', short: 'ЗИЖ' },
  'знамя труда': { primary: '#d3202a', secondary: '#002d72', short: 'ЗНТ' },
  'динамо барнаул': { primary: '#004d9c', secondary: '#ffffff', short: 'ДБР' },
  'победа': { primary: '#d3202a', secondary: '#008542', short: 'ПОБ' },
  'победа хасавюрт': { primary: '#d3202a', secondary: '#008542', short: 'ПОБ' },
  'луки-энергия': { primary: '#d3202a', secondary: '#111111', short: 'ЛУК' },
  'авангард': { primary: '#0055ff', secondary: '#ffffff', short: 'АВК' },
  'авангард курск': { primary: '#0055ff', secondary: '#ffffff', short: 'АВК' },
  'армавир': { primary: '#d3202a', secondary: '#f36f21', short: 'АРМ' },
  'ангушт': { primary: '#008542', secondary: '#ffffff', short: 'АНГ' },
  'сибирь': { primary: '#004d9c', secondary: '#ffffff', short: 'СИБ' },
  'динамо киров': { primary: '#004d9c', secondary: '#ffffff', short: 'ДКИ' },
  'броуки': { primary: '#ff8800', secondary: '#111111', short: 'БРО' },
  'броуки (brokeboys)': { primary: '#ff8800', secondary: '#111111', short: 'БРО' },
  'синдекат': { primary: '#d3202a', secondary: '#111111', short: 'СИН' },
  'банка': { primary: '#ffd200', secondary: '#111111', short: 'БАН' },
  'fight nights': { primary: '#e52b2b', secondary: '#111111', short: 'FN' },
  'prime squad': { primary: '#9900ee', secondary: '#111111', short: 'PRM' },
  'фк 10': { primary: '#ffea00', secondary: '#111111', short: 'ДЕС' },
  'народная команда': { primary: '#d3202a', secondary: '#ffffff', short: 'НАР' },
  'матч тв': { primary: '#d3202a', secondary: '#111111', short: 'МТВ' },
  'lit energy': { primary: '#ff0055', secondary: '#111111', short: 'LIT' },
  'рубин ялта': { primary: '#9d1c24', secondary: '#ffd200', short: 'РБЯ' },
  'тосно': { primary: '#111111', secondary: '#ffd200', short: 'ТОС' },
  'торпедо-2': { primary: '#111111', secondary: '#ffffff', short: 'ТР2' },
  'волгарь': { primary: '#004d9c', secondary: '#ffffff', short: 'ВЛГ' },
  'торпедо миасс': { primary: '#111111', secondary: '#ffffff', short: 'ТРМ' },
  'муром': { primary: '#d3202a', secondary: '#ffffff', short: 'МУР' },
  'балтика-бфу': { primary: '#002d72', secondary: '#009cde', short: 'БФУ' },
  'волна': { primary: '#008542', secondary: '#ffd200', short: 'ВОЛ' },
  'эгриси': { primary: '#ffcc00', secondary: '#111111', short: 'ЭГР' },
  'чисто питер': { primary: '#002b66', secondary: '#ffffff', short: 'ЧСП' },
  'rocket team': { primary: '#111111', secondary: '#ffffff', short: 'RKT' },
  'рокет тим': { primary: '#111111', secondary: '#ffffff', short: 'RKT' },
  'сборная россии': { primary: '#b91c1c', secondary: '#ffffff', short: 'РОС' },
  'сборная': { primary: '#b91c1c', secondary: '#ffffff', short: 'РОС' },
  'россия': { primary: '#b91c1c', secondary: '#ffffff', short: 'РОС' }
};

// Вспомогательная функция кодирования SVG в Data URI
export function svgToDataUri(svg: string): string {
  const cleaned = svg.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

// Генератор геральдического SVG-логотипа для пользовательских клубов
export function generateDynamicLogo(name: string, comp = 'rpl'): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);

  const words = name.trim().split(/\s+/);
  let short = '';
  if (words.length >= 2) {
    short = (words[0][0] + words[1][0]).toUpperCase();
  } else if (name.length >= 3) {
    short = name.slice(0, 3).toUpperCase();
  } else {
    short = name.toUpperCase();
  }

  const hue = posHash % 360;
  const c1 = `hsl(${hue}, 75%, 32%)`;
  const c2 = `hsl(${hue}, 85%, 18%)`;
  const accent = `hsl(${(hue + 40) % 360}, 90%, 55%)`;

  const shieldTypes = [
    'M 50,12 L 86,28 L 78,84 L 50,92 L 22,84 L 14,28 Z',
    'M 18,14 L 82,14 L 82,56 C 82,78 50,92 50,92 C 50,92 18,78 18,56 Z',
    'M 20,16 L 80,16 C 84,36 84,64 50,90 C 16,64 16,36 20,16 Z',
    'M 50,14 L 86,50 L 50,86 L 14,50 Z'
  ];
  const shield = shieldTypes[posHash % shieldTypes.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="dynSh_${posHash}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <path d="${shield}" fill="url(#dynSh_${posHash})" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="${shield}" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.8"/>
  <polygon points="50,18 52,22 57,22.5 53,25.5 54.5,30 50,27 45.5,30 47,25.5 43,22.5 48,22" fill="${accent}"/>
  <text x="50" y="58" text-anchor="middle" font-family="'Unbounded', sans-serif" font-weight="900" font-size="${short.length > 2 ? 14 : 17}" fill="#ffffff" letter-spacing="1">${short}</text>
  <circle cx="50" cy="74" r="5" fill="#ffffff" stroke="${c2}" stroke-width="1"/>
</svg>`;

  return svgToDataUri(svg);
}

// Словарь стилей клубов
export const PRESET_LOGOS: Record<string, ClubStyle> = {};

// Инициализируем PRESET_LOGOS для известных клубов
for (const [key, logoPath] of Object.entries(OFFICIAL_LOGOS)) {
  const col = OFFICIAL_COLORS[key] || {
    primary: '#144734',
    secondary: '#ffffff',
    short: key.slice(0, 3).toUpperCase()
  };
  PRESET_LOGOS[key] = {
    logo: logoPath,
    primary: col.primary,
    secondary: col.secondary,
    short: col.short
  };
}

// Получить логотип команды (приоритет: кастомный -> официальный SVG -> спутник/резерв -> динамический геральдический)
export function getTeamLogo(name: string, customLogo?: string | null, comp = 'rpl'): string {
  if (customLogo && customLogo.trim().length > 0) {
    return customLogo.trim();
  }
  const clean = (name || '').trim().toLowerCase();
  if (clean && OFFICIAL_LOGOS[clean]) {
    return OFFICIAL_LOGOS[clean];
  }
  // Отрезаем города в скобках, а также суффиксы -2, -3, -м, -бфу (например «Ростов-2» -> «ростов»)
  const base = clean
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[-–\s]+(2|3|м|бфу)$/i, '')
    .trim();
  if (base && OFFICIAL_LOGOS[base]) {
    return OFFICIAL_LOGOS[base];
  }
  for (const [key, path] of Object.entries(OFFICIAL_LOGOS)) {
    if (clean === key || clean.startsWith(key + ' ') || clean.endsWith(' ' + key) || (base && (base === key || base.startsWith(key + ' ')))) {
      return path;
    }
  }
  for (const [key, path] of Object.entries(OFFICIAL_LOGOS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return path;
    }
  }
  return generateDynamicLogo(name || 'Клуб', comp);
}

// Получить фирменные цвета команды
export function getTeamColors(name: string): { primary: string; secondary: string } {
  const clean = (name || '').trim().toLowerCase();
  if (clean && OFFICIAL_COLORS[clean]) {
    return { primary: OFFICIAL_COLORS[clean].primary, secondary: OFFICIAL_COLORS[clean].secondary };
  }
  for (const [key, col] of Object.entries(OFFICIAL_COLORS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return { primary: col.primary, secondary: col.secondary };
    }
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    primary: `hsl(${hue}, 70%, 40%)`,
    secondary: `hsl(${(hue + 45) % 360}, 80%, 60%)`
  };
}
