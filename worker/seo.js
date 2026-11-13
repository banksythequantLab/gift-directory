import { expertNote } from "./expert.js";
// Long-tail gift guides at gift.directory/gifts/<slug>: one keyword per page, real products from
// Channel3 with AI reasons, a short guide and FAQ written once and stored, server-rendered for crawlers.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = c => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const P = (slug, keyword, recipient, occasion, budget, opts = {}) => ({ slug, keyword, recipient, occasion, budget_cents: budget * 100, ...opts });

// General (not profession) pages keep profession novelty items out, e.g. a "Trust me, I'm a lawyer" candle on "gifts for her".
const NICHE_NOVELTY = ["lawyer", "attorney", "nurse", "teacher", "doctor"];
// Gaming pages: no gift cards or download codes, no internal PC parts.
const GAMING_EXCLUDE = ["gift card", "digital code", "download code", "fan unit", "case fan", "rf-u", "power supply", "thermal paste", "motherboard", "replacement part"];
// Kids pages: nothing adult, no gift cards.
const KIDS_EXCLUDE = ["wine", "beer", "whiskey", "bourbon", "cocktail", "shot glass", "vape", "lingerie", "adult", "knife", "gift card", "for men", "for women", "18+"];

// Anniversary gifts by year, traditional and modern themes (the common US lists). Each page searches four
// gift ideas per theme, one product per idea, and the AI picks the best of each and says why.
const ANNIVERSARIES = [
  [1, "paper", "clocks", 100, ["personalized night sky star map", "personalized photo book", "leather bound journal", "framed vintage map print"], ["wooden desk clock", "engraved mantel clock", "personalized wall clock", "sunrise alarm clock"]],
  [2, "cotton", "china", 100, ["personalized cotton throw blanket", "cotton waffle robe set", "organic cotton sheet set", "embroidered cotton pillowcase"], ["porcelain tea set", "fine china serving platter", "porcelain mug set", "porcelain vase"]],
  [3, "leather", "crystal and glass", 150, ["personalized leather wallet", "leather weekender bag", "leather watch strap", "leather photo album"], ["crystal wine glasses set", "crystal whiskey decanter set", "glass terrarium", "crystal vase"]],
  [4, "fruit and flowers (linen and silk)", "appliances", 150, ["preserved roses in glass dome", "silk pillowcase set", "linen tablecloth", "fruit tree gift"], ["espresso machine", "air fryer", "smart display", "robot vacuum"]],
  [5, "wood", "silverware", 150, ["personalized wooden cutting board", "wooden watch", "wooden jewelry box", "engraved wooden photo frame"], ["silverware set", "silver plated serving set", "silver cocktail shaker set", "silver picture frame"]],
  [6, "iron (and candy)", "wood", 150, ["cast iron skillet set", "cast iron dutch oven", "wrought iron wall art", "gourmet candy gift box"], ["wooden wine box", "wooden serving board", "wooden bookends", "personalized wooden sign"]],
  [7, "wool and copper", "desk sets", 150, ["merino wool throw blanket", "wool blend scarf", "copper moscow mule mugs", "copper cookware"], ["leather desk pad", "executive desk organizer set", "engraved pen set", "desk clock and pen holder"]],
  [8, "bronze", "linens and lace", 150, ["bronze sculpture", "bronze candle holders", "bronze wind chime", "bronze bookends"], ["linen bedding set", "linen robe", "lace table runner", "embroidered linen napkins"]],
  [9, "pottery (and willow)", "leather", 150, ["handmade ceramic mug set", "stoneware dinnerware set", "pottery vase", "willow picnic basket"], ["leather tote bag", "leather jewelry case", "leather wallet", "leather passport holder"]],
  [10, "tin and aluminum", "diamond jewelry", 300, ["tin anniversary keepsake", "aluminum photo print", "vintage tin sign", "personalized metal map art"], ["diamond pendant necklace", "diamond stud earrings", "diamond tennis bracelet", "diamond band ring"]],
  [11, "steel", "fashion jewelry", 200, ["stainless steel watch", "steel engraved bracelet", "steel cocktail set", "steel wall art"], ["statement necklace", "charm bracelet", "gold hoop earrings", "fashion ring set"]],
  [12, "silk and linen", "pearls", 200, ["silk scarf", "silk pajama set", "linen sheet set", "silk eye mask and pillowcase set"], ["pearl necklace", "pearl stud earrings", "pearl bracelet", "pearl cufflinks"]],
  [13, "lace", "textiles and furs", 200, ["lace lingerie set", "lace table runner", "lace robe", "lace trimmed throw pillow"], ["faux fur throw blanket", "cashmere wrap", "faux fur slippers", "chunky knit blanket"]],
  [14, "ivory (ivory-colored, never real ivory)", "gold jewelry", 250, ["ivory cashmere sweater", "ivory ceramic vase", "ivory silk robe", "ivory candle set"], ["gold pendant necklace", "gold hoop earrings", "gold bracelet", "gold signet ring"]],
  [15, "crystal", "watches", 300, ["crystal decanter set", "crystal champagne flutes", "crystal bowl", "crystal photo frame"], ["automatic watch", "his and hers watch set", "smartwatch", "watch winder box"]],
  [20, "china", "platinum", 300, ["fine china dinnerware set", "china teapot set", "porcelain figurine", "china serving bowl"], ["platinum plated necklace", "platinum ring", "platinum cufflinks", "platinum plated bracelet"]],
  [25, "silver", "silver", 300, ["sterling silver necklace", "silver photo frame", "silver serving tray", "silver cufflinks"], ["silver watch", "sterling silver bracelet", "silver candlesticks", "engraved silver keepsake box"]],
  [30, "pearl", "diamond", 400, ["pearl necklace", "pearl earrings", "mother of pearl jewelry box", "pearl bracelet"], ["diamond earrings", "diamond pendant", "diamond anniversary band", "diamond bracelet"]],
  [40, "ruby", "ruby", 400, ["ruby pendant necklace", "ruby stud earrings", "ruby red crystal glasses", "ruby ring"], ["ruby bracelet", "red ruby glass vase", "ruby cufflinks", "ruby red cashmere scarf"]],
  [50, "gold", "gold", 500, ["gold pendant necklace", "gold watch", "gold rimmed champagne flutes", "gold photo frame"], ["gold bracelet", "gold cufflinks", "gold earrings", "gold anniversary ornament"]],
];
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const plainTheme = t => t.replace(/\s*\(.*\)$/, "");
const ANNIVERSARY_PAGES = ANNIVERSARIES.map(([y, trad, modern, budget, tradSlots, modernSlots]) => {
  const same = plainTheme(trad) === plainTheme(modern);
  return P(`${ordinal(y)}-anniversary-gifts`,
    same ? `${ordinal(y)} anniversary gifts (${plainTheme(trad)})` : `${ordinal(y)} anniversary gifts: ${plainTheme(trad)} (traditional) and ${plainTheme(modern)} (modern)`,
    "my spouse or partner", `${ordinal(y)} wedding anniversary`, budget, { topic: "Anniversaries", count: 8, minCount: 6, anniversary: { year: y, traditional: trad, modern },
      slots: [...tradSlots, ...modernSlots],
      slotGroups: same ? null : [...tradSlots.map(() => `Traditional: ${plainTheme(trad)}`), ...modernSlots.map(() => `Modern: ${plainTheme(modern)}`)],
      exclude: ["genuine ivory", "real ivory", "elephant ivory", "bone ivory"],
      notes: `the ${ordinal(y)} anniversary: the traditional gift is ${trad}; the modern gift is ${modern}. Explain both themes and give creative ideas for each; the first four products follow the traditional theme, the last four the modern one` });
});

// Team fan pages: one per NFL, MLB, NBA and NHL team. Every product must name the team (`require`), so a
// Giants page never shows the other Giants. Nicknames two teams share use the full name in slug and filter.
const TEAMS = {
  NFL: ["Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills", "Carolina Panthers", "Chicago Bears", "Cincinnati Bengals", "Cleveland Browns",
    "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers", "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Kansas City Chiefs",
    "Las Vegas Raiders", "Los Angeles Chargers", "Los Angeles Rams", "Miami Dolphins", "Minnesota Vikings", "New England Patriots", "New Orleans Saints", "New York Giants",
    "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers", "San Francisco 49ers", "Seattle Seahawks", "Tampa Bay Buccaneers", "Tennessee Titans", "Washington Commanders"],
  MLB: ["Arizona Diamondbacks", "Atlanta Braves", "Baltimore Orioles", "Boston Red Sox", "Chicago Cubs", "Chicago White Sox", "Cincinnati Reds", "Cleveland Guardians",
    "Colorado Rockies", "Detroit Tigers", "Houston Astros", "Kansas City Royals", "Los Angeles Angels", "Los Angeles Dodgers", "Miami Marlins", "Milwaukee Brewers",
    "Minnesota Twins", "New York Mets", "New York Yankees", "Athletics", "Philadelphia Phillies", "Pittsburgh Pirates", "San Diego Padres", "San Francisco Giants",
    "Seattle Mariners", "St. Louis Cardinals", "Tampa Bay Rays", "Texas Rangers", "Toronto Blue Jays", "Washington Nationals"],
  NBA: ["Atlanta Hawks", "Boston Celtics", "Brooklyn Nets", "Charlotte Hornets", "Chicago Bulls", "Cleveland Cavaliers", "Dallas Mavericks", "Denver Nuggets",
    "Detroit Pistons", "Golden State Warriors", "Houston Rockets", "Indiana Pacers", "LA Clippers", "Los Angeles Lakers", "Memphis Grizzlies", "Miami Heat",
    "Milwaukee Bucks", "Minnesota Timberwolves", "New Orleans Pelicans", "New York Knicks", "Oklahoma City Thunder", "Orlando Magic", "Philadelphia 76ers", "Phoenix Suns",
    "Portland Trail Blazers", "Sacramento Kings", "San Antonio Spurs", "Toronto Raptors", "Utah Jazz", "Washington Wizards"],
  NHL: ["Anaheim Ducks", "Boston Bruins", "Buffalo Sabres", "Calgary Flames", "Carolina Hurricanes", "Chicago Blackhawks", "Colorado Avalanche", "Columbus Blue Jackets",
    "Dallas Stars", "Detroit Red Wings", "Edmonton Oilers", "Florida Panthers", "Los Angeles Kings", "Minnesota Wild", "Montreal Canadiens", "Nashville Predators",
    "New Jersey Devils", "New York Islanders", "New York Rangers", "Ottawa Senators", "Philadelphia Flyers", "Pittsburgh Penguins", "San Jose Sharks", "Seattle Kraken",
    "St. Louis Blues", "Tampa Bay Lightning", "Toronto Maple Leafs", "Utah Mammoth", "Vancouver Canucks", "Vegas Golden Knights", "Washington Capitals", "Winnipeg Jets"],
  WNBA: ["Atlanta Dream", "Chicago Sky", "Connecticut Sun", "Dallas Wings", "Golden State Valkyries", "Indiana Fever", "Las Vegas Aces", "Los Angeles Sparks",
    "Minnesota Lynx", "New York Liberty", "Phoenix Mercury", "Seattle Storm", "Washington Mystics", "Portland Fire", "Toronto Tempo"],
  // [page name, other spellings product titles use]
  MLS: ["Atlanta United", "Austin FC", ["CF Montréal", "CF Montreal"], "Charlotte FC", "Chicago Fire", "FC Cincinnati", "Colorado Rapids", "Columbus Crew",
    ["D.C. United", "DC United"], "FC Dallas", "Houston Dynamo", "Inter Miami", "LA Galaxy", ["LAFC", "Los Angeles FC"], "Minnesota United", "Nashville SC",
    "New England Revolution", "New York City FC", "New York Red Bulls", "Orlando City", "Philadelphia Union", "Portland Timbers", "Real Salt Lake", "San Diego FC",
    "San Jose Earthquakes", "Seattle Sounders", "Sporting Kansas City", ["St. Louis City SC", "St. Louis City", "St Louis City", "STL City"], "Toronto FC", "Vancouver Whitecaps"],
  College: ["Alabama Crimson Tide", "Ohio State Buckeyes", "Michigan Wolverines", "Georgia Bulldogs", "Texas Longhorns", "LSU Tigers", "Notre Dame Fighting Irish",
    "Penn State Nittany Lions", "Clemson Tigers", "Oklahoma Sooners", "Florida Gators", "Tennessee Volunteers", "Auburn Tigers", "Oregon Ducks", "USC Trojans",
    "Texas A&M Aggies", "Wisconsin Badgers", "Nebraska Cornhuskers", "Iowa Hawkeyes", "Florida State Seminoles", "Miami Hurricanes", "Duke Blue Devils",
    "North Carolina Tar Heels", "Kentucky Wildcats", "Kansas Jayhawks", "Michigan State Spartans", "Arkansas Razorbacks", "Ole Miss Rebels", "UCLA Bruins", "Virginia Tech Hokies"],
  // World soccer clubs. Names that are also ordinary words (Chelsea boots, Ajax cleaner, Celtic knots) carry the club suffix.
  Clubs: ["Arsenal", ["Chelsea FC", "Chelsea F.C."], ["Liverpool FC", "Liverpool F.C.", "LFC"], ["Manchester City", "Man City"], ["Manchester United", "Man Utd", "Man United"],
    ["Tottenham Hotspur", "Tottenham"], "Newcastle United", "Aston Villa", ["West Ham United", "West Ham"], "Everton",
    "Real Madrid", ["FC Barcelona", "Barcelona FC", "Barça"], ["Atletico Madrid", "Atlético Madrid", "Atlético de Madrid"],
    ["Bayern Munich", "FC Bayern", "Bayern München"], ["Borussia Dortmund", "BVB"], "Juventus", "AC Milan", ["Inter Milan", "Internazionale"], ["Napoli", "SSC Napoli"], "AS Roma",
    ["Paris Saint-Germain", "Paris Saint Germain", "PSG"], ["AFC Ajax", "Ajax Amsterdam"], "Benfica", "FC Porto", ["Celtic FC", "Celtic F.C.", "Glasgow Celtic"],
    ["Rangers FC", "Glasgow Rangers"], "Galatasaray", "Boca Juniors", "River Plate", ["Club América", "Club America"], ["Chivas", "Chivas de Guadalajara"]],
  // National teams: the page and searches say "<country> soccer"; the filter needs the country in the title.
  National: [["USMNT", "U.S. Soccer", "US Soccer", "USA Soccer", "United States National Team"], ["USWNT", "U.S. Soccer", "US Soccer", "USA Soccer"],
    "Mexico", "Argentina", "Brazil", "England", "France", "Germany", "Spain", "Portugal", "Italy", "Netherlands", "Canada", "Japan", "Colombia",
    "Belgium", "Croatia", "Uruguay", "Morocco", "South Korea", "Scotland"],
};
const LEAGUE = {
  NFL: { strict: true, sport: "football", slots: ["jersey", "hoodie", "knit beanie", "throw blanket", "coffee mug", "Christmas ornament", "wall sign"] },
  MLB: { strict: true, sport: "baseball", slots: ["jersey", "fitted cap", "hoodie", "throw blanket", "coffee mug", "Christmas ornament", "wall sign"] },
  NBA: { strict: true, sport: "basketball", slots: ["jersey", "hoodie", "snapback hat", "throw blanket", "coffee mug", "Christmas ornament", "mini basketball"] },
  NHL: { strict: true, sport: "hockey", slots: ["jersey", "hoodie", "knit beanie", "throw blanket", "coffee mug", "Christmas ornament", "wall sign"] },
  WNBA: { sport: "basketball", min: 4, strict: true, slots: ["jersey", "hoodie", "hat", "t-shirt", "coffee mug", "throw blanket", "mini basketball"] },
  MLS: { sport: "soccer", min: 4, strict: true, slots: ["jersey", "scarf", "hoodie", "knit beanie", "throw blanket", "coffee mug", "soccer ball"] },
  College: { strict: true, sport: "college sports", topic: "College fans", slots: ["hoodie", "football jersey", "knit beanie", "throw blanket", "coffee mug", "Christmas ornament", "wall sign"] },
  Clubs: { sport: "soccer (football)", topic: "Soccer clubs", min: 4, strict: true, slots: ["jersey", "scarf", "hoodie", "knit beanie", "throw blanket", "mug", "soccer ball"] },
  National: { sport: "international soccer (football)", topic: "National soccer teams", min: 4, strict: true, exclude: ["New England", "Patriots", "Canada Goose", "Brazil nut", "rugby", "cricket", "starbucks"], label: n => /^US[MW]NT$/.test(n) ? n : `${n} soccer`,
    slots: ["soccer jersey", "soccer scarf", "soccer hoodie", "soccer hat", "soccer ball", "national team flag", "soccer t-shirt"] },
};
// The team's short name: the last word, or the last two for names like "Red Sox", "Blue Jays", "Maple Leafs".
const TWO_WORD = ["Red Sox", "White Sox", "Blue Jays", "Trail Blazers", "Maple Leafs", "Red Wings", "Blue Jackets", "Golden Knights"];
export const teamNick = full => TWO_WORD.find(t => full.endsWith(" " + t)) || full.split(" ").pop();
const slugify = s => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const teamName = t => Array.isArray(t) ? t[0] : t;
const ALL_TEAMS = Object.values(TEAMS).flat().map(teamName);
const SHARED_NICK = new Set(ALL_TEAMS.map(teamNick).filter((n, i, a) => a.indexOf(n) !== i));
// Many nicknames are ordinary words (Heat, Jazz, Chargers, Penguins, Athletics), so pages and the product
// filter use the full team name; "St." and "LA"/"Los Angeles" spellings both count.
const teamSpellings = full => [...new Set([full, full.replace("St. ", "St "), full.replace(/^LA /, "Los Angeles "), full.replace(/^Los Angeles (Clippers)$/, "LA $1")])];
// Words a product title must contain to fill a slot of that kind (strict leagues only).
const SLOT_WORDS = { ornament: ["ornament", "topper"], cap: ["cap", "hat"], sign: ["sign", "banner", "art", "flag", "print", "pennant"], jersey: ["jersey", "shirt", "kit"], scarf: ["scarf"], hoodie: ["hoodie", "hoody", "sweatshirt", "pullover", "zip"],
  hat: ["hat", "cap", "beanie", "knit", "toque", "headwear", "woolie"], beanie: ["beanie", "knit", "toque", "hat", "woolie"], blanket: ["blanket", "throw"],
  mug: ["mug", "tumbler", "cup", "flask"], ball: ["ball"], flag: ["flag", "banner"], "t-shirt": ["t-shirt", "tee"] };
const slotWords = s => { const k = Object.keys(SLOT_WORDS).filter(w => s.toLowerCase().includes(w)).pop(); return k ? SLOT_WORDS[k] : null; };
// Soccer pages also get a few gifts for any soccer fan (shown under their own heading), since licensed
// gear for many clubs is thin in the catalog. These slots skip the team-name rule (`openSlots`).
const SOCCER_EXTRA = [["soccer stadium wall art print", ["wall art", "print", "poster", "canvas"]], ["soccer tactics coaching board", ["tactic", "coach"]], ["soccer history book", ["book"]]];
const SOCCER_LEAGUES = new Set(["MLS", "Clubs", "National"]);
export const TEAM_PAGES = Object.entries(TEAMS).flatMap(([lg, teams]) => teams.map(t => {
  const full = teamName(t), nick = teamNick(full), L = LEAGUE[lg], name = L.label ? L.label(full) : full;
  const extra = SOCCER_LEAGUES.has(lg) ? SOCCER_EXTRA : [], n = L.slots.length;
  return P(`gifts-for-${slugify(name)}-fans`, `Gifts for ${name} fans`, `a ${name} fan`, "Christmas", 100, {
    topic: L.topic || `${lg} fans`, count: n + extra.length, minCount: (L.min || 5) + (extra.length ? 2 : 0), team: { league: lg, full, nick, shared: SHARED_NICK.has(nick) },
    slots: [...L.slots.map(s => `${full} ${s}`), ...extra.map(x => x[0])],
    ...(L.strict ? { slotMust: [...L.slots.map(slotWords), ...extra.map(x => x[1])] } : {}),
    ...(extra.length ? { openSlots: extra.map((_, k) => n + k), slotGroups: [...L.slots.map(() => `${name} gear`), ...extra.map(() => "For any soccer fan")] } : {}),
    require: [...new Set([...teamSpellings(full), ...(Array.isArray(t) ? t.slice(1) : [])])],
    exclude: ["gift card", "replica toy gun", "for dogs", "pet ", ...(L.exclude || [])],
    notes: `officially licensed ${full} gear for a ${LEAGUE[lg].sport} fan; every product must be ${full} merchandise` +
      (extra.length ? `, plus a short section of gifts any soccer fan would enjoy (stadium wall art, a tactics board, a soccer history book)` : "") });
}));

// Fantasy, fandom and character pages. Every product title must name the theme (`require`), each slot must be its
// own kind of product (`slotMust`, from the slot's last kind word), and adult items stay out (many fans are kids).
const THEME_WORDS = { ...SLOT_WORDS, plush: ["plush", "stuffed", "plushie", "pillow"], light: ["light", "lamp"], lamp: ["lamp", "light"],
  necklace: ["necklace", "pendant"], earrings: ["earring"], socks: ["sock"], slippers: ["slipper"], puzzle: ["puzzle"], planter: ["planter", "pot"],
  "tote bag": ["bag", "tote"], book: ["book", "novel", "guide", "handbook"], figurine: ["figurine", "statue", "figure", "sculpture"],
  statue: ["statue", "figurine", "sculpture", "gnome"], lego: ["lego"], "funko pop": ["funko", "pop!"], poster: ["poster", "print", "art"],
  "wall art": ["framed", "canvas", "wall art", "wall decor", "art print", "wall poster"], "graphic novel": ["graphic novel", "omnibus", "book", "vol.", "volume", "library", "collection"], "dice set": ["dice"],
  "dice tower": ["tower"], "dice tray": ["tray"], miniature: ["miniature", "mini", "figure"], "costume": ["costume"], ornament: ["ornament"] };
const themeWords = s => { const k = Object.keys(THEME_WORDS).filter(w => s.toLowerCase().includes(w)).sort((a, b) => s.toLowerCase().lastIndexOf(b) - s.toLowerCase().lastIndexOf(a) || b.length - a.length)[0]; return k ? THEME_WORDS[k] : null; };
const FAN_EXCLUDE = ["vibrator", "adult toy", "sexy", "lingerie", "wine", "shot glass", "vape", "bong", "rolling paper", "gift card", "nsfw"];
const T = (slug, keyword, recipient, budget, topic, require, slots, extra = {}) => P(slug, keyword, recipient, "Christmas", budget, {
  topic, count: slots.length, minCount: 5, require, slots, slotMust: slots.map(themeWords), ...extra, exclude: [...FAN_EXCLUDE, ...(topic === "Superheroes" ? ["t-shirt", "tee shirt", " tee", "trucker hat", "9fifty", "snapback", "pull over", "pullover", "sweatshirt", "crewneck"] : []), ...(extra.exclude || [])] });
