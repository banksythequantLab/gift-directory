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
  [1, "paper", "clocks", 100, ["custom star map print", "personalized photo book", "leather bound journal", "framed vintage map print"], ["wooden desk clock", "engraved mantel clock", "personalized wall clock", "sunrise alarm clock"]],
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
  NFL: { sport: "football", slots: ["jersey", "hoodie", "knit beanie", "throw blanket", "coffee mug", "Christmas ornament", "wall sign"] },
  MLB: { sport: "baseball", slots: ["jersey", "fitted cap", "hoodie", "throw blanket", "coffee mug", "Christmas ornament", "wall sign"] },
  NBA: { sport: "basketball", slots: ["jersey", "hoodie", "snapback hat", "throw blanket", "coffee mug", "Christmas ornament", "mini basketball"] },
  NHL: { sport: "hockey", slots: ["jersey", "hoodie", "knit beanie", "throw blanket", "coffee mug", "Christmas ornament", "wall sign"] },
  WNBA: { sport: "basketball", min: 4, slots: ["jersey", "hoodie", "hat", "t-shirt", "coffee mug", "throw blanket", "mini basketball"] },
  MLS: { sport: "soccer", min: 4, slots: ["jersey", "scarf", "hoodie", "knit beanie", "throw blanket", "coffee mug", "soccer ball"] },
  College: { sport: "college sports", topic: "College fans", slots: ["hoodie", "football jersey", "knit beanie", "throw blanket", "coffee mug", "Christmas ornament", "wall sign"] },
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
const SLOT_WORDS = { jersey: ["jersey", "shirt", "kit"], scarf: ["scarf"], hoodie: ["hoodie", "hoody", "sweatshirt", "pullover", "zip"],
  hat: ["hat", "cap", "beanie", "knit", "toque", "headwear", "woolie"], beanie: ["beanie", "knit", "toque", "hat", "woolie"], blanket: ["blanket", "throw"],
  mug: ["mug", "tumbler", "cup", "flask"], ball: ["ball"], flag: ["flag", "banner"], "t-shirt": ["t-shirt", "tee"] };
