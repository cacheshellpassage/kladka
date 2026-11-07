/**
 * Human-readable item/block names (ru/en), written for this project.
 * English is derived from ids; Russian uses a small hand-written dictionary plus composition rules
 * (wood/colour adjectives agree with the gender of the noun).
 */
import { shortId } from "../../model/blockstate";

export type Locale = "ru" | "en";

export function englishName(item: string): string {
  return shortId(item)
    .split("_")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

type G = "m" | "f" | "n" | "pl";
type Adj = Record<G, string> | { postfix: string };

const a = (stem: string, soft = false): Adj => ({
  m: stem + (soft ? "ий" : "ый"),
  f: stem + (soft ? "яя" : "ая"),
  n: stem + (soft ? "ее" : "ое"),
  pl: stem + (soft ? "ие" : "ые"),
});

const WOOD_ADJ: Record<string, Adj> = {
  oak: a("Дубов"),
  spruce: a("Елов"),
  birch: a("Берёзов"),
  jungle: { m: "Тропический", f: "Тропическая", n: "Тропическое", pl: "Тропические" },
  acacia: a("Акациев"),
  dark_oak: { postfix: "из тёмного дуба" },
  mangrove: a("Мангров"),
  cherry: a("Вишнёв"),
  bamboo: a("Бамбуков"),
  crimson: a("Багров"),
  warped: { m: "Искажённый", f: "Искажённая", n: "Искажённое", pl: "Искажённые" },
  pale_oak: { postfix: "из бледного дуба" },
  poplar: a("Тополин"),
};

const COLOR_ADJ: Record<string, Adj> = {
  white: a("Бел"),
  orange: a("Оранжев"),
  magenta: a("Сиренев"),
  light_blue: a("Голуб", false),
  yellow: { m: "Жёлтый", f: "Жёлтая", n: "Жёлтое", pl: "Жёлтые" },
  lime: a("Лаймов"),
  pink: a("Розов"),
  gray: a("Сер"),
  light_gray: a("Светло-сер"),
  cyan: a("Бирюзов"),
  purple: a("Фиолетов"),
  blue: { m: "Синий", f: "Синяя", n: "Синее", pl: "Синие" },
  brown: a("Коричнев"),
  green: { m: "Зелёный", f: "Зелёная", n: "Зелёное", pl: "Зелёные" },
  red: a("Красн"),
  black: { m: "Чёрный", f: "Чёрная", n: "Чёрное", pl: "Чёрные" },
};
COLOR_ADJ.light_blue = { m: "Голубой", f: "Голубая", n: "Голубое", pl: "Голубые" };

const WOOD_NOUN: Record<string, [string, G]> = {
  planks: ["доски", "pl"],
  stairs: ["ступени", "pl"],
  slab: ["плита", "f"],
  fence: ["забор", "m"],
  fence_gate: ["калитка", "f"],
  door: ["дверь", "f"],
  trapdoor: ["люк", "m"],
  button: ["кнопка", "f"],
  pressure_plate: ["нажимная плита", "f"],
  sign: ["табличка", "f"],
  hanging_sign: ["подвесная табличка", "f"],
  log: ["бревно", "n"],
  wood: ["древесина", "f"],
  stem: ["стебель", "m"],
  hyphae: ["гифы", "pl"],
  leaves: ["листва", "f"],
  sapling: ["саженец", "m"],
  shelf: ["полка", "f"],
};

const COLOR_NOUN: Record<string, [string, G]> = {
  wool: ["шерсть", "f"],
  carpet: ["ковёр", "m"],
  concrete: ["бетон", "m"],
  concrete_powder: ["сухой бетон", "m"],
  terracotta: ["керамика", "f"],
  glazed_terracotta: ["глазурованная керамика", "f"],
  stained_glass: ["окрашенное стекло", "n"],
  stained_glass_pane: ["окрашенная стеклянная панель", "f"],
  bed: ["кровать", "f"],
  banner: ["флаг", "m"],
  candle: ["свеча", "f"],
  shulker_box: ["шалкеровый ящик", "m"],
  wool_stairs: ["шерстяные ступени", "pl"],
  wool_slab: ["шерстяная плита", "f"],
  concrete_stairs: ["бетонные ступени", "pl"],
  concrete_slab: ["бетонная плита", "f"],
};

const RU: Record<string, string> = {
  stone: "Камень",
  smooth_stone: "Гладкий камень",
  cobblestone: "Булыжник",
  mossy_cobblestone: "Замшелый булыжник",
  stone_bricks: "Каменные кирпичи",
  mossy_stone_bricks: "Замшелые каменные кирпичи",
  cracked_stone_bricks: "Потрескавшиеся каменные кирпичи",
  chiseled_stone_bricks: "Резные каменные кирпичи",
  andesite: "Андезит",
  polished_andesite: "Полированный андезит",
  diorite: "Диорит",
  polished_diorite: "Полированный диорит",
  granite: "Гранит",
  polished_granite: "Полированный гранит",
  deepslate: "Глубинный сланец",
  cobbled_deepslate: "Глубинный булыжник",
  polished_deepslate: "Полированный глубинный сланец",
  deepslate_bricks: "Глубинносланцевые кирпичи",
  deepslate_tiles: "Глубинносланцевая плитка",
  tuff: "Туф",
  tuff_bricks: "Туфовые кирпичи",
  polished_tuff: "Полированный туф",
  calcite: "Кальцит",
  blackstone: "Чернит",
  polished_blackstone: "Полированный чернит",
  polished_blackstone_bricks: "Кирпичи из полированного чернита",
  sandstone: "Песчаник",
  cut_sandstone: "Резной песчаник",
  smooth_sandstone: "Гладкий песчаник",
  chiseled_sandstone: "Узорчатый песчаник",
  red_sandstone: "Красный песчаник",
  smooth_red_sandstone: "Гладкий красный песчаник",
  bricks: "Кирпичи",
  mud_bricks: "Глиняные кирпичи",
  packed_mud: "Утрамбованная грязь",
  nether_bricks: "Незерские кирпичи",
  red_nether_bricks: "Красные незерские кирпичи",
  quartz_block: "Кварцевый блок",
  smooth_quartz: "Гладкий кварц",
  quartz_pillar: "Кварцевая колонна",
  quartz_bricks: "Кварцевые кирпичи",
  prismarine: "Призмарин",
  prismarine_bricks: "Призмариновые кирпичи",
  dark_prismarine: "Тёмный призмарин",
  purpur_block: "Пурпурный блок",
  purpur_pillar: "Пурпурная колонна",
  end_stone_bricks: "Кирпичи из камня Края",
  terracotta: "Керамика",
  clay: "Глина",
  dirt: "Земля",
  coarse_dirt: "Каменистая земля",
  grass_block: "Блок травы",
  podzol: "Подзол",
  mud: "Грязь",
  sand: "Песок",
  red_sand: "Красный песок",
  gravel: "Гравий",
  snow_block: "Снежный блок",
  snow: "Снег",
  ice: "Лёд",
  packed_ice: "Плотный лёд",
  glass: "Стекло",
  glass_pane: "Стеклянная панель",
  tinted_glass: "Тонированное стекло",
  iron_bars: "Железная решётка",
  iron_door: "Железная дверь",
  iron_trapdoor: "Железный люк",
  iron_block: "Железный блок",
  gold_block: "Золотой блок",
  copper_block: "Медный блок",
  cut_copper: "Резная медь",
  chain: "Цепь",
  iron_chain: "Железная цепь",
  lantern: "Фонарь",
  soul_lantern: "Фонарь душ",
  torch: "Факел",
  soul_torch: "Факел душ",
  redstone_torch: "Редстоуновый факел",
  glowstone: "Светокамень",
  sea_lantern: "Морской фонарь",
  shroomlight: "Грибосвет",
  redstone_lamp: "Редстоуновая лампа",
  jack_o_lantern: "Светильник Джека",
  campfire: "Костёр",
  candle: "Свеча",
  end_rod: "Стержень Края",
  ladder: "Лестница",
  scaffolding: "Строительные леса",
  bookshelf: "Книжная полка",
  chiseled_bookshelf: "Резная книжная полка",
  crafting_table: "Верстак",
  furnace: "Печь",
  smoker: "Коптильня",
  blast_furnace: "Плавильная печь",
  chest: "Сундук",
  trapped_chest: "Сундук-ловушка",
  barrel: "Бочка",
  anvil: "Наковальня",
  cauldron: "Котёл",
  lectern: "Кафедра",
  loom: "Ткацкий станок",
  composter: "Компостница",
  cartography_table: "Стол картографа",
  fletching_table: "Стол лучника",
  smithing_table: "Кузнечный стол",
  stonecutter: "Камнерез",
  grindstone: "Точило",
  enchanting_table: "Стол зачарования",
  brewing_stand: "Варочная стойка",
  jukebox: "Проигрыватель",
  note_block: "Нотный блок",
  bell: "Колокол",
  hay_block: "Сноп сена",
  straw_block: "Блок соломы",
  pumpkin: "Тыква",
  carved_pumpkin: "Вырезанная тыква",
  melon: "Арбуз",
  flower_pot: "Цветочный горшок",
  water_bucket: "Ведро воды",
  lava_bucket: "Ведро лавы",
  lily_pad: "Кувшинка",
  vine: "Лианы",
  cobweb: "Паутина",
  short_grass: "Трава",
  fern: "Папоротник",
  tall_grass: "Высокая трава",
  large_fern: "Большой папоротник",
  dandelion: "Одуванчик",
  poppy: "Мак",
  blue_orchid: "Синяя орхидея",
  allium: "Лук-резанец",
  azure_bluet: "Хаустония серая",
  oxeye_daisy: "Нивяник",
  cornflower: "Василёк",
  lily_of_the_valley: "Ландыш",
  sunflower: "Подсолнух",
  lilac: "Сирень",
  rose_bush: "Розовый куст",
  peony: "Пион",
  sugar_cane: "Сахарный тростник",
  wheat_seeds: "Семена пшеницы",
  carrot: "Морковь",
  potato: "Картофель",
  beetroot_seeds: "Семена свёклы",
  farmland: "Грядка",
  dirt_path: "Тропинка",
  moss_block: "Блок мха",
  moss_carpet: "Моховой ковёр",
  bamboo_mosaic: "Бамбуковая мозаика",
  bamboo_block: "Блок бамбука",
  obsidian: "Обсидиан",
  azalea_leaves: "Листва азалии",
  flowering_azalea_leaves: "Цветущая листва азалии",
  stone_button: "Каменная кнопка",
  lever: "Рычаг",
  rail: "Рельсы",
  white_wool: "Белая шерсть",
  cake: "Торт",
  red_shrub: "Красный кустарник",
  shelf_mushroom: "Трутовик",
};

const SHAPE_RU: Record<string, string> = {
  stairs: "Ступени",
  slab: "Плита",
  wall: "Ограда",
};

function adjForm(adj: Adj, g: G, noun: string): string {
  if ("postfix" in adj) return `${capitalize(noun)} ${adj.postfix}`;
  return `${adj[g]} ${noun}`;
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export function russianName(item: string): string {
  const s = shortId(item);
  if (RU[s]) return RU[s]!;

  const stripped = s.startsWith("stripped_") ? s.slice(9) : null;
  const target = stripped ?? s;
  for (const [w, adj] of Object.entries(WOOD_ADJ)) {
    if (!target.startsWith(w + "_")) continue;
    const rest = target.slice(w.length + 1);
    const noun = WOOD_NOUN[rest];
    if (noun) {
      const name = adjForm(adj, noun[1], noun[0]);
      if (!stripped) return name;
      const pre = { m: "Обтёсанный", f: "Обтёсанная", n: "Обтёсанное", pl: "Обтёсанные" }[noun[1]];
      return `${pre} ${name[0]!.toLowerCase()}${name.slice(1)}`;
    }
  }
  for (const [c, adj] of Object.entries(COLOR_ADJ)) {
    if (!s.startsWith(c + "_")) continue;
    const rest = s.slice(c.length + 1);
    // avoid matching "light_gray" as "light" etc.: COLOR_ADJ keys are full colour names
    const noun = COLOR_NOUN[rest];
    if (noun) return adjForm(adj, noun[1], noun[0]);
  }
  const m = /^(.*)_(stairs|slab|wall)$/.exec(s);
  if (m) {
    const baseName = russianName(m[1]!.replace(/_brick$/, "_bricks").replace(/_tile$/, "_tiles"));
    return `${SHAPE_RU[m[2]!]} (${baseName.toLowerCase()})`;
  }
  return englishName(s);
}

export function itemName(item: string, locale: Locale): string {
  return locale === "ru" ? russianName(item) : englishName(item);
}