export const THEME_PAGES = [
  T("gifts-for-unicorn-lovers", "Gifts for unicorn lovers", "someone who loves unicorns", 60, "Fantasy & fandoms", ["unicorn"],
    ["unicorn plush", "unicorn mug", "unicorn night light", "unicorn necklace", "unicorn blanket", "unicorn slippers", "unicorn puzzle"]),
  T("gifts-for-frog-lovers", "Gifts for frog lovers", "someone who loves frogs", 50, "Fantasy & fandoms", ["frog"],
    ["frog plush", "frog mug", "frog planter", "frog socks", "frog lamp", "frog earrings", "frog tote bag"], { exclude: ["frogg toggs", "frog tape"] }),
  T("gifts-for-fairy-lovers", "Gifts for fairy lovers", "someone who loves fairies", 60, "Fantasy & fandoms", ["fairy", "fairies", "faerie"],
    ["fairy garden house", "fairy figurine", "fairy necklace", "fairy night light", "fairy book", "fairy wings costume", "fairy blanket"], { exclude: ["fairy lights", "string lights"] }),
  T("gifts-for-gnome-lovers", "Gifts for gnome lovers", "someone who loves gnomes", 60, "Fantasy & fandoms", ["gnome"],
    ["garden gnome statue", "gnome plush", "gnome mug", "gnome socks", "gnome ornament", "gnome puzzle", "gnome book"]),
  T("gifts-for-wizard-lovers", "Gifts for wizard lovers", "someone who loves wizards and magic", 75, "Fantasy & fandoms", ["wizard"],
    ["wizard figurine", "wizard staff costume", "wizard hat costume", "wizard book", "wizard mug", "wizard lamp", "wizard puzzle"], { exclude: ["washington wizards", "wizards jersey"] }),
  T("gifts-for-fantasy-ranger-fans", "Gifts for fantasy ranger fans", "someone who loves fantasy rangers, archers and LARP", 100, "Fantasy & fandoms", null,
    ["LARP ranger cloak", "medieval leather bracers", "leather arrow quiver", "elven ranger miniature", "fantasy world map poster", "compass necklace", "fantasy ranger book"],
    { exclude: ["texas rangers", "new york rangers", "power rangers", "park ranger", "range rover", "glasgow rangers", "rangers fc"], notes: "the fantasy ranger: Aragorn-style wanderers, D&D rangers, archers and LARP gear" }),
  T("gifts-for-orc-fans", "Gifts for orc fans", "someone who loves orcs from fantasy games and books", 75, "Fantasy & fandoms", [" orc", "orcs", " ork", "orks "],
    ["orc miniature", "orc figurine", "orc mask costume", "orc book", "orc mug", "orc poster"], { exclude: ["orchid", "orchestra", "orca", "york", "work", "fork", "pork", "cork", "torch"] }),
  T("gifts-for-dragon-lovers", "Gifts for dragon lovers", "someone who loves dragons", 75, "Fantasy & fandoms", ["dragon"],
    ["dragon figurine", "dragon necklace", "dragon plush", "dragon lamp", "dragon mug", "dragon book", "dragon dice set"], { exclude: ["dragon fruit", "dragonfly", "dragon ball", "dragon naturally"] }),
  T("gifts-for-mermaid-lovers", "Gifts for mermaid lovers", "someone who loves mermaids", 60, "Fantasy & fandoms", ["mermaid"],
    ["mermaid tail blanket", "mermaid necklace", "mermaid plush", "mermaid night light", "mermaid mug", "mermaid book", "mermaid figurine"]),
  T("gifts-for-mushroom-lovers", "Gifts for mushroom lovers", "someone who loves the cottagecore mushroom look", 60, "Fantasy & fandoms", ["mushroom"],
    ["mushroom lamp", "mushroom plush", "mushroom mug", "mushroom earrings", "mushroom planter", "mushroom growing kit", "mushroom book"],
    { exclude: ["supplement", "gummies", "gummy", "capsule", "extract", "powder", "tincture", "lion's mane", "reishi", "chaga", "cordyceps", "mushroom coffee", "psilocybin", "magic mushroom", "spore"] }),
  T("gifts-for-dnd-players", "Gifts for D&D players", "someone who plays Dungeons & Dragons", 100, "Fantasy & fandoms", null,
    ["metal dice set", "dice tower", "dice tray", "D&D Player's Handbook", "D&D miniature", "D&D adventure book", "D&D board game"], { exclude: ["drug", "dnd sticker sheet"] }),
  T("gifts-for-dungeon-masters", "Gifts for dungeon masters", "a Dungeons & Dragons dungeon master", 100, "Fantasy & fandoms", null,
    ["dungeon master screen", "D&D Dungeon Master's Guide", "D&D Monster Manual", "wet erase battle map grid", "dice tower", "D&D miniature"], { exclude: ["exercise", "yoga", "goal tracker", "fitness"] }),
  T("gifts-for-lord-of-the-rings-fans", "Gifts for Lord of the Rings fans", "a Lord of the Rings fan", 100, "Fantasy & fandoms", ["lord of the rings", "hobbit", "tolkien", "middle-earth", "middle earth", "lotr"],
    ["Lord of the Rings LEGO", "Lord of the Rings book", "Lord of the Rings map poster", "Lord of the Rings mug", "Lord of the Rings ring necklace", "Lord of the Rings figure", "Lord of the Rings board game"]),
  T("gifts-for-harry-potter-fans", "Gifts for Harry Potter fans", "a Harry Potter fan", 100, "Fantasy & fandoms", ["harry potter", "hogwarts"],
    ["Harry Potter LEGO", "Harry Potter wand", "Harry Potter book", "Harry Potter mug", "Hogwarts house scarf", "Harry Potter puzzle", "Harry Potter blanket"]),
  T("gifts-for-star-wars-fans", "Gifts for Star Wars fans", "a Star Wars fan", 100, "Fantasy & fandoms", ["star wars", "mandalorian", "jedi", "grogu"],
    ["Star Wars LEGO", "Star Wars lightsaber", "Star Wars mug", "Star Wars hoodie", "Star Wars book", "Star Wars poster", "Star Wars funko pop"]),
  T("gifts-for-pokemon-fans", "Gifts for Pokémon fans", "a Pokémon fan", 75, "Fantasy & fandoms", ["pokemon", "pokémon", "pikachu"],
    ["Pokemon plush", "Pokemon card binder", "Pokemon LEGO", "Pokemon hoodie", "Pokemon mug", "Pokemon puzzle", "Pokemon book"], { exclude: ["booster", "card pack", "elite trainer box"] }),
  // Superheroes
  T("gifts-for-superhero-fans", "Gifts for superhero fans", "someone who loves superheroes", 100, "Superheroes", ["marvel", "dc comics", "batman", "superman", "spider-man", "spiderman", "wonder woman", "avengers", "superhero", "iron man", "captain america"],
    ["superhero LEGO", "superhero figure", "superhero graphic novel", "superhero hoodie", "superhero mug", "superhero framed wall art", "superhero funko pop"]),
  T("gifts-for-batman-fans", "Gifts for Batman fans", "a Batman fan", 100, "Superheroes", ["batman", "gotham", "batmobile"],
    ["Batman LEGO", "Batman figure", "Batman graphic novel", "Batman hoodie", "Batman mug", "Batman framed wall art", "Batman funko pop"]),
  T("gifts-for-superman-fans", "Gifts for Superman fans", "a Superman fan", 100, "Superheroes", ["superman"],
    ["Superman LEGO", "Superman figure", "Superman graphic novel", "Superman hoodie", "Superman mug", "Superman framed wall art", "Superman funko pop"]),
  T("gifts-for-spider-man-fans", "Gifts for Spider-Man fans", "a Spider-Man fan", 100, "Superheroes", ["spider-man", "spiderman", "spider man", "miles morales"],
    ["Spider-Man LEGO", "Spider-Man figure", "Spider-Man graphic novel", "Spider-Man hoodie", "Spider-Man mug", "Spider-Man framed wall art", "Spider-Man funko pop"]),
  T("gifts-for-wonder-woman-fans", "Gifts for Wonder Woman fans", "a Wonder Woman fan", 100, "Superheroes", ["wonder woman"],
    ["Wonder Woman figure", "Wonder Woman graphic novel", "Wonder Woman hoodie", "Wonder Woman mug", "Wonder Woman framed wall art", "Wonder Woman funko pop", "Wonder Woman necklace"]),
  T("gifts-for-marvel-fans", "Gifts for Marvel fans", "a Marvel fan", 100, "Superheroes", ["marvel", "avengers"],
    ["Marvel LEGO", "Marvel Legends figure", "Marvel graphic novel", "Marvel hoodie", "Marvel mug", "Marvel framed wall art", "Marvel funko pop"]),
  // More fandoms
  ...[["minecraft", "Minecraft", ["minecraft"], ["Minecraft LEGO", "Minecraft plush", "Minecraft hoodie", "Minecraft night light", "Minecraft book", "Minecraft mug", "Minecraft puzzle"]],
    ["super-mario", "Super Mario", ["mario", "luigi", "yoshi", "bowser"], ["Super Mario LEGO", "Super Mario plush", "Mario Kart hoodie", "Super Mario mug", "Super Mario lamp", "Super Mario puzzle", "Super Mario book"], ["mario badescu", "mario batali"]],
    ["zelda", "Legend of Zelda", ["zelda", "hyrule", "triforce"], ["Legend of Zelda LEGO", "Legend of Zelda figure", "Legend of Zelda hoodie", "Legend of Zelda mug", "Legend of Zelda book", "Legend of Zelda lamp", "Legend of Zelda necklace"]],
    ["disney", "Disney", ["disney"], ["Disney LEGO", "Disney plush", "Disney hoodie", "Disney mug", "Disney puzzle", "Disney book", "Disney ornament"]],
    ["hello-kitty", "Hello Kitty", ["hello kitty", "sanrio"], ["Hello Kitty plush", "Hello Kitty mug", "Hello Kitty hoodie", "Hello Kitty blanket", "Hello Kitty slippers", "Hello Kitty necklace", "Hello Kitty lamp"]],
    ["barbie", "Barbie", ["barbie"], ["Barbie doll", "Barbie dreamhouse", "Barbie hoodie", "Barbie mug", "Barbie book", "Barbie puzzle", "Barbie blanket"]],
    ["star-trek", "Star Trek", ["star trek", "starfleet", "enterprise"], ["Star Trek LEGO", "Star Trek figure", "Star Trek hoodie", "Star Trek mug", "Star Trek book", "Star Trek framed wall art", "Star Trek ornament"], ["enterprise rent", "enterprise car"]],
    ["doctor-who", "Doctor Who", ["doctor who", "tardis", "dalek"], ["Doctor Who TARDIS figure", "Doctor Who sonic screwdriver", "Doctor Who hoodie", "Doctor Who mug", "Doctor Who book", "Doctor Who scarf", "Doctor Who ornament"]],
    ["stranger-things", "Stranger Things", ["stranger things", "hellfire club", "hawkins"], ["Stranger Things LEGO", "Stranger Things figure", "Stranger Things hoodie", "Stranger Things mug", "Stranger Things book", "Stranger Things funko pop", "Stranger Things puzzle"]],
    ["studio-ghibli", "Studio Ghibli", ["ghibli", "totoro", "spirited away", "kiki's", "howl's moving castle", "no-face", "no face", "calcifer"], ["Totoro plush", "Studio Ghibli mug", "Studio Ghibli book", "Totoro lamp", "Studio Ghibli puzzle", "Studio Ghibli figurine", "Studio Ghibli blanket"]],
    ["anime", "anime", ["anime", "naruto", "one piece", "demon slayer", "my hero academia", "dragon ball", "jujutsu kaisen", "attack on titan", "chainsaw man", "spy x family"], ["anime figure", "anime hoodie", "anime plush", "anime manga box set book", "anime mug", "anime framed wall art", "anime funko pop"]],
    ["taylor-swift", "Taylor Swift", ["taylor swift", "eras tour", "swiftie"], ["Taylor Swift vinyl record", "Taylor Swift hoodie", "Taylor Swift book", "Taylor Swift mug", "Taylor Swift friendship bracelet", "Taylor Swift framed wall art", "Taylor Swift blanket"], ["vinyl sticker", "decal"]],
    ["squishmallows", "Squishmallows", ["squishmallow"], ["Squishmallows plush", "Squishmallows slippers", "Squishmallows blanket", "Squishmallows backpack bag", "Squishmallows mug", "Squishmallows hoodie", "Squishmallows book"]],
  ].map(([slug, name, req, slots, ex = []]) => T(`gifts-for-${slug}-fans`, `Gifts for ${name} fans`, `a ${name} fan`, 75, "Fantasy & fandoms", req, slots, { exclude: ex })),
  // Dog breeds: gifts for the person who loves the breed, not dog supplies.
  ...[["labrador", "Labrador", ["labrador"]], ["golden-retriever", "Golden Retriever", ["golden retriever"]], ["french-bulldog", "French Bulldog", ["french bulldog", "frenchie"]],
    ["german-shepherd", "German Shepherd", ["german shepherd"]], ["poodle", "Poodle", ["poodle"]], ["bulldog", "English Bulldog", ["english bulldog", "british bulldog"]],
    ["beagle", "Beagle", ["beagle"]], ["rottweiler", "Rottweiler", ["rottweiler"]], ["dachshund", "Dachshund", ["dachshund", "wiener dog", "doxie"]], ["corgi", "Corgi", ["corgi"]],
    ["australian-shepherd", "Australian Shepherd", ["australian shepherd"]], ["yorkie", "Yorkie", ["yorkie", "yorkshire terrier"]], ["boxer-dog", "Boxer dog", ["boxer dog"]],
    ["cavalier", "Cavalier King Charles Spaniel", ["cavalier king charles", "cavalier spaniel"]], ["husky", "Husky", ["husky dog", "siberian husky"]], ["shih-tzu", "Shih Tzu", ["shih tzu"]],
    ["boston-terrier", "Boston Terrier", ["boston terrier"]], ["pomeranian", "Pomeranian", ["pomeranian"]], ["great-dane", "Great Dane", ["great dane"]], ["pug", "Pug", [" pug", "pug "]],
    ["chihuahua", "Chihuahua", ["chihuahua"]], ["border-collie", "Border Collie", ["border collie"]], ["bernese-mountain-dog", "Bernese Mountain Dog", ["bernese"]],
    ["doberman", "Doberman", ["doberman"]], ["pit-bull", "Pit Bull", ["pit bull", "pitbull"]], ["schnauzer", "Schnauzer", ["schnauzer"]], ["shiba-inu", "Shiba Inu", ["shiba"]],
    ["goldendoodle", "Goldendoodle", ["goldendoodle"]], ["greyhound", "Greyhound", ["greyhound dog", "italian greyhound", "greyhound art", "greyhound mug", "greyhound print"]],
  ].map(([slug, name, req]) => T(`gifts-for-${slug}-lovers`, `Gifts for ${name} lovers`, `someone who loves their ${name}`, 50, "Dog breeds", req,
    [`${name} mug`, `${name} ornament`, `${name} socks`, `${name} plush`, `${name} framed wall art`, `${name} necklace`, `${name} blanket`],
    { exclude: ["collar", "harness", "leash", "dog food", "treats", "dog bed", "chew", "kibble", "flea", "shampoo", "crate", "boxer brief", "husky tool", "greyhound bus", "mr. worldwide", "labradorite", ...(slug === "bulldog" ? ["french"] : [])] })),
  // Doodle dogs together: one breed alone is too thin. "Doodle" is also drawing, so drawing toys stay out.
  T("gifts-for-doodle-lovers", "Gifts for doodle lovers (Goldendoodle, Labradoodle, Bernedoodle)", "someone who loves their Goldendoodle, Labradoodle or Bernedoodle", 50, "Dog breeds",
    ["doodle"], ["Goldendoodle mug", "Doodle dog ornament", "Goldendoodle socks", "Goldendoodle plush", "Bernedoodle framed wall art", "Doodle dog necklace", "Labradoodle blanket"],
    { exclude: ["magna doodle", "doodle pad", "doodle board", "doodle art", "doodle book", "coloring", "drawing", "doodle bear", "doodle jump", "yankee doodle", "doodlebug", "doodle mat", "collar", "harness", "leash", "dog food", "treats", "dog bed", "chew", "shampoo", "crate"],
      notes: "doodle dogs (Goldendoodles, Labradoodles, Bernedoodles); gifts for the owner, not dog supplies" }),
  // Birthdays: toddlers by age, kids 5-16 by age and boy/girl, milestone birthdays for him and her.
  ...[[1, ["baby activity cube", "push walker toy", "board books for babies", "stacking toy", "ride-on toy for 1 year old", "baby plush toy", "bath toys"]],
    [2, ["toddler balance bike", "toddler play kitchen", "toddler art easel", "wooden stacking blocks", "toy dump truck", "toddler board books", "toddler musical instrument set"]],
    [3, ["magnetic building tiles", "kids play kitchen", "kids tricycle", "play dough set", "dress up costume set", "puzzle for 3 year olds", "picture book"]],
    [4, ["kids balance bike", "LEGO Duplo set", "kids art supply set", "preschool board game", "kids scooter", "dress up costume set", "picture book"]],
  ].map(([age, slots]) => T(`gifts-for-${age}-year-olds`, `Gifts for ${age}-year-olds`, `a ${age}-year-old child`, 50, "Birthdays", null,
    slots.map(s => /year old/.test(s) ? s : `${s} for ${age} year old`), { occasion: "birthday", exclude: KIDS_EXCLUDE, minCount: 5, notes: `age-appropriate, safe toys for a ${age}-year-old; no small parts for toddlers` })),
  ...[[[5, 6, 7], { boy: ["LEGO set", "remote control car", "kids scooter", "dinosaur toy", "kids science kit", "kids board game", "kids walkie talkies"],
                    girl: ["LEGO Friends set", "kids art supply set", "dollhouse", "kids craft kit", "kids scooter", "kids board game", "kids jewelry making kit"] }],
    [[8, 9, 10], { boy: ["LEGO set", "remote control car", "kids drone", "kids science kit", "strategy board game", "kids digital camera", "kids basketball hoop"],
                   girl: ["LEGO Friends set", "friendship bracelet kit", "kids instant camera", "kids art supply set", "kids karaoke microphone", "family board game", "slime kit"] }],
    [[11, 12, 13], { boy: ["LEGO Technic set", "drone with camera", "kids wireless headphones", "speed cube", "basketball", "kids smartwatch", "robotics kit"],
                     girl: ["instant camera", "kids wireless headphones", "jewelry making kit", "LED room lights", "makeup bag organizer", "sketchbook and art set", "kids smartwatch"] }],
    [[14, 15, 16], { boy: ["wireless earbuds", "bluetooth speaker", "gaming headset", "hoodie for teen boys", "basketball", "LED strip lights", "portable power bank"],
                     girl: ["instant camera", "wireless earbuds", "sherpa blanket", "jewelry box", "insulated tumbler", "hair styling tool", "makeup bag organizer"] }],
  ].flatMap(([ages, by]) => ages.flatMap(age => ["boy", "girl"].map(g => T(`gifts-for-${age}-year-old-${g}s`, `Gifts for ${age}-year-old ${g}s`, `a ${age}-year-old ${g}`, age < 11 ? 50 : 75, "Birthdays", null,
    by[g].map(s => `${s} for ${age} year old ${g}`), { occasion: "birthday", exclude: KIDS_EXCLUDE, minCount: 5, notes: `age-appropriate gifts a ${age}-year-old ${g} will actually want` })))),
  ...[21, 30, 40, 50, 60, 70].flatMap(n => [
    T(`${n}th-birthday-gifts-for-him`.replace("21th", "21st"), `${n === 21 ? "21st" : n + "th"} birthday gifts for him`, `a man turning ${n}`, n === 21 ? 75 : 150, "Birthdays", null,
      (n <= 30 ? ["wireless earbuds", "leather wallet", "bluetooth speaker", "hoodie", "watch", "card game", "travel bag"] : ["personalized whiskey glass", "leather wallet", "watch", "grilling tool set", "massage gun", "golf gift set", "leather weekender bag"]).map(s => `${s} for ${n} year old man`),
      { occasion: `${n === 21 ? "21st" : n + "th"} birthday`, minCount: 5, exclude: ["objet d", "kids", "boys", "girls", "fanatics", "nfl", "mlb", "nba", "nhl", "ncaa"], notes: `milestone ${n}th birthday; lasting gifts he'll use, plus one fun nod to turning ${n}` }),
    T(`${n}th-birthday-gifts-for-her`.replace("21th", "21st"), `${n === 21 ? "21st" : n + "th"} birthday gifts for her`, `a woman turning ${n}`, n === 21 ? 75 : 150, "Birthdays", null,
      (n <= 30 ? ["initial necklace", "instant camera", "jewelry box", "luxury candle", "silk pillowcase", "makeup bag", "tote bag"] : ["personalized necklace", "jewelry box", "spa gift set", "luxury candle", "cashmere scarf", "silk pajamas", "personalized photo book"]).map(s => `${s} for ${n} year old woman`),
      { occasion: `${n === 21 ? "21st" : n + "th"} birthday`, minCount: 5, exclude: ["objet d", "kids", "boys", "girls", "fanatics", "nfl", "mlb", "nba", "nhl", "ncaa"], notes: `milestone ${n}th birthday; meaningful gifts she'll keep` })]),
  // Hanukkah (starts Dec 4, 2026) and the Christmas run-up: hosts, parties, pets, pajamas, advent calendars.
  ...[["hanukkah-gifts-for-him", "Hanukkah gifts for him", "a man who celebrates Hanukkah", 100, ["men's Hanukkah socks", "Hanukkah sweater for men", "modern menorah", "whiskey glasses set", "leather wallet", "Jewish history book", "dreidel game"]],
    ["hanukkah-gifts-for-her", "Hanukkah gifts for her", "a woman who celebrates Hanukkah", 100, ["Hanukkah earrings", "Star of David necklace", "Hanukkah candles", "cozy throw blanket", "Jewish cookbook", "modern menorah", "Hanukkah mug"]],
    ["hanukkah-gifts-for-the-family", "Hanukkah gifts for the whole family", "a family that celebrates Hanukkah", 100, ["family menorah", "dreidel set", "Hanukkah board game", "Hanukkah family pajamas", "Hanukkah cookie cutters", "Hanukkah jigsaw puzzle", "Hanukkah story book"]],
    ["hanukkah-hostess-gifts", "Hanukkah hostess gifts", "the host of a Hanukkah dinner", 60, ["Hanukkah serving platter", "Hanukkah candles", "olive wood challah board", "Hanukkah kitchen towels", "modern menorah", "honey gift set", "Hanukkah napkins"]],
  ].map(([slug, kw, who, budget, slots]) => T(slug, kw, who, budget, "Holidays", null, slots, { occasion: "Hanukkah", exclude: ["christmas", "santa", "xmas", "easter"] })),
  ...[["ugly-sweater-party-gifts", "Ugly sweater party gifts and prizes", "guests at an ugly Christmas sweater party", 40, ["ugly Christmas sweater", "Christmas party game", "funny Christmas mug", "funny Christmas socks", "light up Christmas hat", "Christmas trivia game", "ugly sweater party prize"]],
    ["christmas-host-gifts", "Christmas host gifts", "the host of a Christmas dinner or party", 60, ["holiday scented candle", "Christmas serving platter", "olive oil gift set", "Christmas kitchen towels", "cheese board set", "cocktail mixer gift set", "Christmas tree ornament"]],
    ["christmas-gifts-for-dogs", "Christmas gifts for dogs", "a dog (and its owner)", 50, ["dog Christmas stocking", "dog Christmas toy", "dog Christmas sweater", "dog advent calendar", "personalized dog bowl", "orthopedic dog bed", "dog treat jar"]],
    ["christmas-gifts-for-cats", "Christmas gifts for cats", "a cat (and its owner)", 50, ["cat Christmas stocking", "interactive cat toy", "cat tree", "cat advent calendar", "heated cat bed", "cat scratcher lounge", "cat Christmas sweater"]],
    ["matching-family-christmas-pajamas", "Matching family Christmas pajamas", "the whole family, matching", 60, ["matching family Christmas pajamas", "women's Christmas pajamas", "men's Christmas pajamas", "kids Christmas pajamas", "toddler Christmas pajamas", "dog Christmas pajamas", "baby Christmas pajamas"]],
    ["advent-calendars-for-adults", "Advent calendars for adults", "an adult who loves a daily treat", 100, ["beauty advent calendar", "tea advent calendar", "coffee advent calendar", "chocolate advent calendar", "candle advent calendar", "jewelry advent calendar", "puzzle advent calendar"]],
    ["advent-calendars-for-kids", "Advent calendars for kids", "a child counting down to Christmas", 50, ["LEGO advent calendar", "Playmobil advent calendar", "Pokemon advent calendar", "slime advent calendar", "toy advent calendar", "chocolate advent calendar for kids", "Harry Potter advent calendar"]],
  ].map(([slug, kw, who, budget, slots]) => T(slug, kw, who, budget, "Holidays", /advent/.test(slug) ? ["advent"] : /pajamas/.test(slug) ? ["pajama", "pjs", "pj set", "sleepwear", "pyjama"] : null, slots,
    { occasion: "Christmas", exclude: [...(/kids|dogs|cats/.test(slug) ? KIDS_EXCLUDE : []), ...(/dogs/.test(slug) ? ["cat "] : []), ...(/cats/.test(slug) ? ["dog "] : [])] })),
  // Valentine's Day
  ...[["valentines-day-gifts-for-him", "Valentine's Day gifts for him", "my boyfriend or husband", 100, ["leather wallet", "wireless earbuds", "personalized whiskey glass", "cozy hoodie", "grooming kit", "watch", "couples game"]],
    ["valentines-day-gifts-for-her", "Valentine's Day gifts for her", "my girlfriend or wife", 100, ["heart necklace", "preserved rose dome", "silk pajamas", "jewelry box", "luxury candle", "spa gift set", "cozy slippers"]],
    ["valentines-day-gifts-for-husband", "Valentine's Day gifts for your husband", "my husband", 150, ["engraved watch", "leather weekender bag", "smart meat thermometer", "personalized wallet", "massage gun", "whiskey decanter set", "couples journal book"]],
    ["valentines-day-gifts-for-wife", "Valentine's Day gifts for your wife", "my wife", 150, ["diamond pendant necklace", "cashmere wrap scarf", "personalized jewelry box", "silk robe", "spa gift set", "personalized night sky star map", "luxury candle"]],
    ["valentines-day-gifts-for-new-relationship", "Valentine's Day gifts for a new relationship", "someone I just started dating", 50, ["chocolate gift box", "scented candle", "date night card game", "cozy socks", "small succulent planter", "cute couples mug", "date night ideas book for couples"]],
    ["galentines-day-gifts", "Galentine's Day gifts for friends", "my best friends", 30, ["friendship bracelet", "scented candle", "cozy socks", "face mask spa set", "best friend mug", "lip balm set", "scrunchie set"]],
    ["valentines-day-gifts-under-50", "Valentine's Day gifts under $50", "my partner", 50, ["heart necklace", "preserved rose", "couples card game", "scented candle", "personalized mug", "cozy blanket", "chocolate gift box"]],
    ["long-distance-relationship-gifts", "Long-distance relationship gifts", "my long-distance partner", 75, ["long distance touch lamp", "long distance bracelets", "open when letters envelopes", "couples journal book", "custom map print", "long distance relationship pillow", "digital photo frame"]],
    ["10-best-valentines-day-gifts", "10 best Valentine's Day gifts", "my partner", 150, ["heart necklace", "preserved rose dome", "personalized night sky star map", "wireless earbuds", "luxury candle", "silk pajamas", "couples card game", "leather wallet", "women's spa gift basket", "chocolate gift box"]],
  ].map(([slug, kw, who, budget, slots]) => T(slug, kw, who, budget, "Valentine's Day", null, slots, { occasion: "Valentine's Day", exclude: ["baby", "kids", "toddler", "children's", "infant", "personalized book | letters"], count: slots.length, minCount: Math.min(6, slots.length - 1) })),
];