const slotWords = s => { const k = Object.keys(SLOT_WORDS).filter(w => s.toLowerCase().includes(w)).pop(); return k ? SLOT_WORDS[k] : null; };
export const TEAM_PAGES = Object.entries(TEAMS).flatMap(([lg, teams]) => teams.map(t => {
  const full = teamName(t), nick = teamNick(full), L = LEAGUE[lg], name = L.label ? L.label(full) : full;
  return P(`gifts-for-${slugify(name)}-fans`, `Gifts for ${name} fans`, `a ${name} fan`, "Christmas", 100, {
    topic: L.topic || `${lg} fans`, count: 7, minCount: L.min || 5, team: { league: lg, full, nick, shared: SHARED_NICK.has(nick) },
    slots: L.slots.map(s => `${full} ${s}`),
    ...(L.strict ? { slotMust: L.slots.map(slotWords) } : {}),
    require: [...new Set([...teamSpellings(full), ...(Array.isArray(t) ? t.slice(1) : [])])],
    exclude: ["gift card", "replica toy gun", "for dogs", "pet ", ...(L.exclude || [])],
    notes: `officially licensed ${full} gear for a ${LEAGUE[lg].sport} fan; every product must be ${full} merchandise` });
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
  P("gifts-for-law-students", "Gifts for law students", "a law student", "Christmas", 75, { store: "lawyers", topic: "Law" }),
  P("judge-retirement-gifts", "Retirement gifts for a judge", "a judge", "retirement", 300, { store: "lawyers", topic: "Law" }),
  P("gifts-for-paralegals", "Gifts for paralegals", "a paralegal", "Christmas", 75, { store: "lawyers", topic: "Law" }),
  P("scales-of-justice-gifts", "Scales of justice gifts", "a lawyer", "any occasion", 300, { store: "lawyers", topic: "Law", notes: "scales of justice, Lady Justice, gavel themed gifts" }),
  P("gifts-for-female-lawyers", "Gifts for female lawyers", "a woman who is a lawyer", "Christmas", 200, { store: "lawyers", topic: "Law" }),
  P("law-office-secret-santa-gifts", "Secret Santa gifts for a law office", "a coworker at a law firm", "Secret Santa", 30, { store: "lawyers", topic: "Law" }),
  // nurses & healthcare
  P("christmas-gifts-for-nurses", "Christmas gifts for nurses", "a nurse", "Christmas", 100, { store: "nurses", topic: "Nurses & healthcare" }),
  P("nurse-appreciation-gifts", "Nurse appreciation gifts", "a nurse", "thank you", 75, { store: "nurses", topic: "Nurses & healthcare" }),
  P("thank-you-gifts-for-nurses-from-patients", "Thank you gifts for nurses from patients", "the nurse who cared for me", "thank you", 75, { store: "nurses", topic: "Nurses & healthcare" }),
  P("gifts-for-night-shift-nurses", "Gifts for night shift nurses", "a nurse who works nights", "Christmas", 75, { store: "nurses", topic: "Nurses & healthcare", notes: "night shift, sleep, comfort" }),
  P("gifts-for-nursing-students", "Gifts for nursing students", "a nursing student", "graduation", 75, { store: "nurses", topic: "Nurses & healthcare" }),
  P("nurse-retirement-gifts", "Nurse retirement gifts", "a retiring nurse", "retirement", 150, { store: "nurses", topic: "Nurses & healthcare" }),
  P("christmas-gifts-for-doctors", "Christmas gifts for doctors", "a doctor", "Christmas", 200, { topic: "Nurses & healthcare" }),
  // office & work
  P("christmas-gifts-for-coworkers-under-25", "Christmas gifts for coworkers under $25", "a coworker", "Christmas", 25, { topic: "Work & office" }),
  P("secret-santa-gifts-under-25", "Secret Santa gifts under $25", "a coworker", "Secret Santa", 25, { topic: "Work & office" }),
  P("secret-santa-gifts-under-50", "Secret Santa gifts under $50", "a coworker or friend", "Secret Santa", 50, { topic: "Work & office" }),
  P("white-elephant-gifts-under-30", "White elephant gifts under $30", "anyone at a gift exchange", "white elephant", 30, { topic: "Work & office", notes: "fun, crowd-pleasing, gets stolen" }),
  P("christmas-gifts-for-boss", "Christmas gifts for your boss", "my boss", "Christmas", 100, { topic: "Work & office" }),
  P("group-gifts-for-boss-from-team", "Group gifts for a boss from the team", "our boss, from the whole team", "Christmas", 300, { topic: "Work & office" }),
  P("christmas-gifts-for-clients", "Christmas gifts for clients", "a client", "Christmas", 100, { topic: "Work & office" }),
  P("christmas-gifts-for-employees", "Christmas gifts for employees", "an employee", "Christmas", 50, { topic: "Work & office" }),
  P("retirement-gifts-for-coworkers", "Retirement gifts for coworkers", "a retiring coworker", "retirement", 150, { topic: "Work & office" }),
  P("group-gifts-for-teachers-from-class", "Group gifts for a teacher from the class", "our child's teacher, from the whole class", "Christmas", 200, { topic: "Work & office" }),
  // holidays
  P("what-to-bring-to-thanksgiving-not-food", "What to bring to Thanksgiving if you're told not to bring food", "the Thanksgiving host", "Thanksgiving dinner, as a guest who was told not to bring food", 60,
    { topic: "Holidays", notes: "a host or hostess gift that is NOT food: candles, table linens, serving pieces, a houseplant or lasting flowers, wine or bar accessories, after-dinner games, keepsakes; answer the question directly and include etiquette (don't expect it to be used that night)" }),
  P("thanksgiving-hostess-gifts-under-25", "Thanksgiving hostess gifts under $25", "the Thanksgiving host", "Thanksgiving", 25, { topic: "Holidays", notes: "small non-food host gift" }),
  P("friendsgiving-host-gifts", "Friendsgiving host gifts", "a friend hosting Friendsgiving", "Friendsgiving", 40, { topic: "Holidays", notes: "casual, fun, not food" }),
  P("hanukkah-gifts-for-adults", "Hanukkah gifts for adults", "an adult who celebrates Hanukkah", "Hanukkah", 75, { topic: "Holidays", notes: "tasteful Hanukkah or everyday gifts; menorah, dreidel sets, home items" }),
  P("christmas-gifts-for-teens", "Christmas gifts for teens", "a teenager", "Christmas", 75, { topic: "Holidays" }),
  P("christmas-gifts-under-20", "Christmas gifts under $20", "anyone on my list", "Christmas", 20, { topic: "Holidays" }),
  P("christmas-gifts-under-10", "Christmas gifts under $10", "anyone on my list", "Christmas", 10, { topic: "Holidays" }),
  P("last-minute-christmas-gifts", "Last-minute Christmas gifts", "anyone on my list", "Christmas, needed fast", 75, { topic: "Holidays", notes: "widely in stock at big retailers" }),
  P("christmas-gifts-for-neighbors", "Christmas gifts for neighbors", "my neighbors", "Christmas", 25, { topic: "Holidays", notes: "not food" }),
  P("christmas-gifts-for-mail-carrier", "Christmas gifts for your mail carrier", "our mail carrier", "Christmas thank you", 25, { topic: "Holidays", notes: "practical for someone outdoors all day; not cash" }),
  P("christmas-gifts-for-babysitter", "Christmas gifts for the babysitter", "our babysitter", "Christmas thank you", 50, { topic: "Holidays" }),
  P("christmas-gifts-for-in-laws", "Christmas gifts for in-laws", "my in-laws", "Christmas", 100, { topic: "Holidays" }),
  P("christmas-gifts-for-couples", "Christmas gifts for couples", "a couple", "Christmas", 100, { topic: "Holidays", notes: "something they share" }),
  P("new-years-eve-party-host-gifts", "New Year's Eve party host gifts", "the New Year's Eve party host", "New Year's Eve", 50, { topic: "Holidays", notes: "champagne accessories, games, not food" }),
  // life events
  P("housewarming-gifts", "Housewarming gifts that aren't boring", "a friend who just moved", "housewarming", 75, { topic: "Life events" }),
  P("gifts-for-new-homeowners", "Gifts for new homeowners", "new homeowners", "first home", 100, { topic: "Life events" }),
  P("gifts-for-new-parents", "Gifts for new parents (not the baby)", "new parents", "new baby", 75, { topic: "Life events", notes: "for the parents themselves: comfort, sleep, self-care" }),
  P("sympathy-gifts", "Thoughtful sympathy gifts", "someone who lost a loved one", "sympathy", 75, { topic: "Life events", notes: "gentle, comforting, not flowers" }),
  P("get-well-soon-gifts", "Get well soon gifts", "someone recovering", "get well", 60, { topic: "Life events", notes: "comfort, distraction, cozy" }),
  P("graduation-gifts-for-college-grads", "Graduation gifts for college grads", "a college graduate", "graduation", 100, { topic: "Life events" }),
  P("wedding-gifts-off-the-registry", "Wedding gifts off the registry", "a couple getting married", "wedding", 150, { topic: "Life events", notes: "meaningful, lasting" }),
  P("group-wedding-gifts-from-coworkers", "Group wedding gifts from coworkers", "a coworker who is getting married, from the team", "wedding", 250, { topic: "Life events" }),
  // professions
  P("gifts-for-teachers-under-25", "Gifts for teachers under $25", "a teacher", "Christmas", 25, { topic: "Professions" }),
  P("gifts-for-accountants", "Gifts for accountants", "an accountant", "Christmas", 100, { topic: "Professions", notes: "busy season survival, desk" }),
  P("gifts-for-realtors", "Gifts for realtors", "a real estate agent", "thank you", 100, { topic: "Professions" }),
  P("gifts-for-dentists", "Gifts for dentists", "a dentist", "Christmas", 100, { topic: "Professions" }),
  P("gifts-for-pharmacists", "Gifts for pharmacists", "a pharmacist", "Christmas", 75, { topic: "Professions" }),
  P("gifts-for-firefighters", "Gifts for firefighters", "a firefighter", "Christmas", 75, { topic: "Professions", cap: 2,
    notes: "things a firefighter uses on and off shift: a bright rechargeable flashlight or headlamp, an insulated tumbler, a boot dryer, a firehouse cookbook or kitchen gear for the station, fire-department themed keepsakes (the Maltese cross firefighter emblem, not religious crosses), recovery and comfort items after long shifts; at most one flask; no generic wallets",
    exclude: ["USMC", "Marine Corps", "U.S. Army", "US Army", "U.S. Navy", "US Navy", "Air Force", "Space Race", "Flowery", "Cross Wall Art"] }),
  P("gifts-for-police-officers", "Gifts for police officers", "a police officer", "Christmas", 75, { topic: "Professions", cap: 2,
    notes: "practical for patrol shifts and long hours: a reliable flashlight, an insulated travel mug or tumbler, a duty-bag or car organizer, comfortable socks or insoles for long hours on their feet, thin blue line or police-themed keepsakes, a shadow box or badge display; nothing military-branch specific",
    exclude: ["USMC", "Marine Corps", "U.S. Army", "US Army", "U.S. Navy", "US Navy", "Air Force", "Space Race", "Espresso", "Coffee Press"] }),
  P("gifts-for-soldiers", "Gifts for soldiers", "a soldier serving in the military", "Christmas", 75, { topic: "Professions", cap: 2,
    notes: "useful in the barracks or on deployment and easy to ship: a rugged watch, a compact rechargeable headlamp, a quality multitool, moisture-wicking boot socks, a portable power bank, a travel hygiene kit, a lightweight blanket or pillow, a photo keepsake from home; no weapons or knives",
    exclude: ["knife", "knives", "dagger", "holster", "gun "] }),
  P("gifts-for-emts", "Gifts for EMTs and paramedics", "an EMT or paramedic", "Christmas", 75, { topic: "Professions", cap: 2,
    notes: "for long ambulance shifts: a quality stethoscope, trauma shears, a medical penlight, a watch with a second hand for taking vitals, compression socks, an insulated tumbler, a pocket organizer or EMS duty bag, comfort and recovery after 24-hour shifts; no trinkets or decor",
    exclude: ["Trinket", "Treasure Box", "Keepsake Box", "Beaded"] }),
  P("gifts-for-lifeguards", "Gifts for lifeguards", "a lifeguard", "Christmas or end of the season", 60, { topic: "Professions", cap: 2,
    notes: "for long days on the stand: a lifeguard whistle and lanyard, polarized sunglasses, a reef-safe sunscreen or SPF lip balm set, a big insulated water bottle, a quick-dry towel, a wide-brim hat, a waterproof phone pouch, a dry bag" }),
  P("gifts-for-computer-geeks", "Gifts for computer geeks", "someone who loves computers and tech", "Christmas", 100, { topic: "Professions", cap: 2,
    notes: "for a computer enthusiast or programmer: a mechanical keyboard, a nice mouse or desk mat, a USB-C hub or dock, a portable SSD, smart home gadgets, a programming or hacker-humor desk toy, a Raspberry Pi or electronics kit, a cable organizer, a monitor light bar; finished consumer products, not bare components",
    exclude: ["ROHS", "HAT, BOARD", "Evaluation Kit"] }),
  P("gifts-for-engineers", "Gifts for engineers", "an engineer", "Christmas", 100, { topic: "Professions", notes: "clever, well-made, desk or gadgets" }),
  P("gifts-for-pilots", "Gifts for pilots", "a pilot", "Christmas", 100, { topic: "Professions" }),
  // tech (count: exactly that many products, or the build fails rather than publish a short "10 best" list)
  P("10-best-high-tech-christmas-gifts", "10 best high-tech Christmas gifts", "someone who loves the latest tech", "Christmas", 300, { topic: "Tech", cap: 1, count: 10,
    slots: ["noise cancelling wireless headphones", "smartwatch", "smart display", "portable projector", "e-reader", "camera drone", "smart ring", "handheld gaming console", "instant camera", "robot vacuum"],
    notes: "ten standout gadgets, one of each kind: wireless noise-cancelling earbuds or headphones, a smartwatch or fitness tracker, a smart display or smart speaker, a portable projector, an e-reader, a camera drone, a smart ring, a handheld gaming console, an instant or action camera, a robot vacuum or smart home hub; no cables, cases or accessories" }),
  P("tech-gifts-under-50", "Tech gifts under $50", "someone who likes gadgets", "Christmas", 50, { topic: "Tech", cap: 2,
    notes: "useful gadgets under $50: Bluetooth tracker tags, a compact power bank, smart plugs, a mini Bluetooth speaker, wireless earbuds, a phone or tablet stand, an LED desk lamp with wireless charging" }),
  P("tech-gifts-under-100", "Tech gifts under $100", "someone who likes gadgets", "Christmas", 100, { topic: "Tech", cap: 2,
    notes: "gadgets $50-$100: wireless earbuds, a fitness tracker, a smart speaker or display, a Kindle-style e-reader, a portable SSD, a mechanical keyboard, a video doorbell, a digital photo frame" }),
  P("tech-stocking-stuffers", "Tech stocking stuffers", "anyone who loves gadgets", "Christmas stocking", 30, { topic: "Tech", cap: 2,
    notes: "small gadgets that fit in a stocking: Bluetooth tracker tags, a keychain power bank, a phone grip or MagSafe wallet, a mini tripod, a multi-port USB-C charger, a mini flashlight, a cable organizer" }),
  P("tech-gifts-for-teens", "Tech gifts for teens", "a teenager", "Christmas", 100, { topic: "Tech", cap: 2,
    notes: "what teens actually use: wireless earbuds, an instant camera, LED strip lights, a portable Bluetooth speaker, a gaming headset, a phone ring light, a mini projector" }),
  P("tech-gifts-for-men", "Tech gifts for men", "a man who likes gadgets", "Christmas", 150, { topic: "Tech", cap: 2,
    notes: "a smartwatch, noise-cancelling headphones, a smart grill or meat thermometer, a car phone mount with charging, a portable power station, a drone, a smart garage or home gadget" }),
  P("tech-gifts-for-women", "Tech gifts for women", "a woman who likes gadgets", "Christmas", 150, { topic: "Tech", cap: 2,
    notes: "a smart ring or fitness tracker, wireless earbuds, a digital photo frame, a smart mug that keeps coffee warm, an e-reader, a wireless charging stand, a hair or skincare gadget" }),
  P("tech-gifts-for-seniors", "Tech gifts for seniors and grandparents", "a grandparent or older adult", "Christmas", 150, { topic: "Tech", cap: 2,
    notes: "easy to set up and use: a digital photo frame family can send photos to, a smart speaker or display for video calls, a large-print e-reader or tablet, a video doorbell, a medication reminder or pill dispenser, a tracker tag for keys; nothing complicated" }),
  P("smart-home-gifts", "Smart home gifts", "someone setting up a smart home", "Christmas", 150, { topic: "Tech", cap: 2,
    notes: "smart plugs, smart bulbs or light strips, a smart speaker or display, a video doorbell, a robot vacuum, a smart thermostat, a smart lock" }),
  P("gifts-for-gamers", "Gifts for gamers", "a gamer", "Christmas", 150, { topic: "Gaming", cap: 1,
    notes: "one of each: a wireless gaming headset, an extra wireless controller, a mechanical gaming keyboard, a gaming mouse, a large desk mat, a headset stand, a controller charging dock, RGB light bars for the setup; no game codes, gift cards or PC parts",
    exclude: GAMING_EXCLUDE }),
  P("10-best-gifts-for-gamers", "10 best gifts for gamers", "a gamer", "Christmas", 250, { topic: "Gaming", count: 10,
    slots: ["wireless gaming headset", "pro wireless game controller", "mechanical gaming keyboard", "wireless gaming mouse", "gaming desk mat", "handheld gaming console", "controller charging dock", "RGB smart light bars", "gaming headset stand", "portable gaming monitor"],
    exclude: GAMING_EXCLUDE, notes: "ten different kinds of gaming gifts" }),
  P("gifts-for-gamers-under-50", "Gifts for gamers under $50", "a gamer", "Christmas", 50, { topic: "Gaming", count: 7, minCount: 5, slots: ["wireless gaming mouse", "extended gaming desk mat", "headset stand", "controller charging dock", "controller thumb grips", "RGB LED light strip", "gaming mug"], exclude: GAMING_EXCLUDE,
    notes: "useful under $50: a gaming mouse, a large desk mat, a headset stand, a controller charging dock, controller thumb grips, LED light strip, a cable organizer, a gaming-themed mug" }),
  P("gifts-for-pc-gamers", "Gifts for PC gamers", "a PC gamer", "Christmas", 150, { topic: "Gaming", cap: 1, exclude: GAMING_EXCLUDE,
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
  P("gifts-for-gamer-girlfriend", "Gifts for your gamer girlfriend", "my girlfriend, who loves video games", "Christmas", 100, { topic: "Gaming", cap: 1, exclude: [...GAMING_EXCLUDE, ...NICHE_NOVELTY],
    notes: "a cute wireless headset, a pastel or themed controller, a cozy gaming blanket or hoodie, a cat-ear or aesthetic desk setup piece, a Switch case, LED lights" }),
  P("gifts-for-board-game-lovers", "Gifts for board game lovers", "someone who loves board games", "Christmas", 75, { topic: "Gaming", count: 7, minCount: 5, slots: ["strategy board game", "party board game", "two-player board game for couples", "dice tower", "metal dice set", "automatic card shuffler", "board game organizer"],
    notes: "a popular strategy or party board game, a game night table topper or dice tower, a premium dice set, a card shuffler, a board game storage organizer, a two-player game for couples" }),
  P("home-office-tech-gifts", "Home office gifts for remote workers", "someone who works from home", "Christmas", 100, { topic: "Tech", cap: 2,
    notes: "a webcam, a monitor light bar, a USB-C dock, noise-cancelling headphones, a laptop stand, a desk mat, a wireless charging pad, an under-desk walking pad if within budget" }),
  P("travel-tech-gifts", "Travel tech gifts", "someone who travels a lot", "Christmas", 100, { topic: "Tech", cap: 2,
    notes: "a universal travel adapter, noise-cancelling headphones or earbuds, a compact power bank, Bluetooth tracker tags for luggage, a travel charging station, a portable phone stand for planes" }),
  P("fitness-tech-gifts", "Fitness tech gifts", "someone who works out", "Christmas", 150, { topic: "Tech", cap: 2,
    notes: "a fitness tracker or smartwatch, sport earbuds, a massage gun, a smart jump rope, a heart-rate monitor, a smart water bottle" }),
  P("gifts-for-photographers", "Gifts for photographers", "a photographer", "Christmas", 150, { topic: "Tech", cap: 2,
    notes: "a camera bag or sling, a tripod, SD cards or a fast card reader, a lens cleaning kit, a camera strap, portable LED lights, a portable SSD for photos" }),
  P("kitchen-gadget-gifts", "Kitchen gadget gifts", "someone who loves to cook", "Christmas", 100, { topic: "Tech", cap: 2,
    notes: "an air fryer, a smart meat thermometer, an immersion blender, a precision kettle, a sous vide cooker, a digital kitchen scale, an electric spice grinder" }),
  // hobbies
  P("gifts-for-fishermen", "Gifts for fishermen", "someone who loves fishing", "Christmas", 100, { topic: "Hobbies", cap: 2,
    notes: "a tackle box or tackle bag, fishing pliers or multitool, polarized fishing sunglasses, a lure assortment, a waterproof dry bag, a rod holder, a fishing hat or performance shirt" }),
  P("gifts-for-hunters", "Gifts for hunters", "someone who hunts", "Christmas", 150, { topic: "Hobbies", cap: 2,
    notes: "heated gloves or socks, a trail camera, binoculars, a rechargeable headlamp, an insulated thermos, a hunting pack, a portable seat cushion; no firearms, ammunition or weapons",
    exclude: ["ammo", "ammunition", "rifle", "firearm", "gun ", "pistol", "scope mount"] }),
  P("gifts-for-gardeners", "Gifts for gardeners", "someone who loves gardening", "Christmas", 75, { topic: "Hobbies", cap: 2,
    notes: "quality pruners, a garden kneeler seat, gardening gloves, a tool set or tote, a hose nozzle, a raised bed or planter, a seed starting kit, a garden journal" }),
  P("gifts-for-campers", "Gifts for campers", "someone who loves camping", "Christmas", 100, { topic: "Hobbies", cap: 2,
    notes: "a camping lantern, a portable camp stove, a hammock, a sleeping pad, a camp chair, a multitool, a water filter, an insulated camp mug" }),
  P("gifts-for-hikers", "Gifts for hikers", "someone who loves hiking", "Christmas", 100, { topic: "Hobbies", cap: 2,
    notes: "trekking poles, a daypack, a hydration reservoir, merino hiking socks, a headlamp, a lightweight rain jacket, a water filter bottle, a trail first-aid kit" }),
  P("gifts-for-bakers", "Gifts for bakers", "someone who loves to bake", "Christmas", 75, { topic: "Hobbies", cap: 2,
    notes: "a stand mixer attachment or hand mixer, a digital kitchen scale, a bread proofing basket, a pastry mat, a cookie decorating set, a quality baking sheet set, a baking cookbook" }),
  P("gifts-for-book-lovers", "Gifts for book lovers", "someone who loves to read", "Christmas", 50, { topic: "Hobbies", cap: 2,
    notes: "a book light, a reading pillow, a bookstand, a cozy throw, bookends, a personalized bookplate or embosser, a reading journal, an e-reader cover" }),
  P("gifts-for-music-lovers", "Gifts for music lovers", "someone who loves music", "Christmas", 100, { topic: "Hobbies", cap: 2,
    notes: "a record player, quality headphones, a Bluetooth speaker, a vinyl storage crate, a music-themed print, a beginner instrument like a ukulele, a concert ticket holder or display" }),
  P("gifts-for-crafters", "Gifts for crafters", "someone who loves crafts", "Christmas", 75, { topic: "Hobbies", cap: 2,
    notes: "a craft storage organizer, a cutting machine accessory or self-healing mat, a quality scissors set, a knitting or crochet kit, a sewing kit, an embroidery kit, a craft lamp" }),
  P("gifts-for-dog-lovers", "Gifts for dog lovers", "someone who loves their dog", "Christmas", 50, { topic: "Hobbies", cap: 2,
    notes: "a custom pet portrait, a personalized dog ornament or mug, a dog-themed blanket, a treat-dispensing camera or toy, a dog walking bag, a cozy dog bed" }),
  P("gifts-for-cat-lovers", "Gifts for cat lovers", "someone who loves their cat", "Christmas", 50, { topic: "Hobbies", cap: 2,
    notes: "a custom cat portrait, a cat tree or window perch, a cat-themed mug or socks, a self-cleaning litter accessory, interactive cat toys, a cat-themed throw" }),
  P("gifts-for-wine-lovers", "Gifts for wine lovers", "someone who loves wine", "Christmas", 75, { topic: "Hobbies", cap: 2,
    notes: "an electric wine opener, a wine aerator, quality wine glasses, a wine chiller, a wine journal, a countertop wine rack, a wine preserver" }),
  P("gifts-for-runners", "Gifts for runners", "someone who runs", "Christmas", 100, { topic: "Hobbies", cap: 2,
    notes: "a running belt, sport earbuds, a GPS running watch, a foam roller or massage gun, running socks, a reflective vest or running light, a hydration vest" }),
  P("gifts-for-tea-lovers", "Gifts for tea lovers", "someone who loves tea", "Christmas", 50, { topic: "Hobbies", cap: 2,
    notes: "a glass teapot or tea infuser set, an electric gooseneck kettle, a tea sampler or loose-leaf collection, a matcha set, a tea mug with infuser, a tea storage tin set" }),
  P("gifts-for-beer-lovers", "Gifts for beer lovers", "someone who loves craft beer", "Christmas", 50, { topic: "Hobbies", cap: 2,
    notes: "a home brewing kit, beer glasses set, an insulated growler, a beer cap map or display, a bottle opener, a beer tasting journal" }),
  P("gifts-for-yoga-lovers", "Gifts for yoga lovers", "someone who does yoga", "Christmas", 75, { topic: "Hobbies", cap: 2,
    notes: "a quality yoga mat, yoga blocks and strap, a meditation cushion, a mat bag, an essential oil diffuser, a cozy wrap or yoga pants" }),
  P("gifts-for-artists", "Gifts for artists", "an artist who paints or draws", "Christmas", 75, { topic: "Hobbies", cap: 2,
    notes: "a professional colored pencil or marker set, watercolor paints, a sketchbook, a tabletop easel, an art supply organizer, a quality brush set, a portable art case" }),
  P("gifts-for-nature-lovers", "Gifts for nature lovers", "someone who loves the outdoors and nature", "Christmas", 75, { topic: "Hobbies", cap: 2,
    notes: "a bird feeder or birdhouse, binoculars, a field guide, a nature journal, a plant terrarium, a star map or telescope, a wildflower seed kit" }),
  P("gifts-for-travelers", "Gifts for travelers", "someone who loves to travel", "Christmas", 100, { topic: "Hobbies", cap: 2,
    notes: "a carry-on packing cube set, a scratch-off world map, a travel pillow, a leather passport holder, a toiletry bag, a weekender bag, a travel journal" }),
  // anniversaries by year
  ...ANNIVERSARY_PAGES,
  ...TEAM_PAGES,
  ...THEME_PAGES,
  // family & interests
  P("christmas-gifts-for-boyfriend", "Christmas gifts for your boyfriend", "my boyfriend", "Christmas", 100, { topic: "Family & interests", cap: 2, exclude: NICHE_NOVELTY,
    notes: "thoughtful gifts he will use: a quality wallet or watch, a cozy hoodie or pullover, headphones, a grooming set, a personalized keepsake, barware, a gadget; no novelty joke gifts" }),
  P("christmas-gifts-for-girlfriend", "Christmas gifts for your girlfriend", "my girlfriend", "Christmas", 100, { topic: "Family & interests", cap: 2, exclude: NICHE_NOVELTY,
    notes: "thoughtful gifts she will love: jewelry, a cozy robe or throw, a spa or beauty set, a handbag or accessory, a personalized keepsake, a candle; no novelty joke gifts" }),
  P("christmas-gifts-for-husband", "Christmas gifts for your husband", "my husband", "Christmas", 200, { topic: "Family & interests", cap: 2, exclude: NICHE_NOVELTY,
    notes: "a quality watch or wallet, a leather weekender bag, premium headphones, a grilling or bar upgrade, a cozy quarter-zip, a personalized keepsake, a tool he has wanted" }),
  P("christmas-gifts-for-wife", "Christmas gifts for your wife", "my wife", "Christmas", 200, { topic: "Family & interests", cap: 2, exclude: NICHE_NOVELTY,
    notes: "jewelry, a cashmere wrap or robe, a luxury spa set, a quality handbag, a personalized keepsake, a smart mug or photo frame, a cozy throw" }),
  P("christmas-gifts-for-sister", "Christmas gifts for your sister", "my sister", "Christmas", 75, { topic: "Family & interests", cap: 2, exclude: NICHE_NOVELTY,
    notes: "a personalized necklace or bracelet, a cozy throw, a candle set, a spa or skincare set, a cute tote, a journal, a sibling keepsake" }),
  P("christmas-gifts-for-brother", "Christmas gifts for your brother", "my brother", "Christmas", 75, { topic: "Family & interests", cap: 2, exclude: NICHE_NOVELTY,
    notes: "a gadget, a quality wallet, a hoodie, a card or board game, barware, a multitool, a grooming kit" }),
  P("gifts-for-new-grandparents", "Gifts for new grandparents", "new grandparents", "new grandchild", 75, { topic: "Life events", cap: 2,
    notes: "a digital photo frame, a personalized grandparent keepsake or ornament, a 'grandma/grandpa' mug, a baby photo album, a memory journal" }),
  P("gifts-for-college-students", "Gifts for college students", "a college student", "Christmas", 50, { topic: "Life events", cap: 2,
    notes: "a dorm-friendly mini fridge or kettle, noise-cancelling earbuds, a portable charger, a weighted or cozy blanket, a backpack, a desk lamp, a coffee maker for one" }),
  // christmas, broad
  P("unique-christmas-gifts", "Unique Christmas gifts", "someone who would love something different", "Christmas", 100, { topic: "Holidays", cap: 2, exclude: NICHE_NOVELTY,
    notes: "unusual but useful: a star map print, a cocktail smoker, a levitating plant pot, a custom pet portrait, a scratch-off map, a sunrise alarm clock, a smart garden" }),
  P("personalized-christmas-gifts", "Personalized Christmas gifts", "someone special", "Christmas", 75, { topic: "Holidays", cap: 2, exclude: NICHE_NOVELTY,
    notes: "gifts that can be personalized with a name, initials, date or photo: engraved jewelry, a monogrammed blanket, a custom cutting board, a photo book, an engraved decanter, a name ornament" }),
  P("christmas-gifts-for-people-who-are-hard-to-shop-for", "Christmas gifts for people who are hard to shop for", "someone who is hard to shop for", "Christmas", 100, { topic: "Holidays", cap: 2, exclude: NICHE_NOVELTY,
    notes: "safe bets with a wow factor: a heated throw, a premium candle, a smart mug, a quality multitool, a cozy robe, a digital photo frame, a luxury snack-free gift set" }),
  P("luxury-christmas-gifts-under-200", "Luxury Christmas gifts under $200", "someone who appreciates nice things", "Christmas", 200, { topic: "Holidays", cap: 2, exclude: NICHE_NOVELTY,
    notes: "premium, well-known brands: cashmere, fine leather goods, a designer candle, premium headphones, crystal barware, a silk pillowcase set" }),
  P("christmas-gifts-for-kids-under-25", "Christmas gifts for kids under $25", "a child age 6 to 10", "Christmas", 25, { topic: "Holidays", cap: 2,
    notes: "toys and kits for ages 6-10: a building set, a science or craft kit, a family card or board game, an art set, an outdoor toy, a puzzle; age-appropriate only, nothing for adults" }),
  P("christmas-gifts-for-coworkers-under-15", "Christmas gifts for coworkers under $15", "a coworker", "Christmas", 15, { topic: "Work & office", cap: 2,
    notes: "small office-friendly gifts under $15: a nice pen, a desk plant, a mug, hand cream, a mini candle, a phone stand, a desk game; nothing personal" }),
  P("christmas-gifts-for-dad-who-has-everything", "Christmas gifts for a dad who has everything", "my dad, who has everything", "Christmas", 150, { topic: "Family & interests" }),
  P("christmas-gifts-for-mom-who-wants-nothing", "Christmas gifts for a mom who says she wants nothing", "my mom", "Christmas", 150, { topic: "Family & interests" }),
  P("christmas-gifts-for-grandparents", "Christmas gifts for grandparents", "my grandparents", "Christmas", 100, { topic: "Family & interests" }),
  P("gifts-for-coffee-lovers-under-50", "Gifts for coffee lovers under $50", "someone who loves coffee", "Christmas", 50, { topic: "Family & interests", notes: "coffee" }),
  P("gifts-for-whiskey-lovers", "Gifts for whiskey lovers", "someone who loves whiskey", "Christmas", 150, { topic: "Family & interests", notes: "whiskey, bourbon" }),
  P("gifts-for-football-fans", "Gifts for football fans", "a football fan", "Christmas", 150, { topic: "Family & interests", cap: 2,
    notes: "for an NFL or college football fan: a custom jersey personalized with their name and number in their team's colors, team-logo drinkware, a stadium blanket, tailgating gear (portable grill, cooler, folding chairs), a football display case for a signed ball, a team-themed game-day apparel item; the custom personalized jersey is the headline gift; football only, not baseball or soccer",
    exclude: ["St. Louis Cardinals", "MLB", "Baseball", "Soccer"] }),
  P("best-gifts-for-golfers", "Best gifts for golfers", "a golfer", "Christmas", 250, { topic: "Family & interests", cap: 2,
    notes: "gifts golfers use: a golf rangefinder or GPS watch, premium golf balls, a putting green or putting mat, a golf travel bag, a personalized divot tool or ball marker, a quality golf glove, a launch monitor or swing analyzer, a golf towel and accessories set; no novelty joke items" }),
  P("gifts-for-golfers-under-50", "Gifts for golfers under $50", "a golfer", "Christmas", 50, { topic: "Family & interests", notes: "golf" }),
  P("christmas-gifts-for-him-under-50", "Christmas gifts for him under $50", "a man in my life", "Christmas", 50, { topic: "Family & interests", cap: 2, notes: "lasting gifts he will use: a quality wallet or accessory, a gadget, a grooming kit, a cozy pullover or slippers, barware, a tool or multitool, a fitness or outdoor item; no food and no religious items", exclude: NICHE_NOVELTY }),
  P("christmas-gifts-for-her-under-50", "Christmas gifts for her under $50", "a woman in my life", "Christmas", 50, { topic: "Family & interests", cap: 2, notes: "lasting gifts she will use and love: jewelry, a cozy throw or robe, a beauty or spa set, a candle, a handbag or accessory, a nice journal, a photo gift; no food and no religious items", exclude: NICHE_NOVELTY }),
  P("christmas-gifts-for-him-under-100", "Christmas gifts for him under $100", "a man in my life", "Christmas", 100, { topic: "Family & interests", cap: 2, notes: "lasting gifts he will use: a quality wallet or accessory, a gadget, a grooming kit, a cozy pullover or slippers, barware, a tool or multitool, a fitness or outdoor item; no food and no religious items", exclude: NICHE_NOVELTY }),
  P("christmas-gifts-for-her-under-100", "Christmas gifts for her under $100", "a woman in my life", "Christmas", 100, { topic: "Family & interests", cap: 2, notes: "lasting gifts she will use and love: jewelry, a cozy throw or robe, a beauty or spa set, a candle, a handbag or accessory, a nice journal, a photo gift; no food and no religious items", exclude: NICHE_NOVELTY }),
  P("10-best-christmas-gifts-for-dad", "10 best Christmas gifts for dad", "my dad", "Christmas", 200, { topic: "Family & interests", count: 10,
    slots: ["wireless earbuds", "smart meat thermometer", "leather wallet", "cordless drill set", "whiskey glasses set", "massage gun", "quarter zip pullover", "fitness tracker watch", "portable bluetooth speaker", "leather weekender bag"],
    notes: "ten different kinds of gifts a dad will actually use" }),
  P("10-best-christmas-gifts-for-mom", "10 best Christmas gifts for mom", "my mom", "Christmas", 150, { topic: "Family & interests", count: 10,
    slots: ["cashmere scarf", "digital photo frame", "spa gift set", "jewelry box", "heated throw blanket", "luxury candle", "temperature control smart mug", "silk pillowcase", "personalized necklace", "cozy slippers"],
    notes: "ten different kinds of gifts a mom will love" }),
  P("secret-santa-gifts-under-15", "Secret Santa gifts under $15", "a coworker or friend", "Secret Santa", 15, { topic: "Holidays", cap: 2,
    notes: "crowd-pleasing small gifts under $15: a nice mug, cozy socks, a candle, a desk gadget, a card or party game, a snack-free treat like hand cream" }),
  P("stocking-stuffers-for-adults", "Stocking stuffers for adults", "an adult", "Christmas stocking", 30, { topic: "Family & interests" }),
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
export function allowed(p, c) {
  const t = String((c && c.title) || "").toLowerCase();
  if ((p.exclude || []).some(w => t.includes(String(w).toLowerCase()))) return false;
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
export const shell = (title, meta, canonical, body, jsonld = [], ad = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${ADS_CLIENT ? `<meta name="google-adsense-account" content="${ADS_CLIENT}">` : ""}<title>${esc(title)}</title>
<meta name="description" content="${esc(meta)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(meta)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website">
<link rel="stylesheet" href="/style.css"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("")}
<style>.wrap{max-width:1180px}.grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}.guide p{max-width:760px}.crumbs{font-size:.85rem;margin-bottom:6px}
.gift .why{font-style:italic;color:#374151}.cta{background:var(--accent);color:#fff;border-radius:14px;padding:18px;margin:22px 0}.cta a{color:#fff;font-weight:700}
.rel{display:flex;flex-wrap:wrap;gap:8px}.rel a{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:.88rem;text-decoration:none;color:var(--ink)}</style>
</head><body><div class="wrap">${body}
${ad}
<footer><a href="/">gift.directory</a> · <a href="/gifts">All gift guides</a> · <a href="https://gift.directory/about">About</a> · <a href="https://gift.directory/contact">Contact</a> · <a href="https://gift.directory/privacy">Privacy</a> · <a href="https://gift.directory/terms">Terms</a><br>Prices and stock come live from retailers through Channel3 and may change; links go to the retailer. We may earn a commission when you buy through these links.</footer></div></body></html>`;

export function renderGuide(p, row, related, storeUrl, ad = "", teams = "") {
  const g = JSON.parse(row.guide_json), cards = JSON.parse(row.cards_json || "[]");
  const url = `${ROOT}/gifts/${p.slug}`, updated = String(row.updated_at).slice(0, 10);
  const title = `${p.keyword} (${new Date(row.updated_at).getUTCFullYear()}) — real gifts in stock | gift.directory`;
  const body = `<div class="crumbs"><a href="/">gift.directory</a> › <a href="/gifts">Gift guides</a> › ${esc(p.topic)}</div>
<h1 style="font-family:Georgia,serif;margin:4px 0 6px">${esc(p.keyword)}</h1>
<p class="muted" style="margin:0 0 12px">Updated ${esc(updated)} · ${cards.length} gifts in stock now</p>
<section class="guide">${g.intro.map(x => `<p>${esc(x)}</p>`).join("")}</section>
${p.anniversary ? `<p class="muted" style="font-size:1.02rem"><b>Traditional gift:</b> ${esc(p.anniversary.traditional.replace(/\s*\(ivory-colored, never real ivory\)/, " (ivory-colored)"))} · <b>Modern gift:</b> ${esc(p.anniversary.modern)}</p>` : ""}
${cards.length ? (cards.some(c => c.group)
  ? groupCards(cards).map(([label, cs]) => `<h2 style="font-family:Georgia,serif">${esc(label)}</h2><div class="grid">${cs.map(card).join("")}</div>`).join("")
  : `<h2 style="font-family:Georgia,serif">Our picks</h2><div class="grid">${cards.map(card).join("")}</div>`) : ""}
<div class="cta"><b style="font-size:1.1rem">Going in together?</b><br>${storeUrl
    ? `Find more and start a group gift at <a href="${esc(storeUrl)}">${esc(storeUrl.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a> — everyone chips in with PayPal, straight to the organizer.`
    : `Every store on <a href="/">gift.directory</a> lets a group chip in with PayPal, straight to the organizer. <a href="/">Start your own gift store →</a>`}</div>
${teams}
${g.faq.length ? `<h2 style="font-family:Georgia,serif">Questions people ask</h2>${g.faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}` : ""}
<h2 style="font-family:Georgia,serif">More gift guides</h2><nav class="rel">${related.map(r => `<a href="/gifts/${r.slug}">${esc(r.keyword)}</a>`).join("")}</nav>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "ItemList", name: p.keyword, url, itemListElement: cards.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: c.url, name: c.title })) },
    ...(g.faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Gift guides", item: `${ROOT}/gifts` }, { "@type": "ListItem", position: 2, name: p.keyword, item: url }] },
  ];
  return shell(title, g.meta, url, body, ld, ad);
}
export function renderHub(built, ad = "") {
  const byTopic = {}; for (const p of PAGES) if (built.has(p.slug)) (byTopic[p.topic] ||= []).push(p);
  const body = `<h1 style="font-family:Georgia,serif">Gift guides</h1><p class="muted">Real, in-stock gifts picked by AI for the people on your list — with live prices, and group gifts paid through PayPal.</p>
${Object.entries(byTopic).map(([t, ps]) => `<h2 style="font-family:Georgia,serif">${esc(t)}</h2><nav class="rel">${ps.map(p => `<a href="/gifts/${p.slug}">${esc(p.keyword)}</a>`).join("")}</nav>`).join("")}`;
  return shell("Gift guides — real gifts in stock, picked by AI | gift.directory", "Christmas and year-round gift guides for lawyers, nurses, coworkers, family and more: real, in-stock gifts with live prices, picked by AI.", `${ROOT}/gifts`, body, [], ad);
}
// Related guides: built pages only, starting with the page's neighbours in its own topic (so links spread
// across a topic instead of every page pointing at its first eight), then other topics.
export function related(p, built = null, n = 8) {
  const ok = x => x.slug !== p.slug && (!built || built.has(x.slug));
  const same = PAGES.filter(x => x.topic === p.topic), i = same.findIndex(x => x.slug === p.slug);
  const ring = i < 0 ? same : [...same.slice(i + 1), ...same.slice(0, i)];
  return [...ring.filter(ok), ...PAGES.filter(x => x.topic !== p.topic && ok(x))].slice(0, n);
}
// Each league's fan pages hang off one sport guide, and that guide lists every team.
const SPORT_HUB = { NFL: "gifts-for-football-fans", College: "gifts-for-football-fans", MLB: "gifts-for-baseball-fans", NHL: "gifts-for-hockey-fans",
  NBA: "gifts-for-basketball-fans", WNBA: "gifts-for-basketball-fans", MLS: "gifts-for-soccer-fans", Clubs: "gifts-for-soccer-fans", National: "gifts-for-soccer-fans" };
export function teamNav(p, built) {
  const nav = ps => `<nav class="rel">${ps.map(x => `<a href="/gifts/${x.slug}">${esc(x.keyword.replace(/^Gifts for /, "").replace(/ fans$/, ""))}</a>`).join("")}</nav>`;
  if (p.team) {
    const hub = pageBySlug(SPORT_HUB[p.team.league]), mates = TEAM_PAGES.filter(x => x.team.league === p.team.league && x.slug !== p.slug && built.has(x.slug));
    return (mates.length ? `<h2 style="font-family:Georgia,serif">More ${esc(/ fans$/.test(p.topic) ? p.topic.replace(/ fans$/, " teams").replace(/^College/, "college") : p.topic.toLowerCase())}</h2>${nav(mates)}` : "") +
      (hub && built.has(hub.slug) ? `<p><a href="/gifts/${hub.slug}">${esc(hub.keyword)} →</a></p>` : "");
  }
  const leagues = Object.keys(SPORT_HUB).filter(lg => SPORT_HUB[lg] === p.slug);
  return leagues.map(lg => { const ts = TEAM_PAGES.filter(x => x.team.league === lg && built.has(x.slug)), t = ts[0] && ts[0].topic;
    return ts.length ? `<h2 style="font-family:Georgia,serif">Shop by team: ${esc(t.replace(/ fans$/, ""))}</h2>${nav(ts)}` : ""; }).join("");
}
export function sitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(String(u.lastmod).slice(0, 10))}</lastmod>` : ""}</url>`).join("\n") + "\n</urlset>\n";
}