// Holiday long-tail first. `store` links the page into a gift.directory store (and its group gifts).
export const PAGES = [
  // lawyers & law
  P("christmas-gifts-for-lawyers", "Christmas gifts for lawyers", "a lawyer", "Christmas", 200, { store: "lawyers", topic: "Law" }),
  P("gifts-for-attorneys-under-100", "Gifts for attorneys under $100", "an attorney", "any occasion", 100, { store: "lawyers", topic: "Law" }),
  P("thank-you-gifts-for-your-lawyer", "Thank you gifts for your lawyer", "my lawyer, from a grateful client", "won my case", 200, { store: "lawyers", topic: "Law" }),
  P("gifts-for-new-lawyers", "Gifts for new lawyers", "a newly admitted lawyer", "sworn in", 150, { store: "lawyers", topic: "Law" }),
  P("bar-exam-passed-gifts", "Gifts for passing the bar exam", "someone who just passed the bar", "passed the bar", 150, { store: "lawyers", topic: "Law" }),
  P("law-school-graduation-gifts", "Law school graduation gifts", "a law school graduate", "graduation", 150, { store: "lawyers", topic: "Law" }),
  P("gifts-for-law-students", "Gifts for law students", "a law student", "Christmas", 75, { topic: "Law", store: "lawyers", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","drinking","adult party","plague","retirement","money scented","fart"],
    slots: ["law school survival guide book","noise cancelling earbuds","laptop backpack","highlighter set","insulated tumbler","LED desk lamp","law school planner","blue light glasses"] }),
  P("judge-retirement-gifts", "Retirement gifts for a judge", "a judge", "retirement", 300, { count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["fountain pen","engraved desk clock","scales of justice sculpture","leather journal","engraved crystal gavel","leather desk pad","personalized bookends","whiskey decanter set"], slotMust: [["fountain pen"],["clock"],["scale","justice"],["journal"],["gavel"],["desk pad","desk mat","blotter"],["bookend"],["decanter"]], store: "lawyers", topic: "Law" }),
  P("gifts-for-paralegals", "Gifts for paralegals", "a paralegal", "Christmas", 75, { topic: "Law", store: "lawyers", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","drinking","adult party","plague","retirement","money scented","fart"],
    slots: ["desk organizer","insulated tumbler","leather padfolio","mug warmer","ergonomic wrist rest","gel pen set","ceramic coffee mug","desk plant"] }),
  P("scales-of-justice-gifts", "Scales of justice gifts", "a lawyer", "any occasion", 300, { store: "lawyers", topic: "Law", notes: "scales of justice, Lady Justice, gavel themed gifts" }),
  P("gifts-for-female-lawyers", "Gifts for female lawyers", "a woman who is a lawyer", "Christmas", 200, { store: "lawyers", topic: "Law" }),
  P("law-office-secret-santa-gifts", "Secret Santa gifts for a law office", "a coworker at a law firm", "Secret Santa", 30, { store: "lawyers", topic: "Law" }),
  // ---- profession guides by occasion: retirement, graduation, Secret Santa, boss & coworker (Nov 2026) ----
  ...(() => {
    const X = ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk","gift card"];
    // Per slot, after reviewing the first build: [slot index]: [better search, words the product title must contain].
    const RET = ["retire"], COFFEE = ["sampler", "whole bean", "ground coffee", "coffee gift", "variety pack", "k-cup"], CANDLE = ["soy", "wick", "wax"];
    const FIX = {
      "lawyer-retirement-gifts": { 0: ["engraved crystal gavel", ["gavel"]], 3: ["personalized retirement plaque", RET] },
      "doctor-retirement-gifts": { 0: ["doctor shadow box", ["shadow box"]], 1: ["personalized retirement plaque", RET], x: ["farmhouse", "shelf"] },
      "firefighter-retirement-gifts": { 1: ["personalized retirement plaque", RET], 6: ["firefighter challenge coin", ["fire"]] },
      "police-retirement-gifts": { 0: ["police shadow box", ["shadow box"]], 1: ["personalized retirement plaque", RET], 7: ["police challenge coin", ["police", "law enforcement", "blue line"]], x: ["mirror", "farmhouse", "shelf"] },
      "military-retirement-gifts": { 0: ["military shadow box display case", ["shadow box", "display case"]], 2: ["personalized retirement plaque", RET] },
      "pharmacist-retirement-gifts": { 0: ["personalized retirement plaque", RET] },
      "nursing-school-graduation-gifts": { 0: ["Littmann stethoscope", ["littmann"]], 7: ["stethoscope case", ["stethoscope"]] },
      "medical-school-graduation-gifts": { 0: ["Littmann stethoscope", ["littmann"]], 3: ["caduceus medical lapel pin", ["caduceus", "medical"]], 5: ["doctor shadow box frame", ["doctor", "physician", "medical", "md"]] },
      "police-academy-graduation-gifts": { 1: ["thin blue line bracelet", ["blue line"]], 5: ["police challenge coin", ["police", "law enforcement", "blue line"]] },
      "fire-academy-graduation-gifts": { 3: ["firefighter challenge coin", ["fire"]], 5: ["firefighter keychain", ["firefighter", "fire fighter", "fire dept"]] },
      "dental-school-graduation-gifts": { 2: ["tooth shaped desk decor", ["tooth", "dental", "dentist", "molar"]], 4: ["dentist mug", ["dentist", "dental", "tooth"]] },
      "secret-santa-gifts-for-firefighters": { 0: ["firefighter mug", ["firefighter", "fire fighter", "fire dept"]], 2: ["hot sauce gift set", ["hot sauce"]], x: ["towel", "naughty", "ornament"] },
      "secret-santa-gifts-for-police-officers": { 5: ["gourmet coffee sampler", COFFEE] },
      "secret-santa-gifts-for-doctors": { 1: ["funny doctor mug", ["doctor", "physician", "medical"]], 3: ["gourmet coffee sampler", COFFEE], x: ["doctor who", "tardis", "dalek", "plague"] },
      "gifts-for-your-boss-under-50": { 1: ["gourmet coffee sampler", COFFEE], 6: ["gourmet chocolate truffles box", ["truffle", "assorted chocolate", "chocolate assortment"]], 7: ["luxury soy candle", CANDLE] },
      "gifts-for-female-boss": { 1: ["luxury soy candle", CANDLE], 4: ["gourmet chocolate truffles box", ["truffle", "assorted chocolate", "chocolate assortment"]] },
      "gifts-for-male-boss": { 4: ["gourmet coffee sampler", COFFEE] },
      "farewell-gifts-for-coworkers": { 5: ["luxury soy candle", CANDLE], 6: ["gourmet coffee sampler", COFFEE] },
      "gifts-for-nurse-managers": { 5: ["luxury soy candle", CANDLE] },
      "gifts-for-principals": { 3: ["principal mug", ["principal"]], 6: ["gourmet coffee sampler", COFFEE] },
      "christmas-gifts-for-teachers": { 4: ["personalized teacher ornament", ["teacher"]], 6: ["scented soy candle", CANDLE] },
      "teacher-appreciation-gifts": { 2: ["personalized teacher name sign", ["teacher"]], 6: ["gourmet coffee sampler", COFFEE] },
      "thank-you-gifts-for-doctors": { 0: ["gourmet chocolate truffles box", ["truffle", "assorted chocolate", "chocolate assortment", "chocolates"]], 1: ["gourmet coffee sampler", COFFEE] },
      "closing-gifts-for-home-buyers": { 0: ["personalized cutting board", ["cutting board", "charcuterie"]], 1: ["custom doormat", ["doormat", "door mat"]], 3: ["personalized address plaque", ["address", "house number", "plaque"]], 6: ["scented soy candle", CANDLE] },
      "christmas-gifts-for-realtors": { 2: ["car seat organizer", ["organizer"]], 6: ["gourmet coffee sampler", COFFEE] },
      "thank-you-gifts-for-police-officers": { 0: ["thin blue line mug", ["blue line", "police"]], 2: ["gourmet coffee sampler", COFFEE], 6: ["thin blue line flag", ["blue line"]] },
      "christmas-gifts-for-firefighters": { 0: ["firefighter ornament", ["fire"]], 3: ["firefighter gear bag", ["fire", "gear bag", "duffel"]], 7: ["firefighter mug", ["firefighter", "fire fighter", "fire dept"]], x: ["fire dancer", "pretend", "figurine"] },
      "christmas-gifts-for-lawyers-under-50": { 4: ["lawyer mug", ["lawyer", "attorney", "legal"]], 5: ["scales of justice decor", ["justice", "scale", "gavel"]] },
      "christmas-gifts-for-nurses-under-25": { 4: ["nurse mug", ["nurse"]], 5: ["nurse tote bag", ["nurse"]] },
      "stocking-stuffers-for-nurses": { 4: ["nurse pen set", ["pen"]], 5: ["nurse keychain", ["nurse"]] },
      "stocking-stuffers-for-teachers": { 4: ["teacher keychain", ["teacher"]] },
      "christmas-gifts-for-police-officers": { 1: ["thin blue line ornament", ["blue line", "police"]], 6: ["police shadow box", ["shadow box"]], x: ["farmhouse", "shelf"] },
    };
    const G = (slug, keyword, recipient, occasion, budget, topic, slots, extra = {}) => {
      const f = FIX[slug] || {}, sl = slots.map((q, i) => f[i] ? f[i][0] : q), must = slots.map((_, i) => f[i] ? f[i][1] : null);
      return P(slug, keyword, recipient, occasion, budget, { topic, count: 8, minCount: 6, exclude: [...X, ...(f.x || [])], slots: sl, ...(slots.some((_, i) => f[i]) ? { slotMust: must } : {}), ...extra });
    };
    return [
      // retirement
      G("lawyer-retirement-gifts", "Retirement gifts for lawyers", "a retiring lawyer", "retirement", 250, "Law",
        ["engraved crystal gavel","fountain pen","leather journal","personalized retirement plaque","whiskey decanter set","golf gift set","scales of justice sculpture","travel weekender bag"], { store: "lawyers" }),
      G("doctor-retirement-gifts", "Retirement gifts for doctors", "a retiring doctor", "retirement", 250, "Nurses & healthcare",
        ["stethoscope shadow box","personalized retirement plaque","leather journal","history of medicine book","whiskey decanter set","golf gift set","travel weekender bag","massage gun"], { store: "nurses" }),
      G("teacher-retirement-gifts", "Teacher retirement gifts", "a retiring teacher", "retirement", 100, "Professions",
        ["personalized teacher retirement sign","retirement journal","teacher retirement ornament","gardening tool set","plush robe","1000 piece jigsaw puzzle","book lover gift set","weekender bag"]),
      G("firefighter-retirement-gifts", "Firefighter retirement gifts", "a retiring firefighter", "retirement", 200, "Professions",
        ["firefighter shadow box","personalized retirement plaque","firefighter axe wall decor","whiskey decanter set","leather journal","grilling tool set","firefighter challenge coin","fishing gear gift set"], { store: "firefighter-gifts" }),
      G("police-retirement-gifts", "Police retirement gifts", "a retiring police officer", "retirement", 200, "Professions",
        ["police badge shadow box","personalized retirement plaque","thin blue line flag","whiskey decanter set","leather journal","grilling tool set","fishing gear gift set","police challenge coin"]),
      G("military-retirement-gifts", "Military retirement gifts", "a military service member who is retiring", "retirement", 200, "Professions",
        ["military shadow box","folded flag display case","personalized retirement plaque","whiskey decanter set","challenge coin display","leather journal","engraved pocket knife","weekender bag"]),
      G("pharmacist-retirement-gifts", "Pharmacist retirement gifts", "a retiring pharmacist", "retirement", 150, "Nurses & healthcare",
        ["personalized retirement plaque","mortar and pestle decor","retirement journal","gardening tool set","whiskey decanter set","plush robe","1000 piece jigsaw puzzle","weekender bag"]),
      // graduation
      G("nursing-school-graduation-gifts", "Nursing school graduation gifts", "a new nursing school graduate", "graduation", 100, "Nurses & healthcare",
        ["Littmann stethoscope","nurse badge reel","compression socks","insulated tumbler","nursing clipboard","personalized nurse ornament","nurse tote bag","stethoscope case"], { store: "nurses" }),
      G("medical-school-graduation-gifts", "Medical school graduation gifts", "a new medical school graduate", "graduation", 250, "Nurses & healthcare",
        ["Littmann Cardiology stethoscope","leather padfolio","engraved pen set","white coat pin","insulated tumbler","doctor shadow box frame","noise cancelling earbuds","leather backpack"]),
      G("police-academy-graduation-gifts", "Police academy graduation gifts", "a new police academy graduate", "graduation", 150, "Professions",
        ["tactical flashlight","thin blue line ring","duty bag","tactical pen","insulated tumbler","police challenge coin","personalized badge frame","boot dryer"]),
      G("fire-academy-graduation-gifts", "Fire academy graduation gifts", "a new fire academy graduate", "graduation", 150, "Professions",
        ["firefighter flashlight","firefighter gear bag","personalized firefighter ornament","firefighter challenge coin","insulated tumbler","firefighter bracelet","boot dryer","Maltese cross keychain"], { store: "firefighter-gifts" }),
      G("pharmacy-school-graduation-gifts", "Pharmacy school graduation gifts", "a new pharmacy school graduate", "graduation", 150, "Nurses & healthcare",
        ["mortar and pestle gift","leather padfolio","engraved pen set","insulated tumbler","pharmacist mug","pharmacy reference book","personalized name plate","laptop backpack"]),
      G("dental-school-graduation-gifts", "Dental school graduation gifts", "a new dental school graduate", "graduation", 200, "Nurses & healthcare",
        ["leather padfolio","engraved pen set","tooth shaped desk decor","insulated tumbler","dentist mug","personalized name plate","noise cancelling earbuds","laptop backpack"]),
      G("high-school-graduation-gifts", "High school graduation gifts", "a high school graduate heading to college", "graduation", 100, "Life events",
        ["laptop backpack","noise cancelling earbuds","dorm room shower caddy","portable charger","instant camera","weighted blanket","mini fridge","graduation keepsake box"]),
      // Secret Santa by profession
      G("secret-santa-gifts-for-nurses", "Secret Santa gifts for nurses under $25", "a nurse coworker", "Secret Santa", 25, "Nurses & healthcare",
        ["badge reel","compression socks","hand cream set","insulated tumbler","nurse pen set","lip balm set","nurse keychain","snack gift box"], { store: "nurses" }),
      G("secret-santa-gifts-for-teachers", "Secret Santa gifts for teachers under $25", "a teacher coworker", "Secret Santa", 25, "Professions",
        ["teacher mug","gel pen set","hand cream set","insulated tumbler","teacher planner stickers","scented candle","desk plant","cozy socks"]),
      G("secret-santa-gifts-for-doctors", "Secret Santa gifts for doctors under $25", "a doctor coworker", "Secret Santa", 25, "Nurses & healthcare",
        ["insulated tumbler","doctor mug","pen set","coffee gift set","desk fidget toy","cozy socks","phone stand","snack gift box"]),
      G("secret-santa-gifts-for-firefighters", "Secret Santa gifts for firefighters under $25", "a firefighter coworker", "Secret Santa", 25, "Professions",
        ["firefighter mug","firefighter keychain","hot sauce gift set","tactical flashlight","beef jerky gift box","firefighter socks","insulated tumbler","multitool"], { store: "firefighter-gifts" }),
      G("secret-santa-gifts-for-police-officers", "Secret Santa gifts for police officers under $25", "a police officer coworker", "Secret Santa", 25, "Professions",
        ["thin blue line mug","tactical pen","beef jerky gift box","insulated tumbler","police keychain","coffee gift set","tactical flashlight","cozy socks"]),
      // boss & coworkers
      G("gifts-for-your-boss-under-50", "Gifts for your boss under $50", "my boss", "Christmas", 50, "Work & office",
        ["leather journal","coffee gift set","insulated tumbler","desk plant","engraved pen","wireless charging pad","gourmet chocolate box","scented candle"]),
      G("gifts-for-female-boss", "Gifts for a female boss", "my boss, a woman", "Christmas", 75, "Work & office",
        ["leather journal","scented candle","silk scarf","insulated tumbler","gourmet chocolate box","desk plant","jewelry dish","tea gift set"]),
      G("gifts-for-male-boss", "Gifts for a male boss", "my boss, a man", "Christmas", 75, "Work & office",
        ["leather journal","whiskey stones set","engraved pen","insulated tumbler","coffee gift set","desk organizer","wireless charging pad","golf balls gift set"]),
      G("farewell-gifts-for-coworkers", "Farewell gifts for a coworker who is leaving", "a coworker who is leaving the job", "farewell", 50, "Work & office",
        ["personalized farewell card","leather journal","insulated tumbler","desk plant","going away keychain","scented candle","coffee gift set","photo frame"]),
      G("gifts-for-nurse-managers", "Gifts for nurse managers", "my nurse manager", "thank you", 75, "Nurses & healthcare",
        ["leather padfolio","insulated tumbler","nurse leader mug","hand cream set","desk plant","scented candle","engraved pen","tea gift set"], { store: "nurses" }),
      G("gifts-for-principals", "Gifts for school principals", "a school principal", "Christmas", 75, "Professions",
        ["leather padfolio","engraved desk name plate","insulated tumbler","principal mug","desk plant","leather journal","coffee gift set","engraved pen"]),
      // seed guides for the teachers, doctors, realtors and police stores
      G("christmas-gifts-for-teachers", "Christmas gifts for teachers", "my child's teacher, from a parent", "Christmas", 35, "Professions",
        ["insulated tumbler","teacher tote bag","gourmet chocolate box","hand cream gift set","personalized teacher ornament","gel pen set","scented soy candle","cozy socks"], { store: "teachers" }),
      G("teacher-appreciation-gifts", "Teacher appreciation gifts", "a teacher, for Teacher Appreciation Week", "thank you", 50, "Professions",
        ["teacher tote bag","insulated tumbler","personalized teacher name sign","teacher planner","succulent planter","hand cream gift set","coffee gift set","book lover gift set"], { store: "teachers" }),
      G("gifts-for-doctors", "Gifts for doctors", "a doctor", "any occasion", 150, "Nurses & healthcare",
        ["leather padfolio","engraved pen","massage gun","pour over coffee set","history of medicine book","insulated tumbler","noise cancelling earbuds","leather messenger bag"], { store: "doctors" }),
      G("thank-you-gifts-for-doctors", "Thank you gifts for doctors", "my doctor, from a grateful patient", "thank you", 100, "Nurses & healthcare",
        ["gourmet chocolate box","gourmet coffee sampler","desk plant","engraved pen","leather journal","insulated tumbler","tea gift set","fruit gift basket"], { store: "doctors" }),
      G("closing-gifts-for-home-buyers", "Closing gifts for home buyers", "my clients who just bought a house, from their real estate agent", "closing", 100, "Professions",
        ["personalized cutting board","custom doormat","wine decanter set","personalized address plaque","cozy throw blanket","housewarming gift basket","scented soy candle","cocktail shaker set"], { store: "realtors" }),
      G("christmas-gifts-for-realtors", "Christmas gifts for realtors", "a real estate agent", "Christmas", 75, "Professions",
        ["leather padfolio","insulated tumbler","car seat organizer","wireless car charger","desk plant","engraved pen","gourmet coffee sampler","leather journal"], { store: "realtors" }),
      G("thank-you-gifts-for-police-officers", "Thank you gifts for police officers", "the police officers at our local precinct", "thank you", 50, "Professions",
        ["thin blue line mug","tactical pen","gourmet coffee sampler","insulated tumbler","beef jerky gift box","tactical flashlight","thin blue line flag","cozy socks"], { store: "police" }),
      G("christmas-gifts-for-police-officers", "Christmas gifts for police officers", "a police officer", "Christmas", 100, "Professions",
        ["tactical flashlight","thin blue line ornament","insulated tumbler","duty bag","boot dryer","tactical pen","police shadow box","wool hiking socks"], { store: "police" }),
      // holiday season (Nov 2026)
      G("black-friday-gift-ideas", "Black Friday gift ideas", "someone on my Christmas list", "Christmas", 300, "Holidays",
        ["noise cancelling headphones","stand mixer","robot vacuum","smart watch","air fryer","cozy throw blanket","instant camera","espresso machine"]),
      G("cyber-monday-gift-ideas", "Cyber Monday gift ideas", "someone on my Christmas list", "Christmas", 200, "Holidays",
        ["wireless earbuds","bluetooth speaker","e-reader","smart speaker","fitness tracker","portable charger","streaming stick","mechanical keyboard"]),
      G("christmas-gifts-for-firefighters", "Christmas gifts for firefighters", "a firefighter", "Christmas", 100, "Professions",
        ["firefighter ornament","tactical flashlight","insulated tumbler","firefighter gear bag","boot dryer","multitool","wool socks","firefighter mug"], { store: "firefighter-gifts" }),
      G("christmas-gifts-for-lawyers-under-50", "Christmas gifts for lawyers under $50", "a lawyer", "Christmas", 50, "Law",
        ["engraved pen","leather journal","insulated tumbler","desk organizer","lawyer mug","scales of justice decor","whiskey stones set","leather cardholder"], { store: "lawyers" }),
      G("christmas-gifts-for-nurses-under-25", "Christmas gifts for nurses under $25", "a nurse", "Christmas", 25, "Nurses & healthcare",
        ["badge reel","compression socks","insulated tumbler","hand cream gift set","nurse mug","nurse tote bag","lip balm set","cozy socks"], { store: "nurses" }),
      G("stocking-stuffers-for-nurses", "Stocking stuffers for nurses", "a nurse", "Christmas", 20, "Nurses & healthcare",
        ["badge reel","lip balm set","hand cream","compression socks","nurse pen set","nurse keychain","hair ties","hand sanitizer holder"], { store: "nurses" }),
      G("stocking-stuffers-for-teachers", "Stocking stuffers for teachers", "a teacher", "Christmas", 20, "Professions",
        ["gel pen set","lip balm set","hand cream","sticky notes set","teacher keychain","cozy socks","tea sampler","mini succulent planter"], { store: "teachers" }),
      G("gifts-for-legal-assistants", "Gifts for legal assistants", "a legal assistant at the firm", "Christmas", 50, "Law",
        ["desk organizer","insulated tumbler","mug warmer","gel pen set","hand cream set","desk plant","scented candle","ergonomic wrist rest"], { store: "lawyers" }),
    ];
  })(),
  // nurses & healthcare
  P("christmas-gifts-for-nurses", "Christmas gifts for nurses", "a nurse", "Christmas", 100, { store: "nurses", topic: "Nurses & healthcare" }),
  P("nurse-appreciation-gifts", "Nurse appreciation gifts", "a nurse", "thank you", 75, { topic: "Nurses & healthcare", count: 8, minCount: 6, store: "nurses",
    slots: ["compression socks","insulated tumbler","badge reel","stethoscope case","gel shoe insoles","hand cream set","nurse tote bag","nurse mug"] }),
  P("thank-you-gifts-for-nurses-from-patients", "Thank you gifts for nurses from patients", "the nurse who cared for me", "thank you", 75, { topic: "Nurses & healthcare", count: 8, minCount: 6, store: "nurses",
    slots: ["insulated tumbler","badge reel","hand cream set","compression socks","nurse keychain","lavender candle","nurse ornament","nurse bracelet"], exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"] }),
  P("gifts-for-night-shift-nurses", "Gifts for night shift nurses", "a nurse who works nights", "Christmas", 75, { count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["blackout curtains","neck and shoulder massager","silk sleep mask","weighted blanket","aromatherapy diffuser","white noise machine","compression socks","insulated tumbler"], slotMust: [["curtain"],["massager"],["mask"],["blanket"],["diffuser"],["white noise","sound machine"],["sock"],["tumbler"]], store: "nurses", topic: "Nurses & healthcare", notes: "night shift, sleep, comfort" }),
  P("gifts-for-nursing-students", "Gifts for nursing students", "a nursing student", "graduation", 75, { topic: "Nurses & healthcare", count: 8, minCount: 6, store: "nurses",
    slots: ["nursing stethoscope","nursing study guide","penlight","badge reel","compression socks","nurse scrub cap","nursing clipboard","backpack"], exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"] }),
  P("nurse-retirement-gifts", "Nurse retirement gifts", "a retiring nurse", "retirement", 150, { topic: "Nurses & healthcare", store: "nurses", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["personalized retirement sign","retirement journal","nurse ornament","plush robe","gardening tool set","weekender bag","massage gun","1000 piece jigsaw puzzle"] }),
  P("christmas-gifts-for-doctors", "Christmas gifts for doctors", "a doctor", "Christmas", 200, { topic: "Nurses & healthcare", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["leather padfolio","insulated tumbler","noise cancelling earbuds","massage gun","pour over coffee set","leather messenger bag","wooden desk organizer","history of medicine book"] }),
  // office & work
  P("christmas-gifts-for-coworkers-under-25", "Christmas gifts for coworkers under $25", "a coworker", "Christmas", 25, { topic: "Work & office", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","drinking","adult party","plague","retirement","money scented","fart"],
    slots: ["desk plant","insulated tumbler","funny coffee mug","sticky notes set","hand cream","phone stand","desk fidget toy","soy candle"] }),
  P("secret-santa-gifts-under-25", "Secret Santa gifts under $25", "a coworker", "Secret Santa", 25, { count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["desk alarm clock","coffee gift set","leather cardholder","desk fidget toy","succulent planter","insulated tumbler","cozy socks","wireless charging pad"], slotMust: [["clock"],["coffee"],["cardholder","card holder","card case"],["desk toy","fidget","puzzle"],["succulent","planter","plant"],["tumbler"],["sock"],["charging pad","charger"]], topic: "Work & office" }),
  P("secret-santa-gifts-under-50", "Secret Santa gifts under $50", "a coworker or friend", "Secret Santa", 50, { topic: "Work & office", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","drinking","adult party","plague","retirement","money scented","fart"],
    slots: ["mini bluetooth speaker","cozy socks","insulated tumbler","family board game","desk plant","soy candle","LED desk lamp","throw blanket"] }),
  P("white-elephant-gifts-under-30", "White elephant gifts under $30", "anyone at a gift exchange", "white elephant", 30, { topic: "Work & office", notes: "fun, crowd-pleasing, gets stolen" }),
  // funny & gag gifts
  P("funny-gifts-for-coworkers", "Funny gifts for coworkers", "a coworker with a sense of humor", "Christmas or Secret Santa", 30, { topic: "Work & office", count: 8, minCount: 6, exclude: [...["sexy","adult toy","nsfw","vibrator","lingerie","penis","boob","x-rated","naughty","swear","f*ck","gift card","dog toy","dog trainer","for dogs","halloween"], "drinking"],
    notes: "funny but safe for work: office humor that gets a laugh at the gift exchange without HR getting involved",
    slots: ["funny coffee mug","fart scented candle","funny desk sign","funny sticky notes","desk zen garden","funny socks","mini desk punching bag","funny notebook"] }),
  P("gag-gifts-under-25", "Gag gifts under $25", "anyone who loves a good joke", "white elephant or Secret Santa", 25, { topic: "Holidays", count: 8, minCount: 6, exclude: ["sexy","adult toy","nsfw","vibrator","lingerie","penis","boob","x-rated","naughty","swear","f*ck","gift card","dog toy","dog trainer","for dogs","halloween"],
    notes: "silly gag gifts that get the biggest laugh when unwrapped; lighthearted, not crude",
    slots: ["fart candle","toilet golf game","rubber chicken","novelty socks","whoopee cushion","giant gummy bear","canned unicorn meat","toilet night light"] }),
  P("funny-gifts-for-pharmacists", "Funny gifts for pharmacists", "a pharmacist with a sense of humor", "Christmas", 35, { topic: "Nurses & healthcare", count: 8, minCount: 5, exclude: ["sexy","adult toy","nsfw","vibrator","lingerie","penis","boob","x-rated","naughty","swear","f*ck","gift card","dog toy","dog trainer","for dogs","halloween"],
    notes: "pharmacy humor: pill puns, plague doctor jokes, the counting tray life; funny but kind",
    slots: ["plague doctor mug","funny pharmacist mug","pill shaped stress ball","pharmacist wood desk sign","funny pharmacist t-shirt","pill socks","pharmacy pun keychain","funny pharmacy tumbler"] }),
  P("funny-gifts-for-nurses", "Funny gifts for nurses", "a nurse with a sense of humor", "Christmas", 35, { topic: "Nurses & healthcare", store: "nurses", count: 8, minCount: 6, exclude: ["sexy","adult toy","nsfw","vibrator","lingerie","penis","boob","x-rated","naughty","swear","f*ck","gift card","dog toy","dog trainer","for dogs","halloween"],
    notes: "nurse humor that gets a laugh in the break room: night shift jokes, coffee and caffeine humor, funny badge reels; funny but kind",
    slots: ["funny nurse mug","funny nurse badge reel","funny nurse socks","funny nurse t-shirt","funny nurse coffee tumbler","nurse sticker pack","funny nurse keychain","funny nurse notebook"] }),
  P("funny-gifts-for-dad", "Funny gifts for dad", "my dad, who loves a dad joke", "Christmas or Father's Day", 50, { topic: "Family & interests", count: 8, minCount: 6, exclude: ["sexy","adult toy","nsfw","vibrator","lingerie","penis","boob","x-rated","naughty","swear","f*ck","gift card","dog toy","dog trainer","for dogs","halloween"],
    notes: "dad humor: dad jokes, grilling and golf jokes, things that make the whole family groan and laugh",
    slots: ["dad joke book","funny dad mug","funny BBQ apron for dad","funny socks for men","funny beer glass","funny dad hat","golf gag gift","funny dad t-shirt"] }),
  P("christmas-gifts-for-boss", "Christmas gifts for your boss", "my boss", "Christmas", 100, { topic: "Work & office" }),
  P("group-gifts-for-boss-from-team", "Group gifts for a boss from the team", "our boss, from the whole team", "Christmas", 300, { topic: "Work & office" }),
  P("christmas-gifts-for-clients", "Christmas gifts for clients", "a client", "Christmas", 100, { topic: "Work & office", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre"],
    slots: ["leather padfolio","insulated tumbler","engraved pen","desk clock","charcuterie board","wine glasses set","coffee table book","luxury candle"] }),
  P("christmas-gifts-for-employees", "Christmas gifts for employees", "an employee", "Christmas", 50, { topic: "Work & office" }),
  P("retirement-gifts-for-coworkers", "Retirement gifts for coworkers", "a retiring coworker", "retirement", 150, { topic: "Work & office" }),
  P("group-gifts-for-teachers-from-class", "Group gifts for a teacher from the class", "our child's teacher, from the whole class", "Christmas", 200, { topic: "Work & office", count: 8, minCount: 6,
    slots: ["e-reader","noise cancelling headphones","massage gun","insulated tumbler","teacher planner","weighted blanket","spa gift set","teacher tote bag"] }),
  // holidays
  P("what-to-bring-to-thanksgiving-not-food", "What to bring to Thanksgiving if you're told not to bring food", "the Thanksgiving host", "Thanksgiving dinner, as a guest who was told not to bring food", 60,
    { topic: "Holidays", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["table runner","linen napkins set","serving board","taper candles","potted houseplant","wine aerator","party card game","cheese knife set"] }),
  P("thanksgiving-hostess-gifts-under-25", "Thanksgiving hostess gifts under $25", "the Thanksgiving host", "Thanksgiving", 25, { topic: "Holidays", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","bible","dog breed"],
    slots: ["soy candle","kitchen towel set","cheese knife set","wine stopper","cloth napkins","succulent","coaster set","spoon rest"] }),
  P("friendsgiving-host-gifts", "Friendsgiving host gifts", "a friend hosting Friendsgiving", "Friendsgiving", 40, { topic: "Holidays", notes: "casual, fun, not food" }),
  P("hanukkah-gifts-for-adults", "Hanukkah gifts for adults", "an adult who celebrates Hanukkah", "Hanukkah", 75, { topic: "Holidays", notes: "tasteful Hanukkah or everyday gifts; menorah, dreidel sets, home items" }),
  P("christmas-gifts-for-teens", "Christmas gifts for teens", "a teenager", "Christmas", 75, { topic: "Holidays", count: 8, minCount: 6,
    slots: ["wireless earbuds","LED strip lights","instant camera","bluetooth speaker","oversized hoodie","party card game","ring light","sling bag"] }),
  P("christmas-gifts-under-20", "Christmas gifts under $20", "anyone on my list", "Christmas", 20, { topic: "Holidays" }),
  P("christmas-gifts-under-10", "Christmas gifts under $10", "anyone on my list", "Christmas", 10, { topic: "Holidays", count: 8, minCount: 6,
    slots: ["snowflake glass ornament","fuzzy socks","lip balm","keychain","mini puzzle","hand cream","card game","bookmark"], exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"] }),
  P("last-minute-christmas-gifts", "Last-minute Christmas gifts", "anyone on my list", "Christmas, needed fast", 75, { topic: "Holidays", notes: "widely in stock at big retailers" }),
  P("christmas-gifts-for-neighbors", "Christmas gifts for neighbors", "my neighbors", "Christmas", 25, { topic: "Holidays", count: 8, minCount: 6,
    slots: ["snowflake glass ornament","scented candle","kitchen towel set","doormat","succulent","mug","cookie cutter set","wine stopper"], exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"] }),
  P("christmas-gifts-for-mail-carrier", "Christmas gifts for your mail carrier", "our mail carrier", "Christmas thank you", 25, { topic: "Holidays", count: 8, minCount: 6,
    slots: ["insulated gloves","hand warmers","insulated travel mug","rain poncho","wool socks","neck gaiter","lip balm set","power bank"] }),
  P("christmas-gifts-for-babysitter", "Christmas gifts for the babysitter", "our babysitter", "Christmas thank you", 50, { topic: "Holidays", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["insulated tumbler","cozy throw blanket","skincare gift set","canvas tote bag","wireless earbuds","guided journal","mini bluetooth speaker","fuzzy socks"] }),
  P("christmas-gifts-for-in-laws", "Christmas gifts for in-laws", "my in-laws", "Christmas", 100, { topic: "Holidays", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["wine glasses set","digital photo frame","charcuterie board","board game for couples","throw blanket","bird feeder","personalized family sign","coffee table book"] }),
  P("christmas-gifts-for-couples", "Christmas gifts for couples", "a couple", "Christmas", 100, { topic: "Holidays", notes: "something they share" }),
  P("new-years-eve-party-host-gifts", "New Year's Eve party host gifts", "the New Year's Eve party host", "New Year's Eve", 50, { count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["crystal champagne flutes","champagne bucket","champagne stopper","party game","luxury playing cards","cocktail shaker set","string lights","countdown clock"], slotMust: [["flute"],["bucket","cooler"],["stopper","saver"],["game"],["playing card"],["shaker"],["string light","fairy light"],["clock"]], topic: "Holidays", notes: "champagne accessories, games, not food" }),
  // life events
  P("housewarming-gifts", "Housewarming gifts that aren't boring", "a friend who just moved", "housewarming", 75, { topic: "Life events", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["indoor plant pot","olive wood cutting board","scented candle","personalized doormat","throw pillow","cocktail shaker set","cheese board set","herb garden kit"] }),
  P("gifts-for-new-homeowners", "Gifts for new homeowners", "new homeowners", "first home", 100, { count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["personalized cutting board","house number plaque","welcome doormat","luxury candle","indoor tabletop fountain","cheese board set","home tool kit","smart video doorbell"], slotMust: [["cutting board"],["number","address","plaque"],["doormat","door mat"],["candle"],["fountain"],["cheese","charcuterie"],["tool"],["doorbell"]], topic: "Life events" }),
  P("gifts-for-new-parents", "Gifts for new parents (not the baby)", "new parents", "new baby", 75, { topic: "Life events", count: 8, minCount: 6,
    slots: ["white noise machine","weighted blanket","massage gun","insulated tumbler","plush robe","digital photo frame","silk sleep mask","slippers"] }),
  P("sympathy-gifts", "Thoughtful sympathy gifts", "someone who lost a loved one", "sympathy", 75, { topic: "Life events", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["memorial wind chime","sympathy candle","memorial picture frame","soft throw blanket","remembrance ornament","grief journal","memorial garden stone","comfort tea gift set"], slotMust: [["chime"],["candle"],["frame"],["blanket","throw"],["ornament"],["journal"],["stone"],["tea"]] }),
  P("get-well-soon-gifts", "Get well soon gifts", "someone recovering", "get well", 60, { topic: "Life events", count: 8, minCount: 6,
    slots: ["weighted blanket","adult coloring book","fuzzy socks","herbal tea sampler","nature landscape jigsaw puzzle","bed tray","neck pillow","aromatherapy diffuser"], exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","bible","dog breed"] }),
  P("graduation-gifts-for-college-grads", "Graduation gifts for college grads", "a college graduate", "graduation", 100, { topic: "Life events" }),
  P("wedding-gifts-off-the-registry", "Wedding gifts off the registry", "a couple getting married", "wedding", 150, { topic: "Life events", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre"],
    slots: ["personalized cutting board","wedding photo album","personalized night sky star map","picnic basket for two","wine decanter","couples cookbook","throw blanket","keepsake box"] }),
  P("group-wedding-gifts-from-coworkers", "Group wedding gifts from coworkers", "a coworker who is getting married, from the team", "wedding", 250, { topic: "Life events", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["enameled dutch oven","kitchen knife set","wine decanter","luxury bath towel set","espresso machine","picnic backpack for two","personalized cutting board","crystal champagne flutes"] }),
  // professions
  P("gifts-for-teachers-under-25", "Gifts for teachers under $25", "a teacher", "Christmas", 25, { topic: "Professions", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["teacher mug","teacher tote bag","hand cream","personalized pen","desk plant","teacher stamp","insulated tumbler","sticky notes set"] }),
  P("gifts-for-accountants", "Gifts for accountants", "an accountant", "Christmas", 100, { topic: "Professions", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["desk calculator","leather desk mat","noise cancelling earbuds","fountain pen","mug warmer","monitor stand","weighted blanket","accountant mug"] }),
  P("gifts-for-realtors", "Gifts for realtors", "a real estate agent", "thank you", 100, { topic: "Professions" }),
  P("gifts-for-dentists", "Gifts for dentists", "a dentist", "Christmas", 100, { topic: "Professions" }),
  P("gifts-for-pharmacists", "Gifts for pharmacists", "a pharmacist", "Christmas", 75, { topic: "Professions", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","drinking","adult party","plague","retirement","money scented","fart"],
    slots: ["compression socks","insulated tumbler","pharmacy mug","gel shoe insoles","badge reel","hand cream set","pharmacist keychain","desk organizer"] }),
  P("gifts-for-firefighters", "Gifts for firefighters", "a firefighter", "Christmas", 75, { topic: "Professions", count: 8, minCount: 6, slots: ["rechargeable headlamp","insulated tumbler","boot dryer","firehouse cookbook","maltese cross keepsake","firefighter shadow box","recovery slides","compression socks"], slotMust: [["headlamp","flashlight"],["tumbler"],["dryer"],["firehouse","firefighter","fire station"],["maltese","firefighter"],["shadow box"],["slide","sandal"],["sock"]],
    notes: "things a firefighter uses on and off shift: a bright rechargeable flashlight or headlamp, an insulated tumbler, a boot dryer, a firehouse cookbook or kitchen gear for the station, fire-department themed keepsakes (the Maltese cross firefighter emblem, not religious crosses), recovery and comfort items after long shifts; at most one flask; no generic wallets",
    exclude: ["USMC", "Marine Corps", "U.S. Army", "US Army", "U.S. Navy", "US Navy", "Air Force", "Space Race", "Flowery", "Cross Wall Art"] }),
  P("gifts-for-police-officers", "Gifts for police officers", "a police officer", "Christmas", 75, { topic: "Professions", count: 8, minCount: 6, slots: ["tactical flashlight","insulated travel mug","car seat organizer","compression socks","thin blue line flag","badge shadow box","gel insoles","insulated lunch bag"], slotMust: [["flashlight"],["mug","tumbler"],["organizer"],["sock"],["thin blue line"],["shadow box","badge display"],["insole"],["lunch"]],
    notes: "practical for patrol shifts and long hours: a reliable flashlight, an insulated travel mug or tumbler, a duty-bag or car organizer, comfortable socks or insoles for long hours on their feet, thin blue line or police-themed keepsakes, a shadow box or badge display; nothing military-branch specific",
    exclude: ["concealed carry","holster","gun case","gun bag","handgun","ammo","magazine pouch","pistol", "USMC", "Marine Corps", "U.S. Army", "US Army", "U.S. Navy", "US Navy", "Air Force", "Space Race", "Espresso", "Coffee Press"] }),
  P("gifts-for-soldiers", "Gifts for soldiers", "a soldier serving in the military", "Christmas", 75, { topic: "Professions", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre", "knife", "knives", "dagger", "holster", "gun "],
    notes: "useful in the barracks or on deployment and easy to ship; no weapons or knives",
    slots: ["rugged digital watch","rechargeable headlamp","boot socks","power bank","hanging toiletry bag","travel pillow","photo keychain","camping blanket"] }),
  P("gifts-for-emts", "Gifts for EMTs and paramedics", "an EMT or paramedic", "Christmas", 75, { topic: "Professions", count: 8, minCount: 6, slots: ["Littmann Classic III stethoscope","trauma shears","medical penlight","nurse watch","compression socks","insulated tumbler","EMS pocket organizer","EMS duty bag"], slotMust: [["littmann","dual head","cardiology","adscope","mdf"],["shears"],["penlight"],["watch"],["sock"],["tumbler"],["organizer"],["bag"]],
    notes: "for long ambulance shifts: a quality stethoscope, trauma shears, a medical penlight, a watch with a second hand for taking vitals, compression socks, an insulated tumbler, a pocket organizer or EMS duty bag, comfort and recovery after 24-hour shifts; no trinkets or decor",
    exclude: ["gearwrench","lisle","cufflink","ornament","charm","necklace","earring","mechanic","automotive","stethoscope for car", "Trinket", "Treasure Box", "Keepsake Box", "Beaded"] }),
  P("gifts-for-lifeguards", "Gifts for lifeguards", "a lifeguard", "Christmas or end of the season", 60, { topic: "Professions", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["lifeguard whistle lanyard","polarized sunglasses","reef safe sunscreen","SPF lip balm","insulated water bottle","quick dry towel","wide brim hat","waterproof phone pouch"], slotMust: [["whistle"],["sunglasses"],["sunscreen"],["lip"],["bottle"],["towel"],["hat"],["pouch","case"]],
    notes: "for long days on the stand: a lifeguard whistle and lanyard, polarized sunglasses, a reef-safe sunscreen or SPF lip balm set, a big insulated water bottle, a quick-dry towel, a wide-brim hat, a waterproof phone pouch, a dry bag" }),
  P("gifts-for-computer-geeks", "Gifts for computer geeks", "someone who loves computers and tech", "Christmas", 100, { topic: "Professions", count: 8, minCount: 6,
    slots: ["mechanical keyboard", "ergonomic wireless mouse", "USB-C docking station", "portable SSD", "Raspberry Pi starter kit", "monitor light bar", "extended desk mat", "cable management kit"],
    notes: "for a computer enthusiast or programmer; finished consumer products, not bare components",
    exclude: ["ROHS", "HAT, BOARD", "Evaluation Kit", "replacement", "bulk"] }),
  P("what-to-get-a-computer-geek", "What to get a computer geek", "a computer geek, programmer or IT person", "Christmas", 150, { topic: "Professions", count: 10, minCount: 7,
    slots: ["split ergonomic keyboard", "Stream Deck", "noise cancelling headphones", "smart home starter kit", "electronics soldering kit", "USB digital microscope", "programming book", "retro handheld game console", "LEGO Technic set", "laptop stand"],
    notes: "ideas a computer person actually wants and may not buy for themselves: desk upgrades, tinkering kits, focus gear, nerdy fun; finished consumer products, not bare components; no software subscriptions or gift cards",
    exclude: ["ROHS", "HAT, BOARD", "Evaluation Kit", "replacement", "bulk", "gift card", "subscription", "for kids", "module", "antenna", "transceiver"] }),
  P("gifts-for-engineers", "Gifts for engineers", "an engineer", "Christmas", 100, { topic: "Professions", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre"],
    slots: ["LEGO Technic set","mechanical pencil set","engineering book","precision screwdriver set","digital caliper","mechanical keyboard","metal 3D puzzle","smart notebook"] }),
  P("gifts-for-pilots", "Gifts for pilots", "a pilot", "Christmas", 100, { topic: "Professions" }),
  // tech (count: exactly that many products, or the build fails rather than publish a short "10 best" list)
  P("10-best-high-tech-christmas-gifts", "10 best high-tech Christmas gifts", "someone who loves the latest tech", "Christmas", 300, { topic: "Tech", cap: 1, count: 10,
    slots: ["noise cancelling wireless headphones", "smartwatch", "smart display", "portable projector", "e-reader", "camera drone", "smart ring", "handheld gaming console", "instant camera", "robot vacuum"],
    notes: "ten standout gadgets, one of each kind: wireless noise-cancelling earbuds or headphones, a smartwatch or fitness tracker, a smart display or smart speaker, a portable projector, an e-reader, a camera drone, a smart ring, a handheld gaming console, an instant or action camera, a robot vacuum or smart home hub; no cables, cases or accessories" }),
  P("tech-gifts-under-50", "Tech gifts under $50", "someone who likes gadgets", "Christmas", 50, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["bluetooth tracker tag","power bank","smart plug","mini bluetooth speaker","wireless earbuds","phone stand","LED desk lamp","wireless charging pad"] }),
  P("tech-gifts-under-100", "Tech gifts under $100", "someone who likes gadgets", "Christmas", 100, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["wireless earbuds","fitness tracker","smart speaker","e-reader","portable SSD","mechanical keyboard","video doorbell","digital photo frame"], slotMust: [["earbud"],["fitness tracker","activity tracker"],["speaker"],["e-reader","ereader","kindle"],["ssd"],["keyboard"],["doorbell"],["frame"]] }),
  P("tech-stocking-stuffers", "Tech stocking stuffers", "anyone who loves gadgets", "Christmas stocking", 30, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["bluetooth tracker","keychain power bank","phone grip","mini tripod","USB-C wall charger","mini flashlight","cable organizer","phone camera lens kit"] }),
  P("tech-gifts-for-teens", "Tech gifts for teens", "a teenager", "Christmas", 100, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["wireless earbuds","instant camera","LED strip lights","bluetooth speaker","gaming headset","ring light","mini projector","fitness tracker"] }),
  P("tech-gifts-for-men", "Tech gifts for men", "a man who likes gadgets", "Christmas", 150, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["smartwatch","noise cancelling headphones","smart meat thermometer","wireless car charger mount","portable power station","camera drone","bluetooth tracker tag","wireless charging station"], slotMust: [["watch"],["headphone"],["thermometer"],["mount"],["power station"],["drone"],["tracker","tag"],["charging station","charging stand","charger stand"]] }),
  P("tech-gifts-for-women", "Tech gifts for women", "a woman who likes gadgets", "Christmas", 150, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["fitness tracker","wireless earbuds","digital photo frame","smart mug","e-reader","wireless charging stand","hair dryer brush","LED face mask"] }),
  P("tech-gifts-for-seniors", "Tech gifts for seniors and grandparents", "a grandparent or older adult", "Christmas", 150, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["wifi digital photo frame","smart display","large print e-reader","video doorbell","automatic pill dispenser","bluetooth tracker tag","big button phone","easy tv remote"], slotMust: [["frame"],["display","echo show","nest hub"],["e-reader","kindle","tablet"],["doorbell"],["pill"],["tracker","tag"],["phone"],["remote"]] }),
  P("smart-home-gifts", "Smart home gifts", "someone setting up a smart home", "Christmas", 150, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","gateway","hub only"],
    slots: ["smart plug","smart light bulbs","LED light strip","smart speaker","video doorbell","robot vacuum","smart thermostat","smart lock"], slotMust: [["plug"],["bulb"],["strip"],["speaker","display"],["doorbell"],["vacuum"],["thermostat"],["lock"]] }),
  P("gifts-for-gamers", "Gifts for gamers", "a gamer", "Christmas", 150, { topic: "Gaming", count: 8, minCount: 6, slots: ["wireless gaming headset","wireless game controller","mechanical gaming keyboard","wireless gaming mouse","extended gaming mouse pad","headset stand","controller charging dock","RGB light bars"], slotMust: [["headset"],["controller"],["keyboard"],["mouse"],["mouse pad","desk mat","mousepad"],["headset stand","headphone stand"],["charging dock","charging station","charger"],["light bar","light bars"]],
    notes: "one of each: a wireless gaming headset, an extra wireless controller, a mechanical gaming keyboard, a gaming mouse, a large desk mat, a headset stand, a controller charging dock, RGB light bars for the setup; no game codes, gift cards or PC parts",
    exclude: GAMING_EXCLUDE }),
  P("10-best-gifts-for-gamers", "10 best gifts for gamers", "a gamer", "Christmas", 250, { topic: "Gaming", count: 10,
    slots: ["wireless gaming headset", "pro wireless game controller", "mechanical gaming keyboard", "wireless gaming mouse", "gaming desk mat", "handheld gaming console", "controller charging dock", "RGB smart light bars", "gaming headset stand", "portable gaming monitor"],
    exclude: GAMING_EXCLUDE, notes: "ten different kinds of gaming gifts" }),
  P("gifts-for-gamers-under-50", "Gifts for gamers under $50", "a gamer", "Christmas", 50, { topic: "Gaming", count: 7, minCount: 5, slots: ["wireless gaming mouse", "extended gaming desk mat", "headset stand", "controller charging dock", "controller thumb grips", "RGB LED light strip", "gaming mug"], exclude: GAMING_EXCLUDE,
    notes: "useful under $50: a gaming mouse, a large desk mat, a headset stand, a controller charging dock, controller thumb grips, LED light strip, a cable organizer, a gaming-themed mug" }),
  P("gifts-for-pc-gamers", "Gifts for PC gamers", "a PC gamer", "Christmas", 150, { topic: "Gaming", count: 8, minCount: 6, slots: ["mechanical gaming keyboard","wireless gaming mouse","USB microphone","monitor light bar","extended desk mat","1080p webcam","gaming headset","headset stand"], slotMust: [["keyboard"],["mouse"],["microphone","mic"],["light bar"],["desk mat","mouse pad","mousepad"],["webcam"],["headset"],["headset stand","headphone stand"]], exclude: GAMING_EXCLUDE,
    notes: "finished accessories for a PC setup: a mechanical keyboard, a high-DPI wireless mouse, a USB microphone, a monitor light bar, a large desk mat, a webcam, a headset; not internal PC parts like fans, cables or cases" }),
  P("gifts-for-nintendo-switch-players", "Gifts for Nintendo Switch players", "someone who plays Nintendo Switch", "Christmas", 100, { topic: "Gaming", count: 6, minCount: 5, slots: ["Nintendo Switch Pro Controller", "Nintendo Switch carrying case", "Joy-Con charging dock", "microSD card for Nintendo Switch", "Joy-Con controllers", "wired gaming headset with mic for Nintendo Switch"], exclude: GAMING_EXCLUDE,
    notes: "Switch accessories: a Pro Controller, a carrying case, a charging dock, a screen protector kit, a microSD card, extra Joy-Con controllers, a Switch-compatible headset" }),
  P("gifts-for-ps5-players", "Gifts for PS5 players", "someone who plays PlayStation 5", "Christmas", 150, { topic: "Gaming", count: 6, minCount: 5, slots: ["DualSense wireless controller", "PS5 controller charging station", "PS5 wireless gaming headset", "PS5 controller faceplate", "NVMe SSD for PS5", "PS5 vertical stand"], exclude: GAMING_EXCLUDE,
    notes: "PS5 accessories: a DualSense controller, a controller charging station, a PS5-compatible wireless headset, a controller skin or faceplate, an NVMe SSD for PS5 storage, a vertical stand" }),
  P("gifts-for-xbox-players", "Gifts for Xbox players", "someone who plays Xbox", "Christmas", 150, { topic: "Gaming", count: 5, minCount: 4, slots: ["Xbox wireless controller", "Xbox rechargeable battery kit", "Xbox wireless headset", "Xbox storage expansion card", "controller stand"], exclude: GAMING_EXCLUDE,
    notes: "Xbox accessories: an Xbox wireless controller, a rechargeable battery kit or charging dock, an Xbox-compatible headset, a storage expansion card, a controller stand" }),
  P("gifts-for-retro-gamers", "Gifts for retro gamers", "someone who loves retro and classic video games", "Christmas", 100, { topic: "Gaming", count: 6, minCount: 5, slots: ["plug and play HDMI retro console", "handheld retro console", "arcade fight stick", "tabletop arcade cabinet", "pixel art lamp", "retro USB controller"], exclude: GAMING_EXCLUDE,
    notes: "a retro mini console, a handheld retro console, an arcade stick, a tabletop arcade cabinet, a pixel art lamp, a retro controller for PC" }),
  P("gifts-for-streamers", "Gifts for streamers and content creators", "someone who streams games or makes videos", "Christmas", 150, { topic: "Gaming", count: 6, minCount: 5, slots: ["USB microphone with boom arm", "streaming ring light", "Stream Deck", "1080p streaming webcam", "4K capture card", "on air sign light"], exclude: [...GAMING_EXCLUDE, "welding"],
    notes: "a USB microphone with boom arm, a ring light or key light, a stream control deck, a 1080p webcam, a capture card, a green screen, an on-air sign light" }),
  P("gifts-for-gamer-boyfriend", "Gifts for your gamer boyfriend", "my boyfriend, who loves video games", "Christmas", 100, { topic: "Gaming", count: 6, minCount: 5, slots: ["wireless gaming headset", "wireless game controller", "gaming hoodie", "headset stand", "gaming desk mat", "RGB LED light strip"], exclude: [...GAMING_EXCLUDE, ...NICHE_NOVELTY],
    notes: "a wireless headset, an extra controller, a gaming hoodie, a headset stand, a desk mat, LED lights for his setup, a personalized gamer keepsake" }),
  P("gifts-for-gamer-girlfriend", "Gifts for your gamer girlfriend", "my girlfriend, who loves video games", "Christmas", 100, { topic: "Gaming", count: 8, minCount: 6, slots: ["pastel wireless gaming headset","pastel game controller","cozy gaming blanket","cat ear desk lamp","Nintendo Switch carrying case","LED light strip","kawaii mouse pad","cat paw wrist rest"], slotMust: [["headset","headphone"],["controller","joy-con","joy con"],["blanket","hoodie"],["lamp","light"],["case","cover"],["strip"],["mouse pad","mousepad","desk mat"],["wrist rest"]], exclude: [...GAMING_EXCLUDE, ...NICHE_NOVELTY],
    notes: "a cute wireless headset, a pastel or themed controller, a cozy gaming blanket or hoodie, a cat-ear or aesthetic desk setup piece, a Switch case, LED lights" }),
  P("gifts-for-board-game-lovers", "Gifts for board game lovers", "someone who loves board games", "Christmas", 75, { topic: "Gaming", count: 7, minCount: 5, slots: ["strategy board game", "party board game", "two-player board game for couples", "dice tower", "metal dice set", "automatic card shuffler", "board game organizer"],
    notes: "a popular strategy or party board game, a game night table topper or dice tower, a premium dice set, a card shuffler, a board game storage organizer, a two-player game for couples" }),
  P("home-office-tech-gifts", "Home office gifts for remote workers", "someone who works from home", "Christmas", 100, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["1080p webcam","monitor light bar","USB-C docking station","noise cancelling headphones","laptop stand","large desk mat","wireless charging pad","ergonomic mouse"], slotMust: [["webcam"],["light bar","monitor light"],["dock","hub"],["headphone"],["laptop stand"],["desk mat","desk pad"],["charging pad","charger"],["mouse"]] }),
  P("travel-tech-gifts", "Travel tech gifts", "someone who travels a lot", "Christmas", 100, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["universal travel adapter","noise cancelling earbuds","power bank","luggage tracker tag","travel charging station","airplane phone mount","travel cable organizer","travel hair dryer"] }),
  P("fitness-tech-gifts", "Fitness tech gifts", "someone who works out", "Christmas", 150, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["fitness tracker","sport earbuds","massage gun","smart jump rope","heart rate monitor chest strap","smart water bottle","smart scale","fitness smartwatch"], slotMust: [["tracker","band"],["earbud"],["massage"],["jump rope"],["heart rate"],["bottle"],["scale"],["watch"]] }),
  P("gifts-for-photographers", "Gifts for photographers", "a photographer", "Christmas", 150, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["camera sling bag","travel tripod","SD card","lens cleaning kit","camera strap","LED video light","portable SSD","camera lens filter"], slotMust: [["bag","sling","backpack"],["tripod"],["sd card","memory card","card reader"],["clean"],["strap"],["light"],["ssd"],["filter"]] }),
  P("kitchen-gadget-gifts", "Kitchen gadget gifts", "someone who loves to cook", "Christmas", 100, { topic: "Tech", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["air fryer","smart meat thermometer","immersion blender","gooseneck electric kettle","sous vide cooker","digital kitchen scale","electric spice grinder","milk frother"], slotMust: [["air fryer"],["thermometer"],["immersion","hand blender","stick blender"],["kettle"],["sous vide","precision cooker"],["scale"],["grinder"],["frother"]] }),
  // hobbies
  P("gifts-for-fishermen", "Gifts for fishermen", "someone who loves fishing", "Christmas", 100, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk"],
    slots: ["tackle bag","fishing pliers","polarized fishing sunglasses","fishing lure assortment","waterproof dry bag","rod holder","fishing hat","fishing line spooler"] }),
  P("gifts-for-hunters", "Gifts for hunters", "someone who hunts", "Christmas", 150, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk"], notes: "no firearms, ammunition or weapons",
    slots: ["cellular trail camera","10x42 binoculars","heated gloves","rechargeable headlamp","insulated thermos","hunting backpack","hunting seat cushion","rechargeable hand warmer"] }),
  P("gifts-for-gardeners", "Gifts for gardeners", "someone who loves gardening", "Christmas", 75, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["bypass pruners","garden kneeler seat","gardening gloves","garden tool set","hose nozzle","raised garden bed","seed starting kit","garden journal"], slotMust: [["pruner","shears"],["kneeler"],["glove"],["tool set","tool kit","tools"],["nozzle"],["raised","planter"],["seed"],["journal","planner"]] }),
  P("gifts-for-campers", "Gifts for campers", "someone who loves camping", "Christmas", 100, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk"],
    slots: ["camping lantern","portable camp stove","camping hammock","sleeping pad","camp chair","water filter","insulated camp mug","cast iron camping skillet"] }),
  P("gifts-for-hikers", "Gifts for hikers", "someone who loves hiking", "Christmas", 100, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk"],
    slots: ["trekking poles","hiking daypack","water filter bottle","merino hiking socks","rechargeable headlamp","packable rain jacket","trail first aid kit","hydration reservoir"] }),
  P("gifts-for-bow-hunters", "Gifts for bow hunters", "a bow hunter", "Christmas", 150, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk","double bass","violin","cello","wreath","ribbon","bass bow","chicken","coop","cartridge","nes ","inquiry","repellent","working spray","hairspray","hair spray","toy duck","resting duck","cast iron duck"],
    notes: "gear and comfort for long sits in the stand; no arrows, broadheads or weapons; archery bows only, never musical-instrument bows or ribbon bows",
    slots: ["archery rangefinder","tree stand cushion","hunting backpack","cellular trail camera","heated hand muff","10x42 binoculars","heated socks","archery target"], slotMust: [["rangefinder"],["cushion","seat"],["pack"],["camera"],["muff","hand warmer"],["binocular"],["sock"],["archery target","bag target","block target","3d target"]] }),
  P("gifts-for-deer-hunters", "Gifts for deer hunters", "a deer hunter", "Christmas", 150, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk","working spray","hairspray","hair spray","double bass","bass bow","violin","cello","wreath","ribbon","chicken","coop","cartridge","nes ","inquiry","repellent","toy duck","resting duck","cast iron duck"],
    notes: "for whitetail season: scouting, comfort and calls; no firearms, ammunition or weapons",
    slots: ["cellular trail camera","hunting blind chair","deer hunting scent killer spray","deer grunt call","heated socks","tree stand seat","insulated hunting gloves","hunting headlamp"], slotMust: [["camera"],["chair","seat","stool"],["scent killer","scent control","scent eliminat"],["grunt","deer call"],["sock"],["seat","cushion"],["glove"],["headlamp"]] }),
  P("gifts-for-duck-hunters", "Gifts for duck hunters", "a duck hunter", "Christmas", 150, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk","double bass","bass bow","violin","cello","wreath","ribbon","chicken","coop","cartridge","nes ","inquiry","repellent","working spray","hairspray","hair spray","toy duck","resting duck","cast iron duck"],
    notes: "for cold mornings in the marsh; no firearms, ammunition or weapons",
    slots: ["mallard duck call","duck decoys","waterproof hunting gloves","hunting waders","dog training dummy","blind bag","heated vest","rechargeable hand warmer"], slotMust: [["duck call","mallard call","goose call"],["decoy"],["glove"],["wader"],["dummy","bumper"],["blind bag"],["vest"],["hand warmer"]] }),
  P("gifts-for-fly-fishermen", "Gifts for fly fishermen", "someone who loves fly fishing", "Christmas", 150, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk"],
    notes: "for the fly angler: tying, the river and the vest",
    slots: ["fly box","fly tying kit","fly fishing landing net","fishing vest","fly fishing book","fishing nippers zinger","fly floatant","polarized fishing sunglasses"] }),
  P("gifts-for-bass-fishermen", "Gifts for bass fishermen", "someone who loves bass fishing", "Christmas", 100, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk"],
    notes: "for the bass angler: lures, tackle and the boat",
    slots: ["bass lure kit","soft plastic bait assortment","lip gripper scale","tackle box","braided fishing line","rod rack","bass fishing hat","fishing towel"] }),
  P("gifts-for-ice-fishermen", "Gifts for ice fishermen", "someone who loves ice fishing", "Christmas", 100, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk"],
    notes: "for frozen lakes: gear, warmth and grip",
    slots: ["ice fishing rod combo","tip up","ice fishing bucket seat","heated gloves","hand warmers","ice cleats","ice fishing jig set","insulated thermos"] }),
  P("gifts-for-outdoorsmen", "Gifts for outdoorsmen and sportsmen", "an outdoorsman", "Christmas", 150, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk"],
    notes: "for the man who hunts, fishes and camps; no firearms, ammunition or weapons",
    slots: ["insulated thermos","10x42 binoculars","rechargeable headlamp","camp chair","hard cooler","heated vest","fire starter kit","outdoor multitool"] }),
  P("gifts-for-kayakers", "Gifts for kayakers", "someone who loves kayaking", "Christmas", 100, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk"],
    notes: "for paddlers: dry, comfortable and safe on the water",
    slots: ["dry bag","paddle leash","waterproof phone case","kayak seat cushion","paddling gloves","kayak deck bag","bilge pump","sun hat"] }),
  P("gifts-for-boaters", "Gifts for boaters", "someone who loves their boat", "Christmas", 150, { topic: "Outdoors", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","scope mount","holster","bullet","broadhead","arrows","crossbow bolt","gift card","replacement","bulk","neon","rainbow","costume"],
    notes: "for boat owners: on deck, on the dock and safety",
    slots: ["marine bluetooth speaker","floating keychain","boat fender","marine binoculars","boat cooler","yacht captain hat","inflatable life jacket","boat cleaning kit"] }),
  P("wedding-registry-ideas", "Wedding registry ideas (from any store)", "a couple getting married", "wedding registry", 400, { topic: "Registries", count: 8, minCount: 6, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife sharpener stone","toy","costume","halloween"],
    notes: "the classic, lasting things couples actually use for years: kitchen, bed, bath and hosting",
    slots: ["stand mixer","enameled dutch oven","kitchen knife block set","luxury bath towel set","stainless steel cookware set","percale sheet set","espresso machine","crystal wine glasses"], slotMust: [["stand mixer"],["dutch oven"],["knife set","knife block"],["towel"],["cookware"],["sheet"],["espresso"],["wine glass"]] }),
  P("wedding-registry-items-under-100", "Wedding registry items under $100", "a couple getting married", "wedding registry", 100, { topic: "Registries", count: 8, minCount: 6, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife sharpener stone","toy","costume","halloween"],
    notes: "well-made registry items guests can afford: hosting, kitchen and home",
    slots: ["cast iron skillet","stemless wine glasses set","bath towel set","cheese board set","wooden salad bowl","burr coffee grinder","picnic basket for two","throw blanket"], slotMust: [["skillet"],["wine glass"],["towel"],["cheese board","charcuterie"],["salad bowl"],["grinder"],["picnic"],["throw"]] }),
  P("baby-registry-must-haves", "Baby registry must-haves", "expecting parents", "baby registry", 250, { topic: "Registries", count: 8, minCount: 6, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife sharpener stone","toy","costume","halloween","bumper","inclined","sleep positioner","weighted","rocker sleeper"],
    notes: "the practical first-year essentials parents rely on; safe-sleep friendly only (no bumpers, inclined sleepers or weighted sleep products)",
    slots: ["video baby monitor","muslin swaddle blankets","baby carrier","diaper bag backpack","white noise machine","bottle warmer","infant bath tub","nursing pillow"], slotMust: [["monitor"],["swaddle"],["carrier"],["diaper bag"],["white noise","sound machine"],["bottle warmer"],["bath tub","bathtub"],["nursing pillow"]] }),
  P("housewarming-registry-ideas", "Housewarming registry ideas", "someone who just bought their first home", "housewarming registry", 300, { topic: "Registries", count: 8, minCount: 6, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife sharpener stone","toy","costume","halloween"],
    notes: "first-home essentials people actually use: cleaning, tools, kitchen and comfort",
    slots: ["cordless stick vacuum","air fryer","home tool kit","cordless drill","drip coffee maker","large cutting board","throw blanket","indoor plant pot"], slotMust: [["vacuum"],["air fryer"],["tool kit","tool set"],["drill"],["coffee maker"],["cutting board"],["throw"],["planter","plant pot"]] }),
  P("universal-gift-registry-ideas", "Universal gift registry ideas: one list from every store", "anyone making a gift list", "a registry from any store", 400, { topic: "Registries", count: 8, minCount: 6, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife sharpener stone","toy","costume","halloween"],
    notes: "the most-wanted registry items across stores, for any occasion: wedding, new home, new baby or a big birthday",
    slots: ["robot vacuum","enameled dutch oven","carry-on luggage","espresso machine","linen sheet set","nonstick cookware set","picnic backpack","digital photo frame"], slotMust: [["robot vacuum"],["dutch oven"],["carry-on","carry on"],["espresso"],["sheet"],["cookware"],["picnic"],["photo frame"]] }),
  P("gifts-for-preppers", "Gifts for preppers", "a prepper who likes to be ready for anything", "Christmas", 150, { topic: "Preparedness", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","holster","bullet","knife","knives","machete","tomahawk","crossbow","slingshot","taser","stun gun","pepper spray","gift card","replacement","refill only","bulk","toy","costume","halloween"],
    notes: "useful, well-made readiness gear they'll actually keep in the kit; no weapons",
    slots: ["hand crank emergency radio","portable water filter","solar power bank","first aid kit","emergency mylar blankets","fire starter kit","freeze dried food bucket","survival guide book"], slotMust: [["radio"],["water filter","filter straw","purifier"],["solar"],["first aid","trauma kit"],["emergency blanket","mylar","space blanket"],["fire starter","ferro","firestarter"],["freeze dried","freeze-dried","emergency food"],["survival","prepper"]] }),
  P("gifts-for-preppers-under-50", "Gifts for preppers under $50", "a prepper", "Christmas", 50, { topic: "Preparedness", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","holster","bullet","knife","knives","machete","tomahawk","crossbow","slingshot","taser","stun gun","pepper spray","gift card","replacement","refill only","bulk","toy","costume","halloween"],
    notes: "small, practical readiness gear under $50; no weapons",
    slots: ["water filter straw","rechargeable headlamp","emergency mylar blankets","fire starter","paracord bracelet","compact first aid kit","waterproof matches","emergency whistle"], slotMust: [["filter straw","water filter","lifestraw"],["headlamp"],["emergency blanket","mylar","space blanket"],["fire starter","ferro","firestarter"],["paracord"],["first aid"],["match"],["whistle"]] }),
  P("storm-preparedness-gifts", "Storm preparedness gifts", "someone in hurricane or storm country", "hurricane or winter storm season", 100, { topic: "Preparedness", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","holster","bullet","knife","knives","machete","tomahawk","crossbow","slingshot","taser","stun gun","pepper spray","gift card","replacement","refill only","bulk","toy","costume","halloween"],
    notes: "what you want when the power and the phone lines go down in a storm: light, power, news, water and safety",
    slots: ["NOAA weather alert radio","rechargeable LED lantern","high capacity power bank","collapsible water container","first aid kit","waterproof document bag","rechargeable flashlight","battery organizer storage case"], slotMust: [["weather radio","noaa","weather alert"],["lantern"],["power bank","portable charger"],["water container","water jug","water storage"],["first aid"],["document","fireproof bag","waterproof bag"],["flashlight"],["battery organizer","battery storage","battery case"]] }),
  P("power-outage-essentials", "Power outage essentials (that make great gifts)", "anyone who lives where the power goes out", "winter storm season", 200, { topic: "Preparedness", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","holster","bullet","knife","knives","machete","tomahawk","crossbow","slingshot","taser","stun gun","pepper spray","gift card","replacement","refill only","bulk","toy","costume","halloween","arlo","camera","propane","butane","kerosene"],
    notes: "keeping lights, phones, food and warmth going through an outage; indoor-safe items only (no fuel-burning stoves or heaters)",
    slots: ["portable power station","rechargeable LED lantern","hand crank emergency radio","battery powered fan heater","foldable solar panel for power station","rechargeable hand warmer","headlamp","insulated cooler"], slotMust: [["power station"],["lantern"],["radio"],["heater","fan"],["solar panel","solar charger"],["hand warmer"],["headlamp"],["cooler"]] }),
  P("car-emergency-kit-gifts", "Car emergency kit gifts", "a new driver or anyone who drives in winter", "Christmas", 100, { topic: "Preparedness", count: 8, minCount: 6, exclude: ["ammo","ammunition","rifle","firearm","gun ","guns","pistol","handgun","shotgun","holster","bullet","knife","knives","machete","tomahawk","crossbow","slingshot","taser","stun gun","pepper spray","gift card","replacement","refill only","bulk","toy","costume","halloween"],
    notes: "for the trunk: getting unstuck, jump-started and found; great for new drivers and winter roads",
    slots: ["portable jump starter","tire inflator","roadside emergency kit","snow brush ice scraper","folding snow shovel","emergency blanket","LED road flares","traction mats"], slotMust: [["jump starter"],["inflator","air compressor"],["roadside","emergency kit"],["scraper","snow brush"],["shovel"],["blanket"],["flare"],["traction"]] }),
  P("gifts-for-bakers", "Gifts for bakers", "someone who loves to bake", "Christmas", 75, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["hand mixer","digital kitchen scale","bread proofing basket","silicone pastry mat","cookie decorating kit","baking sheet set","baking cookbook","bench scraper"], slotMust: [["mixer"],["scale"],["proofing","banneton"],["pastry mat","baking mat"],["decorating"],["sheet","pan"],["book","cookbook"],["scraper"]] }),
  P("gifts-for-book-lovers", "Gifts for book lovers", "someone who loves to read", "Christmas", 50, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["book light","reading pillow","book stand","bookends","book embosser","reading journal","e-reader cover","literary candle"], slotMust: [["light","lamp"],["pillow"],["stand","holder"],["bookend"],["embosser","stamp"],["journal"],["cover","case","sleeve"],["candle"]] }),
  P("gifts-for-music-lovers", "Gifts for music lovers", "someone who loves music", "Christmas", 100, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["record player","over ear headphones","bluetooth speaker","vinyl record storage crate","music poster print","concert ukulele","guitar picks set","vinyl record frame"], slotMust: [["turntable","record player"],["headphone"],["speaker"],["storage","crate"],["print","poster"],["ukulele"],["pick"],["frame"]] }),
  P("gifts-for-crafters", "Gifts for crafters", "someone who loves crafts", "Christmas", 75, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["craft storage organizer","self healing cutting mat","fabric scissors","crochet kit","sewing kit","embroidery kit","craft lamp","hot glue gun"], slotMust: [["organizer","storage"],["cutting mat"],["scissors","shears"],["crochet","knit"],["sewing"],["embroidery"],["lamp","light"],["glue gun"]] }),
  P("gifts-for-dog-lovers", "Gifts for dog lovers", "someone who loves their dog", "Christmas", 50, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["custom pet portrait","dog ornament","dog mom mug","dog throw blanket","treat dispensing pet camera","dog walking bag","calming dog bed","dog socks"], slotMust: [["portrait"],["ornament"],["mug"],["blanket","throw"],["camera"],["bag","pouch"],["bed"],["sock"]] }),
  P("gifts-for-cat-lovers", "Gifts for cat lovers", "someone who loves their cat", "Christmas", 50, { topic: "Hobbies", count: 8, minCount: 6,
    slots: ["cat window perch","cat tree","interactive cat toy","cat mug","cat socks","custom cat portrait","cat throw blanket","cat book"] }),
  P("gifts-for-wine-lovers", "Gifts for wine lovers", "someone who loves wine", "Christmas", 75, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["electric wine opener","wine aerator","crystal wine glasses","wine chiller","wine tasting journal","countertop wine rack","wine preserver","wine decanter"], slotMust: [["opener","corkscrew"],["aerator"],["glass"],["chiller","cooler"],["journal","notebook"],["rack"],["preserver","stopper","saver"],["decanter"]] }),
  P("gifts-for-runners", "Gifts for runners", "someone who runs", "Christmas", 100, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["running belt","sport earbuds","GPS running watch","foam roller","running socks","clip on running light","hydration vest","running gloves"], slotMust: [["belt"],["earbud"],["watch"],["roller"],["sock"],["light"],["hydration","vest"],["glove"]] }),
  P("gifts-for-tea-lovers", "Gifts for tea lovers", "someone who loves tea", "Christmas", 50, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["glass teapot","gooseneck electric kettle","loose leaf tea sampler","matcha set","tea mug with infuser","tea storage tins","tea infuser","tea cup and saucer set"], slotMust: [["teapot"],["kettle"],["sampler","variety","collection"],["matcha"],["mug"],["tin","canister"],["infuser"],["cup"]] }),
  P("gifts-for-beer-lovers", "Gifts for beer lovers", "someone who loves craft beer", "Christmas", 50, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["home brewing kit","craft beer glasses set","insulated growler","beer cap map","wall mounted bottle opener","beer tasting journal","beer can koozie","beer chiller sticks"], slotMust: [["brew"],["glass"],["growler"],["cap map","cap display","cap holder"],["opener"],["journal"],["koozie","can cooler","coozie"],["chiller"]],
    notes: "a home brewing kit, beer glasses set, an insulated growler, a beer cap map or display, a bottle opener, a beer tasting journal" }),
  P("gifts-for-yoga-lovers", "Gifts for yoga lovers", "someone who does yoga", "Christmas", 75, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"],
    slots: ["yoga mat","yoga blocks and strap","meditation cushion","yoga mat bag","essential oil diffuser","yoga pants","yoga towel","singing bowl"], slotMust: [["mat"],["block"],["cushion","zafu"],["bag"],["diffuser"],["pant","legging"],["towel"],["singing bowl","bowl"]] }),
  P("gifts-for-artists", "Gifts for artists", "an artist who paints or draws", "Christmas", 75, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["colored pencil set","alcohol marker set","watercolor paint set","sketchbook","tabletop easel","art supply organizer","paint brush set","portable art case"], slotMust: [["pencil"],["marker"],["watercolor"],["sketchbook","sketch book"],["easel"],["organizer","storage"],["brush"],["case"]],
    notes: "a professional colored pencil or marker set, watercolor paints, a sketchbook, a tabletop easel, an art supply organizer, a quality brush set, a portable art case" }),
  P("gifts-for-nature-lovers", "Gifts for nature lovers", "someone who loves the outdoors and nature", "Christmas", 75, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["bird feeder","binoculars","bird field guide","nature journal","terrarium kit","telescope","wildflower seed kit","hummingbird feeder"], slotMust: [["feeder"],["binocular"],["guide"],["journal"],["terrarium"],["telescope"],["seed"],["hummingbird"]],
    notes: "a bird feeder or birdhouse, binoculars, a field guide, a nature journal, a plant terrarium, a star map or telescope, a wildflower seed kit" }),
  P("gifts-for-travelers", "Gifts for travelers", "someone who loves to travel", "Christmas", 100, { topic: "Hobbies", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["packing cubes set","scratch off world map","memory foam travel pillow","leather passport holder","hanging toiletry bag","weekender bag","travel journal","universal travel adapter"], slotMust: [["packing cube"],["scratch"],["pillow"],["passport"],["toiletry"],["weekender","duffel"],["journal"],["adapter"]],
    notes: "a carry-on packing cube set, a scratch-off world map, a travel pillow, a leather passport holder, a toiletry bag, a weekender bag, a travel journal" }),
  // anniversaries by year
  ...ANNIVERSARY_PAGES,
  ...TEAM_PAGES,
  ...THEME_PAGES,
  // family & interests
  P("christmas-gifts-for-boyfriend", "Christmas gifts for your boyfriend", "my boyfriend", "Christmas", 100, { topic: "Family & interests", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["leather wallet","men's watch","pullover hoodie","wireless earbuds","beard grooming kit","whiskey glasses set","personalized keychain","leather dopp kit"], slotMust: [["wallet"],["watch"],["hoodie","pullover","sweatshirt"],["earbud","headphone"],["groom","beard"],["glass"],["keychain","key chain"],["dopp","toiletry"]] }),
  P("christmas-gifts-for-girlfriend", "Christmas gifts for your girlfriend", "my girlfriend", "Christmas", 100, { topic: "Family & interests", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","dumb ass","sh*t","f*ck","bitch"],
    slots: ["initial necklace","silk robe","spa gift set","leather crossbody bag","luxury candle","cozy knit throw","silk scrunchie set","jewelry box"], slotMust: [["necklace"],["robe"],["spa"],["crossbody","handbag","purse"],["candle"],["throw","blanket"],["scrunchie"],["jewelry box","jewelry case","jewelry organizer"]] }),
  P("christmas-gifts-for-husband", "Christmas gifts for your husband", "my husband", "Christmas", 200, { topic: "Family & interests", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","bible","dog breed"],
    slots: ["men's automatic watch","leather wallet","leather weekender bag","noise cancelling headphones","grill tool set","quarter zip pullover","whiskey decanter","cordless drill"] }),
  P("christmas-gifts-for-wife", "Christmas gifts for your wife", "my wife", "Christmas", 200, { topic: "Family & interests", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","dumb ass","sh*t","f*ck","bitch"],
    slots: ["cashmere wrap","personalized necklace","leather handbag","luxury spa set","digital photo frame","silk pajama set","diamond stud earrings","luxury candle"], slotMust: [["cashmere","wrap"],["necklace"],["handbag","bag","tote"],["spa"],["frame"],["pajama"],["earring"],["candle"]] }),
  P("christmas-gifts-for-sister", "Christmas gifts for your sister", "my sister", "Christmas", 75, { topic: "Family & interests", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["personalized necklace","cozy throw blanket","candle set","spa gift set","tote bag","guided journal","sister keepsake","makeup bag"] }),
  P("christmas-gifts-for-brother", "Christmas gifts for your brother", "my brother", "Christmas", 75, { topic: "Family & interests", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","drinking","beer pong","shot glass"],
    slots: ["bluetooth speaker","leather wallet","pullover hoodie","strategy board game","whiskey stones set","multitool","beard grooming kit","insulated tumbler"], slotMust: [["speaker"],["wallet"],["hoodie","pullover","sweatshirt"],["game"],["whiskey","stones"],["multitool","multi-tool","multi tool"],["groom","beard"],["tumbler"]] }),
  P("gifts-for-new-grandparents", "Gifts for new grandparents", "new grandparents", "new grandchild", 75, { topic: "Life events", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["digital photo frame","grandma ornament","grandpa mug","baby photo album","grandparent journal","family tree frame","personalized grandparent sign","grandma necklace"] }),
  P("gifts-for-college-students", "Gifts for college students", "a college student", "Christmas", 50, { topic: "Life events", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","drinking","adult party","nsfw"],
    slots: ["mini fridge","noise cancelling earbuds","portable charger","weighted blanket","single serve coffee maker","laptop backpack","LED desk lamp","electric kettle"], slotMust: [["fridge","refrigerator"],["earbud"],["charger","power bank"],["blanket"],["coffee maker"],["backpack"],["lamp"],["kettle"]] }),
  // christmas, broad
  P("unique-christmas-gifts", "Unique Christmas gifts", "someone who would love something different", "Christmas", 100, { topic: "Holidays", count: 8, minCount: 6, slots: ["custom star map","cocktail smoker kit","levitating plant pot","custom pet portrait","scratch off world map","sunrise alarm clock","indoor smart garden","personalized recipe cutting board"], slotMust: [["star map","night sky"],["smoker"],["levitat"],["portrait"],["scratch"],["sunrise","wake"],["garden"],["cutting board"]], exclude: NICHE_NOVELTY,
    notes: "unusual but useful: a star map print, a cocktail smoker, a levitating plant pot, a custom pet portrait, a scratch-off map, a sunrise alarm clock, a smart garden" }),
  // curated lists
  P("most-unique-gifts", "The most unique gifts", "someone who has seen it all", "Christmas", 100, { topic: "Curated lists", count: 10, minCount: 7, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife","knives","saw:","horror","prank","wedding","rain barrel","cabinet","halloween"],
    notes: "genuinely unusual gifts people haven't seen before: conversation pieces, clever tech, personalized keepsakes; skip anything common",
    slots: ["personalized night sky star map","smart bird feeder with camera","levitating moon lamp","ferrofluid desk sculpture","custom pet portrait","3D crystal photo","indoor hydroponic garden","sunrise alarm clock","cocktail smoker kit","magnetic levitating plant pot"] }),
  P("most-unique-gifts-for-him", "The most unique gifts for him", "a man who has everything", "Christmas", 150, { topic: "Curated lists", count: 8, minCount: 6, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife","knives","saw:","horror","prank","wedding","rain barrel","cabinet","halloween"],
    notes: "unusual gifts for men he would never buy himself: conversation pieces and clever gear, nothing generic",
    slots: ["meteorite inlay ring","levitating bluetooth speaker","oak whiskey aging barrel kit","personalized golf ball stamp","ferrofluid speaker","smart bird feeder with camera","moon lamp","cocktail smoker kit"] }),
  P("most-unique-gifts-for-her", "The most unique gifts for her", "a woman who has everything", "Christmas", 150, { topic: "Curated lists", count: 8, minCount: 6, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife","knives","saw:","horror","prank","wedding","rain barrel","cabinet","halloween"],
    notes: "unusual, thoughtful gifts for women: personalized keepsakes, make-it-yourself kits, beautiful conversation pieces",
    slots: ["birth flower necklace","personalized night sky star map","pressed flower frame","perfume making kit","levitating plant pot","terrarium kit","sunrise alarm clock","handwritten recipe cutting board"] }),
  P("unique-gifts-under-25", "Unique gifts under $25", "anyone who loves something different", "Christmas", 25, { topic: "Curated lists", count: 8, minCount: 6, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife","knives","saw:","horror","prank","wedding","rain barrel","cabinet","halloween"],
    notes: "cheap but genuinely unusual: fidget-worthy desk toys, grow kits, clever little things people keep",
    slots: ["ferrofluid desk toy","magnetic thinking putty","plantable seed pencils","mini zen garden","bath bomb making kit","kinetic sand art frame","mushroom grow kit","galaxy projector"] }),
  P("coolest-gadgets-to-gift", "The coolest gadgets to give as gifts", "a gadget lover", "Christmas", 150, { topic: "Curated lists", count: 8, minCount: 6, exclude: ["gift card","sexy","nsfw","replacement","refill","bulk","knife","knives","saw:","horror","prank","wedding","rain barrel","cabinet","halloween"],
    notes: "clever, genuinely useful gadgets that feel new: finished consumer products, not parts or accessories",
    slots: ["smart bird feeder with camera","pocket translator device","mini thermal printer","levitating bluetooth speaker","ultrasonic jewelry cleaner","smart garden","digital photo frame with wifi","portable espresso maker"] }),
  P("personalized-christmas-gifts", "Personalized Christmas gifts", "someone special", "Christmas", 75, { topic: "Holidays", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","dumb ass","sh*t","f*ck","bitch"],
    slots: ["engraved necklace","monogrammed throw blanket","personalized cutting board","custom photo book","engraved whiskey decanter","name ornament","monogrammed notebook","custom star map"], slotMust: [["necklace"],["monogram","personalized","embroidered","custom"],["cutting board"],["photo book","photo album"],["decanter"],["ornament"],["notebook","journal"],["star map","night sky"]] }),
  P("christmas-gifts-for-people-who-are-hard-to-shop-for", "Christmas gifts for people who are hard to shop for", "someone who is hard to shop for", "Christmas", 100, { topic: "Holidays", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["heated throw blanket","luxury candle","smart mug","multitool","plush robe","digital photo frame","silk pillowcase","massage gun"], slotMust: [["heated"],["candle"],["mug"],["multitool","multi-tool","multi tool"],["robe"],["frame"],["pillowcase"],["massage"]] }),
  P("luxury-christmas-gifts-under-200", "Luxury Christmas gifts under $200", "someone who appreciates nice things", "Christmas", 200, { topic: "Holidays", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["cashmere scarf","leather wallet","designer candle","premium headphones","crystal whiskey glasses","silk pillowcase","leather card holder","cashmere throw"] }),
  P("christmas-gifts-for-kids-under-25", "Christmas gifts for kids under $25", "a child age 6 to 10", "Christmas", 25, { topic: "Holidays", cap: 2,
    notes: "toys and kits for ages 6-10: a building set, a science or craft kit, a family card or board game, an art set, an outdoor toy, a puzzle; age-appropriate only, nothing for adults" }),
  P("christmas-gifts-for-coworkers-under-15", "Christmas gifts for coworkers under $15", "a coworker", "Christmas", 15, { topic: "Work & office", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","drinking","adult party","nsfw","fart","smart ass","dumb ass","sh*t","f*ck","cards against","bitch","booze","wine o'clock","wine oclock"],
    slots: ["gel pen set","mini succulent","coffee mug","hand cream","mini candle","phone stand","desk fidget toy","sticky notes set"], slotMust: [["pen"],["succulent","plant"],["mug"],["hand cream","hand lotion"],["candle"],["stand","holder"],["fidget","desk toy","puzzle"],["sticky","notes","notepad"]] }),
  P("christmas-gifts-for-dad-who-has-everything", "Christmas gifts for a dad who has everything", "my dad, who has everything", "Christmas", 150, { topic: "Family & interests", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","drinking","adult party","plague","retirement","money scented","fart"],
    slots: ["massage gun","leather valet tray","wireless meat thermometer","heated vest","cocktail smoker kit","walnut end grain cutting board","noise cancelling earbuds","dad memory journal"] }),
  P("christmas-gifts-for-mom-who-wants-nothing", "Christmas gifts for a mom who says she wants nothing", "my mom", "Christmas", 150, { topic: "Family & interests", count: 8, minCount: 6,
    slots: ["heated throw blanket","silk pillowcase","massage gun","initial pendant necklace","digital photo frame","plush robe","luxury candle","five minute gratitude journal"], exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","bible","dog breed"] }),
  P("christmas-gifts-for-grandparents", "Christmas gifts for grandparents", "my grandparents", "Christmas", 100, { topic: "Family & interests", count: 8, minCount: 6,
    slots: ["digital photo frame","family tree sign","heated throw blanket","jigsaw puzzle","bird feeder","large print crossword book","grandparent memory journal","grandparents ornament"], exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","bible","dog breed"] }),
  P("gifts-for-coffee-lovers-under-50", "Gifts for coffee lovers under $50", "someone who loves coffee", "Christmas", 50, { topic: "Family & interests", count: 8, minCount: 6,
    slots: ["pour over coffee maker","milk frother","burr coffee grinder","coffee scale","french press","mug warmer","cold brew maker","coffee book"] }),
  P("gifts-for-whiskey-lovers", "Gifts for whiskey lovers", "someone who loves whiskey", "Christmas", 150, { topic: "Family & interests", count: 8, minCount: 6,
    slots: ["whiskey decanter set","whiskey stones","glencairn whiskey glasses","cocktail smoker kit","whiskey book","leather flask","ice ball mold","whiskey barrel sign"] }),
  P("gifts-for-football-fans", "Gifts for football fans", "a football fan", "Christmas", 150, { topic: "Family & interests", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre", "St. Louis Cardinals", "MLB", "Baseball", "Soccer"],
    slots: ["custom football jersey","football stadium blanket","portable tailgate grill","stadium seat cushion","football display case","football team tumbler","football team hoodie","tailgate cooler"] }),
  P("best-gifts-for-golfers", "Best gifts for golfers", "a golfer", "Christmas", 250, { topic: "Family & interests", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["golf rangefinder","golf GPS watch","premium golf balls","putting mat","golf travel bag","divot tool","golf glove","golf towel"], slotMust: [["rangefinder"],["watch"],["ball"],["putting"],["travel"],["divot"],["glove"],["towel"]],
    notes: "gifts golfers use: a golf rangefinder or GPS watch, premium golf balls, a putting green or putting mat, a golf travel bag, a personalized divot tool or ball marker, a quality golf glove, a launch monitor or swing analyzer, a golf towel and accessories set; no novelty joke items" }),
  P("gifts-for-golfers-under-50", "Gifts for golfers under $50", "a golfer", "Christmas", 50, { topic: "Family & interests", notes: "golf" }),
  P("christmas-gifts-for-him-under-50", "Christmas gifts for him under $50", "a man in my life", "Christmas", 50, { topic: "Family & interests", count: 8, minCount: 6, slots: ["leather bifold wallet","multitool","cocktail shaker set","beard grooming kit","quarter zip pullover","moccasin slippers","bluetooth speaker","insulated tumbler"], slotMust: [["wallet"],["multi-tool","multitool","multi tool"],["cocktail","shaker"],["groom","beard"],["pullover","sweater","quarter zip"],["slipper"],["speaker"],["tumbler"]], notes: "lasting gifts he will use: a quality wallet or accessory, a gadget, a grooming kit, a cozy pullover or slippers, barware, a tool or multitool, a fitness or outdoor item; no food and no religious items", exclude: NICHE_NOVELTY }),
  P("christmas-gifts-for-her-under-50", "Christmas gifts for her under $50", "a woman in my life", "Christmas", 50, { topic: "Family & interests", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank"],
    slots: ["pendant necklace","plush robe","spa gift set","luxury candle","crossbody bag","leather journal","silk scrunchie set","cozy throw blanket"] }),
  P("christmas-gifts-for-him-under-100", "Christmas gifts for him under $100", "a man in my life", "Christmas", 100, { topic: "Family & interests", count: 8, minCount: 6, slots: ["full grain leather wallet","multitool","whiskey decanter set","grooming kit","merino wool sweater","shearling slippers","wireless earbuds","smart meat thermometer"], slotMust: [["wallet"],["multi-tool","multitool","multi tool"],["decanter"],["groom"],["sweater","pullover"],["slipper"],["earbud"],["thermometer"]], notes: "lasting gifts he will use: a quality wallet or accessory, a gadget, a grooming kit, a cozy pullover or slippers, barware, a tool or multitool, a fitness or outdoor item; no food and no religious items", exclude: NICHE_NOVELTY }),
  P("christmas-gifts-for-her-under-100", "Christmas gifts for her under $100", "a woman in my life", "Christmas", 100, { topic: "Family & interests", count: 8, minCount: 6, exclude: [...NICHE_NOVELTY, "saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","chainsaw","massacre","bible","dog breed"],
    slots: ["gold pendant necklace","plush robe","skincare gift set","luxury candle","leather crossbody bag","silk pillowcase","heated throw blanket","jewelry box"] }),
  P("10-best-christmas-gifts-for-dad", "10 best Christmas gifts for dad", "my dad", "Christmas", 200, { topic: "Family & interests", count: 10,
    slots: ["wireless earbuds", "smart meat thermometer", "leather wallet", "cordless drill set", "whiskey glasses set", "massage gun", "quarter zip pullover", "fitness tracker watch", "portable bluetooth speaker", "leather weekender bag"],
    notes: "ten different kinds of gifts a dad will actually use" }),
  P("10-best-christmas-gifts-for-mom", "10 best Christmas gifts for mom", "my mom", "Christmas", 150, { topic: "Family & interests", count: 10,
    slots: ["cashmere scarf", "digital photo frame", "spa gift set", "jewelry box", "heated throw blanket", "luxury candle", "temperature control smart mug", "silk pillowcase", "personalized necklace", "cozy slippers"],
    notes: "ten different kinds of gifts a mom will love" }),
  P("secret-santa-gifts-under-15", "Secret Santa gifts under $15", "a coworker or friend", "Secret Santa", 15, { topic: "Holidays", count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","drinking","adult party","nsfw","fart","smart ass","dumb ass","sh*t","f*ck","cards against","bitch","booze","wine o'clock","wine oclock"],
    slots: ["desk toy","cozy socks","mini candle","party card game","hand cream","funny mug","lip balm set","keychain flashlight"], slotMust: [["desk toy","fidget","puzzle","balancing"],["sock"],["candle"],["game"],["hand cream","hand lotion"],["mug"],["lip balm"],["flashlight"]] }),
  P("stocking-stuffers-for-adults", "Stocking stuffers for adults", "an adult", "Christmas stocking", 30, { count: 8, minCount: 6, exclude: ["saw:","billy the puppet","horror","skull","jekyll","electric shock","shock flashlight","prank","fart","smart ass","replacement","refill","bulk"], slots: ["leather pocket notebook","fountain pen","whiskey stones","coffee scoop","cozy socks","lip balm set","keychain multitool","mini bluetooth speaker"], slotMust: [["notebook","journal"],["pen"],["stones"],["scoop"],["sock"],["lip balm"],["multitool","multi-tool","multi tool"],["speaker"]], topic: "Family & interests" }),
  // Kids by age: one search per category so each page has variety; nothing adult.
  P("christmas-gifts-for-toddlers", "Christmas gifts for toddlers", "a toddler age 1 to 3", "Christmas", 50, { topic: "Kids", count: 7, minCount: 5, exclude: KIDS_EXCLUDE,
    slots: ["toddler push walker toy", "toddler ride-on toy", "chunky wooden puzzle for toddlers", "toddler stacking blocks", "board books for toddlers", "toddler musical instrument set", "toddler play kitchen accessories"],
    notes: "safe, age-appropriate toys for ages 1-3; no small parts" }),
  P("christmas-gifts-for-kids-5-to-7", "Christmas gifts for kids ages 5 to 7", "a child age 5 to 7", "Christmas", 50, { topic: "Kids", count: 7, minCount: 5, exclude: KIDS_EXCLUDE,
    slots: ["magnetic building tiles", "kids science kit ages 5-7", "kids art supply set", "family board game for young kids", "kids scooter", "dress up costume set for kids", "early reader book set"],
    notes: "age-appropriate gifts for ages 5-7" }),
  P("christmas-gifts-for-kids-8-to-10", "Christmas gifts for kids ages 8 to 10", "a child age 8 to 10", "Christmas", 75, { topic: "Kids", count: 7, minCount: 5, exclude: KIDS_EXCLUDE,
    slots: ["LEGO building set ages 8+", "coding robot for kids", "kids crystal growing science kit", "kids walkie talkies", "strategy board game for kids", "kids digital camera", "kids telescope"],
    notes: "age-appropriate gifts for ages 8-10" }),
  P("christmas-gifts-for-tweens", "Christmas gifts for tweens", "a tween age 10 to 12", "Christmas", 75, { topic: "Kids", count: 7, minCount: 5, exclude: KIDS_EXCLUDE,
    slots: ["instant camera for kids", "kids wireless headphones", "friendship bracelet making kit", "Rubik's cube speed cube", "LED room lights for kids", "graphic novel box set", "kids smartwatch"],
    notes: "gifts for ages 10-12 that don't feel babyish" }),
  P("christmas-gifts-for-teen-boys", "Christmas gifts for teen boys", "a teenage boy", "Christmas", 100, { topic: "Kids", count: 7, minCount: 5, exclude: KIDS_EXCLUDE,
    slots: ["wireless earbuds", "portable Bluetooth speaker", "gaming headset", "hoodie for teen boys", "basketball", "LED strip lights", "portable phone charger power bank"],
    notes: "gifts teen boys actually use" }),
  P("christmas-gifts-for-teen-girls", "Christmas gifts for teen girls", "a teenage girl", "Christmas", 100, { topic: "Kids", count: 7, minCount: 5, exclude: KIDS_EXCLUDE,
    slots: ["instant camera", "wireless earbuds", "cozy sherpa blanket", "makeup bag organizer", "hair styling tool set", "insulated tumbler", "jewelry box"],
    notes: "gifts teen girls actually use; no adult skincare claims" }),
  P("stocking-stuffers-for-kids", "Stocking stuffers for kids", "a child age 5 to 10", "Christmas stocking", 15, { topic: "Kids", count: 7, minCount: 5, exclude: KIDS_EXCLUDE,
    slots: ["kids sticker book", "fidget toy set", "mini LEGO set", "kids card game", "glow in the dark toys", "kids flashlight", "travel puzzle game"],
    notes: "small stocking-size items for ages 5-10; no candy" }),
  P("stocking-stuffers-for-teens", "Stocking stuffers for teens", "a teenager", "Christmas stocking", 25, { topic: "Kids", count: 7, minCount: 5, exclude: KIDS_EXCLUDE,
    slots: ["phone grip stand", "lip balm set", "fun socks", "portable charger keychain", "mini Bluetooth speaker", "card game for teens", "scrunchie or hair clip set"],
    notes: "small stocking-size items teens use" }),
  P("gamer-stocking-stuffers", "Stocking stuffers for gamers", "a gamer", "Christmas stocking", 25, { topic: "Gaming", count: 7, minCount: 5, exclude: GAMING_EXCLUDE,
    slots: ["controller thumb grips", "gaming mug", "controller charging cable", "gaming keycaps", "pixel art keychain", "controller skin decal", "gaming socks"],
    notes: "small stocking-size gaming items" }),
  P("stocking-stuffers-for-men", "Stocking stuffers for men", "a man", "Christmas stocking", 30, { topic: "Family & interests", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["multitool", "beard care kit", "wool socks", "tracker tag for keys", "pocket flashlight", "hot sauce gift set", "slim wallet"],
    notes: "useful stocking-size items for men" }),
  P("stocking-stuffers-for-women", "Stocking stuffers for women", "a woman", "Christmas stocking", 30, { topic: "Family & interests", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["hand cream gift set", "silk scrunchies", "cozy socks", "scented candle", "lip balm set", "mini perfume", "phone wristlet"],
    notes: "small treats for women" }),
  P("hanukkah-gifts-for-kids", "Hanukkah gifts for kids", "a child who celebrates Hanukkah", "Hanukkah", 40, { topic: "Holidays", count: 6, minCount: 5, exclude: KIDS_EXCLUDE,
    slots: ["kids dreidel set", "Hanukkah children's book", "kids menorah", "Hanukkah plush toy", "kids craft kit", "family board game"],
    notes: "age-appropriate Hanukkah and everyday gifts for kids" }),
  P("eight-nights-of-hanukkah-gifts", "8 nights of Hanukkah gift ideas", "family members who celebrate Hanukkah", "Hanukkah", 50, { topic: "Holidays", count: 8, minCount: 6,
    slots: ["dreidel set", "Hanukkah book", "cozy socks", "family board game", "scented candle", "puzzle", "art supply set", "menorah"],
    notes: "one gift idea for each of the eight nights; mix of small and bigger gifts" }),
  // Hobbies and sports, one search per category.
  P("gifts-for-car-guys", "Gifts for car guys", "someone who loves cars", "Christmas", 100, { topic: "Hobbies", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["car detailing kit", "cordless car vacuum", "portable tire inflator", "car jump starter", "LED work light for garage", "mechanic creeper", "car racing coffee table book"],
    notes: "useful gifts for someone who works on or cares for their car" }),
  P("gifts-for-woodworkers", "Gifts for woodworkers", "a woodworker", "Christmas", 100, { topic: "Hobbies", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["woodworking chisel set", "woodworking clamps set", "japanese pull saw", "digital angle finder", "woodworking marking gauge", "shop apron leather", "wood burning kit"],
    notes: "tools and shop gear for woodworkers" }),
  P("gifts-for-bbq-lovers", "Gifts for BBQ lovers", "someone who loves to grill and barbecue", "Christmas", 100, { topic: "Hobbies", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["wireless meat thermometer", "grill tool set", "BBQ rub gift set", "heat resistant grill gloves", "cast iron grill press", "smoker wood chips sampler", "grill basket"],
    notes: "grilling and smoking gear" }),
  P("gifts-for-cyclists", "Gifts for cyclists", "a cyclist", "Christmas", 100, { topic: "Hobbies", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["bike light set", "bike multi tool", "cycling gloves", "portable bike pump", "bike phone mount", "cycling water bottle", "bike saddle bag"],
    notes: "practical gear for road or mountain cyclists" }),
  P("gifts-for-skiers", "Gifts for skiers and snowboarders", "a skier or snowboarder", "Christmas", 100, { topic: "Hobbies", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["ski goggles", "heated gloves", "merino wool ski socks", "neck gaiter for skiing", "ski boot bag", "hand warmers rechargeable", "helmet audio speakers"],
    notes: "gear for the slopes" }),
  P("gifts-for-pickleball-players", "Gifts for pickleball players", "someone who plays pickleball", "Christmas", 100, { topic: "Hobbies", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["pickleball paddle", "pickleball balls", "pickleball bag", "pickleball paddle cover", "sports water bottle", "pickleball court shoes", "overgrip tape"],
    notes: "pickleball gear and accessories" }),
  P("gifts-for-baseball-fans", "Gifts for baseball fans", "a baseball fan", "Christmas", 75, { topic: "Hobbies", count: 6, minCount: 5, exclude: [...NICHE_NOVELTY, "football", "hockey", "basketball", "soccer", "yankees", "red sox", "dodgers", "mets", "cubs", "cardinals", "braves", "astros", "canadiens", "bruins", "maple leafs", "blackhawks", "penguins", "red wings", "tigers", "logo display case"],
    slots: ["clear acrylic baseball display cube", "vintage baseball patent print", "baseball bat wall rack", "baseball history book", "vintage baseball cap", "baseball glove care kit"],
    notes: "gifts for baseball fans; team-neutral unless a team is named" }),
  P("gifts-for-hockey-fans", "Gifts for hockey fans", "a hockey fan", "Christmas", 75, { topic: "Hobbies", count: 6, minCount: 5, exclude: [...NICHE_NOVELTY, "football", "baseball", "basketball", "soccer", "yankees", "red sox", "dodgers", "mets", "cubs", "cardinals", "braves", "astros", "canadiens", "bruins", "maple leafs", "blackhawks", "penguins", "red wings"],
    slots: ["clear acrylic hockey puck display case", "vintage hockey patent print", "hockey stick", "hockey history book", "hockey beanie", "table hockey game"],
    notes: "gifts for hockey fans and players" }),
  P("gifts-for-soccer-players", "Gifts for soccer players", "someone who plays soccer", "Christmas", 75, { topic: "Hobbies", count: 6, minCount: 5, exclude: [...NICHE_NOVELTY, "football helmet", "baseball", "hockey", "basketball"],
    slots: ["soccer ball", "soccer rebounder net", "shin guards", "soccer backpack", "soccer training cones set", "grip socks for soccer"],
    notes: "soccer gear for players" }),
  P("gifts-for-basketball-fans", "Gifts for basketball fans", "a basketball fan", "Christmas", 100, { topic: "Hobbies", count: 6, minCount: 5, exclude: [...NICHE_NOVELTY, "football", "baseball", "hockey", "soccer", "golf"],
    slots: ["over the door basketball hoop", "official size indoor outdoor basketball", "basketball display case", "basketball history book", "basketball arcade game", "basketball court wall art"],
    notes: "gifts for basketball fans and players; team-neutral (the team pages below cover each NBA and WNBA team)" }),
  P("gifts-for-soccer-fans", "Gifts for soccer fans", "a soccer (football) fan", "Christmas", 100, { topic: "Hobbies", count: 6, minCount: 5, exclude: [...NICHE_NOVELTY, "nfl", "football helmet", "baseball", "hockey", "basketball", "rugby", "ncaa", "mountaineers", "college", "bruins", "nhl"],
    slots: ["World Cup 2026 official match ball", "soccer history book", "tabletop foosball game", "soccer ball display case", "soccer stadium poster print", "soccer fan scarf"],
    notes: "gifts for soccer fans who follow clubs and national teams; team-neutral (the team pages below cover each club and national team)" }),
  P("gifts-for-houseplant-lovers", "Gifts for houseplant lovers", "someone who loves houseplants", "Christmas", 60, { topic: "Hobbies", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["self watering planter", "plant grow light", "plant mister", "propagation station", "indoor plant shelf", "soil moisture meter", "houseplant care book"],
    notes: "gear for indoor plant people" }),
  P("gifts-for-horse-lovers", "Gifts for horse lovers", "someone who loves horses", "Christmas", 75, { topic: "Hobbies", count: 6, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["horse grooming kit", "horse themed jewelry", "horse print throw blanket", "equestrian riding gloves", "horse photography book", "horse figurine"],
    notes: "gifts for riders and horse fans" }),
  P("gifts-for-bird-watchers", "Gifts for bird watchers", "a bird watcher", "Christmas", 100, { topic: "Hobbies", count: 6, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["birding binoculars", "smart bird feeder with camera", "bird field guide book", "window bird feeder", "heated bird bath", "bird house"],
    notes: "gifts for backyard and field birders" }),
  // Life events and jobs.
  P("gifts-for-expecting-moms", "Gifts for expecting moms", "a pregnant woman", "Christmas", 75, { topic: "Life events", count: 6, minCount: 5, exclude: [...NICHE_NOVELTY, "wine", "alcohol"],
    slots: ["pregnancy pillow", "maternity robe", "belly butter", "pregnancy journal", "cozy slippers", "insulated water bottle"],
    notes: "comfort gifts for a mom-to-be; no medical claims" }),
  P("gifts-for-truck-drivers", "Gifts for truck drivers", "a truck driver", "Christmas", 100, { topic: "Professions", count: 7, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["heated seat cushion for car", "12V portable cooler", "dash cam", "travel coffee mug", "seat back organizer", "neck pillow for travel", "bluetooth trucker headset"],
    notes: "comforts for long hauls" }),
  P("gifts-for-hairstylists", "Gifts for hairstylists", "a hairstylist", "Christmas", 75, { topic: "Professions", count: 6, minCount: 5, exclude: NICHE_NOVELTY,
    slots: ["professional hair shears", "anti fatigue mat", "salon tool belt", "hair clip set", "compression socks", "salon apron"],
    notes: "practical gifts for stylists on their feet all day" }),
];
// Guides whose people now have their own store link there (set after the list so each entry stays as written).
const STORE_OF = {
  teachers: ["gifts-for-teachers-under-25", "group-gifts-for-teachers-from-class", "teacher-retirement-gifts", "secret-santa-gifts-for-teachers", "gifts-for-principals"],
  doctors: ["christmas-gifts-for-doctors", "doctor-retirement-gifts", "medical-school-graduation-gifts", "secret-santa-gifts-for-doctors"],
  realtors: ["gifts-for-realtors"],
  police: ["gifts-for-police-officers", "police-retirement-gifts", "police-academy-graduation-gifts", "secret-santa-gifts-for-police-officers"],
  "firefighter-gifts": ["gifts-for-firefighters", "fire-academy-graduation-gifts", "secret-santa-gifts-for-firefighters", "firefighter-retirement-gifts"],
};
for (const [st, slugs] of Object.entries(STORE_OF)) for (const sl of slugs) { const p = PAGES.find(x => x.slug === sl); if (p) p.store = st; }
// Picks the Nov 2026 audit found on pages where they don't belong; each page's next rebuild drops them.
const AUDIT_EXCLUDE = {
  "nurse-appreciation-gifts": ["lisle"], "nursing-school-graduation-gifts": ["velveteen pouch", "lisle", "necklace", "headset", "charm", "sweatshirt", "minnie"], "gifts-for-nursing-students": ["lisle"],
  "what-to-get-a-computer-geek": ["inspection camera"], "police-academy-graduation-gifts": ["corporate traveller", "charm"],
  "teacher-retirement-gifts": ["banner", "photo prop", "napkin"], "firefighter-retirement-gifts": ["banner", "charm", "napkin", "photo prop"], "police-retirement-gifts": ["banner", "charm", "napkin", "photo prop", "ice cream", "scoopery"], "military-retirement-gifts": ["banner", "napkin", "photo prop"],
  "fire-academy-graduation-gifts": ["charm", "playset", "pretend", "toy"], "secret-santa-gifts-for-police-officers": ["charm"], "secret-santa-gifts-for-nurses": ["charm"],
  "secret-santa-gifts-under-25": ["prescription"], "gifts-for-your-boss-under-50": ["hydrangea"],
};
for (const p of PAGES) {
  const extra = [...(AUDIT_EXCLUDE[p.slug] || []), ...(p.team ? ["panini", "infant", "toddler", "newborn"] : [])];
  if (extra.length) p.exclude = [...(p.exclude || []), ...extra];
}
export const pageBySlug = slug => PAGES.find(p => p.slug === slug) || null;

// No page should be seven candles: at most `cap` products of one kind, in the order they came.
const KINDS = /\b(candles?|mugs?|bowls?|pens?|blankets?|throws?|journals?|notebooks?|clocks?|tumblers?|portfolios?|padfolios?|boards?|glass(?:es)?|decanters?|socks|necklaces?|bracelets?|wall art|prints?|baskets?|tote|bags?|wallets?|frames?|plants?|games?|ornaments?|flasks?|flashlights?|coins?|dryers?|power banks?|power paks?|headlamps?|keyboards?|ssds?|sunglasses|bottles?|towels?|shears|light bars?|massagers?|massage|sunscreens?|suncare|watch(?:es)?|smartwatch(?:es)?|headphones?|earbuds?|hub|speakers?|projectors?|e-readers?|drones?|consoles?|cameras?|vacuums?|putting|divot|sensors?|golf balls?|jerseys?|grills?|display cases?|ereaders?|watch\d+|gloves?|binoculars?|hammocks?|sleeping pads?|stoves?|lanterns?|cups?|thermometers?|liners?|pillows?|pillowcases?|lamps?|scarf|scarves|slippers?|bookmarks?|hand creams?|trail cameras?|pruners?|kneelers?|planters?|aerators?|openers?|record players?|turntables?|kits?|multi-?tools?|robes?|cocktail sets?|shakers?|handbags?|crossbody|smokers?|smoking kits?|portraits?|gardens?|growbars?|flowerpots?|flower pots?|barware|wraps?|charging docks?|charging stations?|charger|light strips?|lighting kits?|light bars?|mouse pads?|desk mats?|mouse|mice|controllers?|headsets?|microphones?|mics?|webcams?|cushions?)\b/i;
// Words that name the same kind of gift.
const SAME_KIND = { throw: "blanket", shaker: "cocktail set", turntable: "record player", ereader: "ereader", smartwatch: "watch",
  handbag: "bag", crossbody: "bag", "smoking kit": "smoker", growbar: "garden", flowerpot: "garden", "flower pot": "garden", wrap: "scarf",
  "charging station": "charging dock", charger: "charging dock", "lighting kit": "light strip", "light bar": "light strip", "mouse pad": "desk mat", mice: "mouse", mic: "microphone" };
const KINDS_ALL = new RegExp(KINDS.source, "gi");
// "Candles" and "Candle" are one kind ("es" only goes for glasses-type words).
const singular = w => /(ss|x|ch|sh)es$/.test(w) ? w.slice(0, -2) : /[^s]s$/.test(w) ? w.slice(0, -1) : w;
export function diversify(cards, cap = 3) {
  const n = {};
  // Known kinds first; otherwise the title's last word ("Rugged Power Bank" -> bank), so four power banks can't fill a page either.
  // The last kind word in a title is the product ("Mini Glass Candle" is a candle, "Tapestry Throw Blanket" a blanket).
  // "Kit" only counts when nothing more specific is named ("Foldable Multi-Tool Kit" is a multi-tool).
  const kindOf = t => { const all = [...t.matchAll(KINDS_ALL)], strong = all.filter(x => !/^kits?$/i.test(x[1])), m = (strong.length ? strong : all).pop(); if (m) { const k = singular(m[1].toLowerCase().replace(/-/g, "").replace(/\d+$/, "")); return SAME_KIND[k] || k; } const w = (t.toLowerCase().match(/[a-z]{3,}/g) || []).pop(); return w ? singular(w) : null; };
  return cards.filter(c => { const k = kindOf(c.title || ""); if (!k) return true; n[k] = (n[k] || 0) + 1; return n[k] <= cap; });
}
// Per-page safety net: drop products whose title contains a phrase the page must not show
// (e.g. a Marine Corps coin on the police page). Case-insensitive substring match.
// `slot`: on slot pages, an open slot (`openSlots`) skips `require` (general soccer-fan gifts on a club page).
export function allowed(p, c, slot) {
  const t = String((c && c.title) || "").toLowerCase();
  if ((p.exclude || []).some(w => t.includes(String(w).toLowerCase()))) return false;
  if (slot !== undefined && p.openSlots && p.openSlots.includes(slot)) return true;
  return !p.require || p.require.some(w => t.includes(String(w).toLowerCase()));
}

// The guide text: written once per page by the model, checked, stored.
export const GUIDE_SYSTEM =
  "You write short, genuinely useful gift-guide copy for a page targeting one search phrase. Be specific and " +
  "practical, warm but not gushing. Never invent statistics, prices, brands or claims about specific products. " +
  "Answer only JSON: {\"meta\":\"meta description, 140-155 characters, includes the phrase\",\"intro\":[\"2 or 3 short paragraphs\"]," +
  "\"faq\":[{\"q\":\"a question people ask about this\",\"a\":\"2-3 sentence answer\"}] (4 items)}";
export function guidePrompt(p) {
  return `Search phrase: ${p.keyword}\nWho it's for: ${p.recipient}\nOccasion: ${p.occasion}\nTypical budget: up to $${p.budget_cents / 100}` +
    (p.notes ? `\nNotes: ${p.notes}` : "") +
    (p.anniversary ? "\nCover both the traditional and the modern gift, with a few creative ways to interpret each. Never suggest real ivory, coral or other wildlife products."
                   : /birthday/i.test(p.occasion) ? "\nIt's a birthday gift (any time of year, not just the holidays). Mention that several people can chip in on one gift if that fits."
                   : p.occasion === "Valentine's Day" ? "\nIt's for Valentine's Day (February 14). Keep it warm and romantic but tasteful, and note it's worth ordering early."
                   : "\nIt's the holiday season. Mention that several people can chip in on one gift if that fits.");
}
export function parseGuide(j, p) {
  const clip = (s, n) => String(s ?? "").trim().slice(0, n);
  const intro = (Array.isArray(j && j.intro) ? j.intro : []).map(x => clip(x, 700)).filter(x => x.length > 40).slice(0, 3);
  const faq = (Array.isArray(j && j.faq) ? j.faq : []).map(f => ({ q: clip(f && f.q, 160), a: clip(f && f.a, 500) })).filter(f => f.q && f.a).slice(0, 5);
  let meta = clip(j && j.meta, 160);
  if (meta.length < 80) meta = `${p.keyword}: real, in-stock gift ideas picked by AI, with live prices from top retailers. Chip in together with PayPal.`.slice(0, 158);
  if (!intro.length) return null;
  return { meta, intro, faq };
}
// What the finder is asked for this page.
export const pageBrief = p => ({ recipient: p.recipient, occasion: p.occasion, relationship: "", notes: p.notes || "", budget_cents: p.budget_cents });

// ---------- HTML ----------
const ROOT = "https://gift.directory";
// Cards that carry a `group` label (anniversary themes) are shown under one heading per group, in first-seen order.
export function groupCards(cards) {
  const out = new Map(); for (const c of cards) { const k = c.group || "More ideas"; if (!out.has(k)) out.set(k, []); out.get(k).push(c); }
  return [...out.entries()];
}
// One pick as schema.org Product with its live offer. Only what the card really has: no ratings or reviews are
// claimed (the catalog doesn't give us any, and Google penalizes made-up ones).
export function productLd(c) {
  const price = Number(c.price_cents) > 0 ? (c.price_cents / 100).toFixed(2) : null;
  return { "@type": "Product", name: c.title, ...(c.image ? { image: c.image } : {}), ...(c.brand ? { brand: { "@type": "Brand", name: c.brand } } : {}),
    ...(c.reason ? { description: c.reason } : {}),
    ...(price ? { offers: { "@type": "Offer", url: c.url, price, priceCurrency: "USD", availability: "https://schema.org/InStock",
      ...(c.merchant ? { seller: { "@type": "Organization", name: c.merchant } } : {}) } } : { url: c.url }) };
}
function card(c) {
  return `<article class="card gift">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy" width="300" height="300">` : ""}
<h3>${esc(c.title)}</h3><div class="muted" style="font-size:.82rem">${esc(c.brand || "")}${c.brand ? " · " : ""}${esc(c.merchant)}</div>
<div class="price">${money(c.price_cents)}${c.was_cents && c.was_cents > c.price_cents ? `<span class="was">${money(c.was_cents)}</span>` : ""}</div>
${c.reason ? `<p class="why">${esc(c.reason)}</p>` : `<p class="why"></p>`}
<div class="acts"><a class="btn sec" href="${esc(c.url)}" target="_blank" rel="noopener sponsored nofollow">View at ${esc(c.merchant)}</a></div></article>`;
}
// The one ad slot: bottom of the page, after everything a reader came for. Never in the header, and the
// ad script itself loads down here too. Empty until real AdSense ids are configured.
// The AdSense publisher id, set once per request by the worker (ownership tag only; no ad code in <head>).
let ADS_CLIENT = "";
export function configureAds(env) { ADS_CLIENT = /^ca-pub-\d{10,20}$/.test((env && env.ADSENSE_CLIENT) || "") ? env.ADSENSE_CLIENT : ""; }
export function adSlot(env) {
  const client = env && env.ADSENSE_CLIENT, slot = env && env.ADSENSE_SLOT;
  if (!/^ca-pub-\d{10,20}$/.test(client || "") || !/^\d{6,15}$/.test(slot || "")) return "";
  return `<aside aria-label="Advertisement" style="margin:30px 0 6px"><div class="muted" style="font-size:.72rem;letter-spacing:.4px;text-transform:uppercase">Advertisement</div>
<ins class="adsbygoogle" style="display:block" data-ad-client="${client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script></aside>`;
}
// `image`: the link-preview picture (a guide's first product; the gift.directory card otherwise).
export const shell = (title, meta, canonical, body, jsonld = [], ad = "", image = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${ADS_CLIENT ? `<meta name="google-adsense-account" content="${ADS_CLIENT}">` : ""}<title>${esc(title)}</title>
<meta name="description" content="${esc(meta)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(meta)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="gift.directory">
<meta property="og:image" content="${esc(/^https?:\/\//.test(image) ? image : "https://gift.directory/og.png")}"><meta name="twitter:card" content="${/^https?:\/\//.test(image) ? "summary" : "summary_large_image"}">
<link rel="stylesheet" href="/style.css"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("")}
<style>.wrap{max-width:1180px}.grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}.guide p{max-width:760px}.crumbs{font-size:.85rem;margin-bottom:6px}
.gift .why{font-style:italic;color:#374151}.cta{background:var(--accent);color:#fff;border-radius:14px;padding:18px;margin:22px 0}.cta a{color:#fff;font-weight:700}
.rel{display:flex;flex-wrap:wrap;gap:8px}.rel a{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:.88rem;text-decoration:none;color:var(--ink)}</style>
</head><body><div class="wrap"><main id="main">${body}</main>
${ad}
<footer><a href="/">gift.directory</a> · <a href="/gifts">All gift guides</a> · <a href="/registry">Gift registry</a> · <a href="https://gift.directory/about">About</a> · <a href="https://gift.directory/contact">Contact</a> · <a href="https://gift.directory/privacy">Privacy</a> · <a href="https://gift.directory/terms">Terms</a><br>Prices and stock come live from retailers through Channel3 and may change; links go to the retailer. We may earn a commission when you buy through these links.</footer></div></body></html>`;

// House ad for our affiliate site Storm Proof AI (stormproof.us), on the preparedness guides only. It sits in the
// page body after the picks (never in the <head>), and its wording follows what stormproof.us itself says.
const HOUSE_ADS = {
  Registries: slug => `<aside style="border:2px solid #1f3a5f;background:#f4f7fb;color:#1f2937;border-radius:14px;padding:18px;margin:22px 0">
<b style="font-size:1.2rem;font-family:Georgia,serif">Make one registry from every store</b>
<p style="margin:6px 0 10px">Add any of these, or anything from hundreds of other stores, Etsy shops or any product link. Tell the AI what you want in one sentence. Guests mark what they bought so nothing is doubled, and big gifts can be split by a group with PayPal. Free, no account needed.</p>
<a href="/registry?utm_source=guide&amp;utm_campaign=${encodeURIComponent(slug)}" style="display:inline-block;background:#1f3a5f;color:#fff;border-radius:10px;padding:10px 16px;font-weight:700;text-decoration:none">Start a free registry →</a>
</aside>`,
  Preparedness: slug => `<aside style="border:2px solid #1f3a5f;background:#f4f7fb;color:#1f2937;border-radius:14px;padding:18px;margin:22px 0">
<div style="font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:#1f3a5f;font-weight:700">From our affiliate site</div>
<b style="font-size:1.2rem;font-family:Georgia,serif">Storm Proof AI: no signal, still answers</b>
<p style="margin:6px 0 10px">When a storm takes out the power and the cell towers, phones go dark right when you need answers. Storm Proof AI is an offline AI and library on one drive: first aid, repair guides, maps with turn-by-turn directions, and a voice assistant, with no internet, account or subscription needed.</p>
<a class="btn" href="https://stormproof.us/?utm_source=gift.directory&amp;utm_medium=house_ad&amp;utm_campaign=${encodeURIComponent(slug)}" rel="noopener" style="display:inline-block;background:#1f3a5f;color:#fff;border-radius:10px;padding:10px 16px;font-weight:700;text-decoration:none">Download it free or get a loaded drive →</a>
</aside>`,
};
// Outdoors pages where a storm or no-signal kit fits the reader (campers, hikers, boaters…) also get the Storm Proof ad.
const STORM_TOO = new Set(["gifts-for-campers", "gifts-for-hikers", "gifts-for-outdoorsmen", "gifts-for-boaters", "gifts-for-kayakers"]);
export const houseAd = (topic, slug) => HOUSE_ADS[topic] ? HOUSE_ADS[topic](slug) : STORM_TOO.has(slug) ? HOUSE_ADS.Preparedness(slug) : "";
export function renderGuide(p, row, related, storeUrl, ad = "", teams = "") {
  const g = JSON.parse(row.guide_json), cards = JSON.parse(row.cards_json || "[]");
  const url = `${ROOT}/gifts/${p.slug}`, updated = String(row.updated_at).slice(0, 10);
  const title = `${p.keyword} (${new Date(row.updated_at).getUTCFullYear()}) — real gifts in stock | gift.directory`;
  const body = `<div class="crumbs"><a href="/">gift.directory</a> › <a href="/gifts">Gift guides</a> › <a href="/gifts/topic/${topicSlug(p.topic)}">${esc(p.topic)}</a></div>
<h1 style="font-family:Georgia,serif;margin:4px 0 6px">${esc(p.keyword)}</h1>
<p class="muted" style="margin:0 0 12px">Updated ${esc(updated)} · ${cards.length} gifts in stock now</p>
<section class="guide">${g.intro.map(x => `<p>${esc(x)}</p>`).join("")}</section>
${expertNote(p.slug)}
${related.length >= 3 ? `<p class="muted see">See also: ${related.slice(0, 3).map(r => `<a href="/gifts/${r.slug}">${esc(r.keyword.charAt(0).toLowerCase() + r.keyword.slice(1))}</a>`).join(", ").replace(/, ([^,]*)$/, " and $1")}.</p>` : ""}
${p.anniversary ? `<p class="muted" style="font-size:1.02rem"><b>Traditional gift:</b> ${esc(p.anniversary.traditional.replace(/\s*\(ivory-colored, never real ivory\)/, " (ivory-colored)"))} · <b>Modern gift:</b> ${esc(p.anniversary.modern)}</p>` : ""}
${cards.length ? (cards.some(c => c.group)
  ? groupCards(cards).map(([label, cs]) => `<h2 style="font-family:Georgia,serif">${esc(label)}</h2><div class="grid">${cs.map(card).join("")}</div>`).join("")
  : `<h2 style="font-family:Georgia,serif">Our picks</h2><div class="grid">${cards.map(card).join("")}</div>`) : ""}
<div class="cta"><b style="font-size:1.1rem">Going in together?</b><br>${storeUrl
    ? `Find more and start a group gift at <a href="${esc(storeUrl)}">${esc(storeUrl.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a> — everyone chips in with PayPal, straight to the organizer.`
    : `Every store on <a href="/">gift.directory</a> lets a group chip in with PayPal, straight to the organizer. <a href="/">Start your own gift store →</a>`}</div>
${houseAd(p.topic, p.slug)}
${teams}
${g.faq.length ? `<h2 style="font-family:Georgia,serif">Questions people ask</h2>${g.faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}` : ""}
<h2 style="font-family:Georgia,serif">More gift guides</h2><nav class="rel" aria-label="Gift guides">${(related.length > 6 ? related.slice(3) : related).map(r => `<a href="/gifts/${r.slug}">${esc(r.keyword)}</a>`).join("")}<a href="/gifts/topic/${topicSlug(p.topic)}">All ${esc(p.topic)} guides →</a></nav>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "ItemList", name: p.keyword, url, numberOfItems: cards.length, itemListElement: cards.map((c, i) => ({ "@type": "ListItem", position: i + 1, item: productLd(c) })) },
    ...(g.faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Gift guides", item: `${ROOT}/gifts` }, { "@type": "ListItem", position: 2, name: p.keyword, item: url }] },
  ];
  return shell(title, g.meta, url, body, ld, ad, (cards.find(c => c.image) || {}).image);
}
// A guide needs at least this many picks to be listed (hub, topics, related links, sitemap) and indexed.
// A thinner one still opens for anyone who has the link, but tells search engines not to index it.
export const MIN_LISTED = 6;
export const noindexed = html => html.replace('<link rel="canonical"', '<meta name="robots" content="noindex,follow"><link rel="canonical"');
// Topic pages (/gifts/topic/<slug>): the hub shows a preview of each topic and links to the full list.
export const topicSlug = t => String(t).toLowerCase().replace(/&/g, "and").replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const topicBySlug = s => [...new Set(PAGES.map(p => p.topic))].find(t => topicSlug(t) === s) || null;
const byTopicBuilt = built => { const m = {}; for (const p of PAGES) if (built.has(p.slug)) (m[p.topic] ||= []).push(p); return m; };
const HUB_PREVIEW = 12;
export function renderHub(built, ad = "") {
  const byTopic = byTopicBuilt(built);
  const body = `<h1 style="font-family:Georgia,serif">Gift guides</h1><p class="muted">Real, in-stock gifts picked by AI for the people on your list — with live prices, and group gifts paid through PayPal.</p>
<p><a href="/christmas-shipping-deadlines">Christmas shipping deadlines 2026: when to order →</a></p>
<nav class="rel" aria-label="Topics" style="margin:6px 0 10px">${Object.entries(byTopic).map(([t, ps]) => `<a href="/gifts/topic/${topicSlug(t)}">${esc(t)} (${ps.length})</a>`).join("")}</nav>
${Object.entries(byTopic).map(([t, ps]) => `<h2 style="font-family:Georgia,serif"><a href="/gifts/topic/${topicSlug(t)}" style="color:inherit">${esc(t)}</a></h2><nav class="rel" aria-label="${esc(t)} guides">${ps.slice(0, HUB_PREVIEW).map(p => `<a href="/gifts/${p.slug}">${esc(p.keyword)}</a>`).join("")}${ps.length > HUB_PREVIEW ? `<a href="/gifts/topic/${topicSlug(t)}"><b>All ${ps.length} ${esc(t)} guides →</b></a>` : ""}</nav>`).join("")}`;
  return shell("Gift guides — real gifts in stock, picked by AI | gift.directory", "Christmas and year-round gift guides for lawyers, nurses, coworkers, family and more: real, in-stock gifts with live prices, picked by AI.", `${ROOT}/gifts`, body, [], ad);
}
export function renderTopic(topic, built, ad = "") {
  const ps = byTopicBuilt(built)[topic] || [], url = `${ROOT}/gifts/topic/${topicSlug(topic)}`;
  const body = `<div class="crumbs"><a href="/">gift.directory</a> › <a href="/gifts">Gift guides</a> › ${esc(topic)}</div>
<h1 style="font-family:Georgia,serif;margin:4px 0 6px">${esc(topic)} gift guides</h1><p class="muted">${ps.length} guides with real, in-stock gifts and live prices.</p>
<nav class="rel" aria-label="${esc(topic)} guides">${ps.map(p => `<a href="/gifts/${p.slug}">${esc(p.keyword)}</a>`).join("")}</nav>
${houseAd(topic, "topic-" + topicSlug(topic))}
<p style="margin-top:18px"><a href="/gifts">← All gift guides</a></p>`;
  const ld = [{ "@context": "https://schema.org", "@type": "ItemList", name: `${topic} gift guides`, url, itemListElement: ps.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${ROOT}/gifts/${p.slug}`, name: p.keyword })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Gift guides", item: `${ROOT}/gifts` }, { "@type": "ListItem", position: 2, name: topic, item: url }] }];
  return shell(`${topic} gift guides — real gifts in stock | gift.directory`, `${ps.length} ${topic} gift guides: real, in-stock gifts with live prices, picked by AI.`.slice(0, 155), url, body, ld, ad);
}
// Related guides: built pages only, ranked by what a reader of this page would click next. The same people
// (a profession group or family member, read from the slug) counts most, then the same occasion, then the same
// topic and store. Ties keep the page's neighbours in its own topic first, so links spread across a topic.
const WHO = { law: ["lawyer", "lawyers", "attorney", "attorneys", "law", "paralegal", "paralegals", "legal", "judge", "bar"],
  medical: ["nurse", "nurses", "nursing", "doctor", "doctors", "medical", "physician", "pharmacist", "pharmacists", "pharmacy", "dentist", "dentists", "dental", "emt", "emts"],
  fire: ["firefighter", "firefighters", "fire"], police: ["police", "officer", "officers"], military: ["military", "soldier", "soldiers"],
  teaching: ["teacher", "teachers", "principal", "principals", "class"], office: ["boss", "coworker", "coworkers", "employee", "employees", "client", "clients", "office"],
  dad: ["dad", "him", "husband", "boyfriend", "brother", "men"], mom: ["mom", "her", "wife", "girlfriend", "sister", "women"], kids: ["kids", "toddlers", "teens", "teen", "tweens", "boys", "girls"] };
const OCC = { retirement: /retire/, graduation: /graduat|academy|passed|students?\b/, santa: /secret-santa|white-elephant|gag-gifts|stocking/, christmas: /christmas|hanukkah/,
  thanks: /thank|appreciation/, birthday: /birthday|year-old/, love: /anniversary|valentine/, home: /wedding|registry|housewarming|homeowner|new-parents|baby/ };
const tags = p => { const w = p.slug.split("-");
  return { who: Object.keys(WHO).filter(k => WHO[k].some(t => w.includes(t))), occ: Object.keys(OCC).filter(k => OCC[k].test(p.slug)) }; };
export function related(p, built = null, n = 11) {
  const ok = x => x.slug !== p.slug && (!built || built.has(x.slug));
  const same = PAGES.filter(x => x.topic === p.topic), i = same.findIndex(x => x.slug === p.slug);
  const ring = i < 0 ? same : [...same.slice(i + 1), ...same.slice(0, i)], order = new Map(ring.map((x, k) => [x.slug, k]));
  const me = tags(p), score = x => { const t = tags(x);
    return (t.who.some(w => me.who.includes(w)) ? 4 : 0) + (t.occ.some(o => me.occ.includes(o)) ? 3 : 0) + (x.topic === p.topic ? 2 : 0) + (p.store && x.store === p.store ? 1 : 0); };
  return PAGES.filter(ok).map((x, k) => ({ x, s: score(x), o: order.has(x.slug) ? order.get(x.slug) : 1e4 + k }))
    .sort((a, b) => b.s - a.s || a.o - b.o).slice(0, n).map(c => c.x);
}
// Each league's fan pages hang off one sport guide, and that guide lists every team.
const SPORT_HUB = { NFL: "gifts-for-football-fans", College: "gifts-for-football-fans", MLB: "gifts-for-baseball-fans", NHL: "gifts-for-hockey-fans",
  NBA: "gifts-for-basketball-fans", WNBA: "gifts-for-basketball-fans", MLS: "gifts-for-soccer-fans", Clubs: "gifts-for-soccer-fans", National: "gifts-for-soccer-fans" };
export function teamNav(p, built) {
  const nav = (ps, label = "Teams") => `<nav class="rel" aria-label="${esc(label)}">${ps.map(x => `<a href="/gifts/${x.slug}">${esc(x.keyword.replace(/^Gifts for /, "").replace(/ fans$/, ""))}</a>`).join("")}</nav>`;
  if (p.team) {
    const hub = pageBySlug(SPORT_HUB[p.team.league]), mates = TEAM_PAGES.filter(x => x.team.league === p.team.league && x.slug !== p.slug && built.has(x.slug));
    return (mates.length ? `<h2 style="font-family:Georgia,serif">More ${esc(/ fans$/.test(p.topic) ? p.topic.replace(/ fans$/, " teams").replace(/^College/, "college") : p.topic.toLowerCase())}</h2>${nav(mates)}` : "") +
      (hub && built.has(hub.slug) ? `<p><a href="/gifts/${hub.slug}">${esc(hub.keyword)} →</a></p>` : "");
  }
  const leagues = Object.keys(SPORT_HUB).filter(lg => SPORT_HUB[lg] === p.slug);
  return leagues.map(lg => { const ts = TEAM_PAGES.filter(x => x.team.league === lg && built.has(x.slug)), t = ts[0] && ts[0].topic;
    return ts.length ? `<h2 style="font-family:Georgia,serif">Shop by team: ${esc(t.replace(/ fans$/, ""))}</h2>${nav(ts, `${t.replace(/ fans$/, "")} teams`)}` : ""; }).join("");
}
export function sitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(String(u.lastmod).slice(0, 10))}</lastmod>` : ""}</url>`).join("\n") + "\n</urlset>\n";
}
