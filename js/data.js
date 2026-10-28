// Static reference data: spending categories, a merchant directory, and
// OpenStreetMap tag -> category mapping.

export const CATEGORIES = [
  { id: 'dining', label: 'Dining', icon: '🍽️' },
  { id: 'groceries', label: 'Groceries', icon: '🛒', hint: 'Supermarkets. Walmart, Target and Costco usually do not count.' },
  { id: 'gas', label: 'Gas', icon: '⛽' },
  { id: 'drugstore', label: 'Drugstore', icon: '💊' },
  { id: 'amazon', label: 'Amazon', icon: '📦' },
  { id: 'target', label: 'Target', icon: '🎯' },
  { id: 'walmart', label: 'Walmart', icon: '🏬' },
  { id: 'wholesale', label: 'Costco / wholesale', icon: '🧺' },
  { id: 'online', label: 'Online shopping', icon: '🛍️' },
  { id: 'home_improvement', label: 'Home improvement', icon: '🔨' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎟️', hint: 'Movies, concerts, sports, theme parks, zoos, bowling.' },
  { id: 'streaming', label: 'Streaming', icon: '📺' },
  { id: 'utilities', label: 'Utilities & phone', icon: '💡', hint: 'Electric, water, gas utility, internet, phone.' },
  { id: 'airfare', label: 'Flights', icon: '✈️' },
  { id: 'hotels', label: 'Hotels', icon: '🏨' },
  { id: 'car_rental', label: 'Car rental', icon: '🚙' },
  { id: 'transit', label: 'Transit & parking', icon: '🚇' },
  { id: 'rideshare', label: 'Rideshare', icon: '🚕' },
  { id: 'travel_other', label: 'Other travel', icon: '🧳' },
  { id: 'department', label: 'Department store', icon: '👗' },
  { id: 'electronics', label: 'Electronics', icon: '💻' },
  { id: 'gm', label: 'GM dealer / service', icon: '🔧' },
  { id: 'auto_service', label: 'Auto service', icon: '🛠️' },
  { id: 'ev_charging', label: 'EV charging', icon: '🔌' },
  { id: 'fitness', label: 'Fitness', icon: '🏋️' },
  { id: 'charity', label: 'Charity', icon: '❤️' },
  { id: 'paypal', label: 'PayPal', icon: '🅿️' },
  { id: 'other', label: 'Everything else', icon: '💳' },
  // Merchant-specific categories that only a few cards reward. Hidden from tiles.
  { id: 'costco', label: 'Costco (store)', icon: '🧺', hidden: true },
  { id: 'whole_foods', label: 'Whole Foods', icon: '🥦', hidden: true },
  { id: 'rent', label: 'Rent / mortgage', icon: '🏠', hidden: true },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// Category aliases usable in data/cards.json.
export const CATEGORY_ALIASES = {
  '@travel': ['airfare', 'hotels', 'car_rental', 'transit', 'rideshare', 'travel_other'],
};

// Card presets and point currencies live in data/cards.json so they can be
// updated without touching the app code. See js/catalog.js and UPDATING.md.

// Merchant directory. `match` is tested against the store name / brand from
// OpenStreetMap and against what you type into search.
// `networks` limits which card networks the store takes (Costco in-store = Visa).
const MERCHANT_LIST = [
  { name: 'Amazon', match: /\bamazon\b/i, cats: ['amazon', 'online'] },
  { name: 'Whole Foods', match: /whole\s*foods/i, cats: ['groceries', 'whole_foods'] },
  { name: 'Target', match: /^target\b|\btarget\s+(store|super)/i, cats: ['target'] },
  { name: 'Walmart', match: /wal-?mart/i, cats: ['walmart'] },
  { name: 'Costco Gas', match: /costco\s*gas/i, cats: ['gas', 'costco'], networks: ['visa'] },
  { name: 'Costco', match: /costco/i, cats: ['wholesale', 'costco'], networks: ['visa'] },
  { name: "Sam's Club", match: /sam'?s\s*club/i, cats: ['wholesale'] },
  { name: "BJ's Wholesale", match: /\bbj'?s\b/i, cats: ['wholesale'] },
  { name: 'The Home Depot', match: /home\s*depot/i, cats: ['home_improvement'] },
  { name: "Lowe's", match: /\blowe'?s\b/i, cats: ['home_improvement'] },
  { name: 'Menards', match: /menards/i, cats: ['home_improvement'] },
  { name: 'CVS', match: /\bcvs\b/i, cats: ['drugstore'] },
  { name: 'Walgreens', match: /walgreens/i, cats: ['drugstore'] },
  { name: 'Rite Aid', match: /rite\s*aid/i, cats: ['drugstore'] },
  ...[
    'Kroger', 'Safeway', 'Publix', 'Albertsons', 'H-E-B', 'Wegmans', "Trader Joe's", 'Aldi', 'Food Lion',
    'Stop & Shop', 'Giant', 'Sprouts', 'Harris Teeter', 'Hy-Vee', 'ShopRite', 'Meijer', 'Vons', 'Ralphs',
    'Fred Meyer', 'King Soopers', 'Smith\'s', 'Jewel-Osco', 'Hannaford', 'Winn-Dixie', 'Lidl', 'Market Basket',
    'Giant Eagle', 'Weis', 'Fry\'s', 'Food 4 Less', 'WinCo',
  ].map((n) => ({ name: n, match: new RegExp(`^${escapeRe(n)}\\b`, 'i'), cats: ['groceries'] })),
  ...[
    'Shell', 'Exxon', 'Mobil', 'Chevron', 'BP', 'Sunoco', 'Speedway', 'Wawa', 'Sheetz', 'QuikTrip', 'Circle K',
    'Marathon', 'Valero', 'Citgo', 'Phillips 66', "Casey's", 'Texaco', 'Arco', '76', 'Kwik Trip', 'Racetrac', 'Love\'s', 'Pilot',
  ].map((n) => ({ name: n, match: new RegExp(`^${escapeRe(n)}\\b`, 'i'), cats: ['gas'] })),
  ...[
    'Starbucks', "McDonald's", 'Chipotle', "Dunkin'", 'Chick-fil-A', 'Subway', 'Panera', 'Taco Bell', "Wendy's",
    'Burger King', "Domino's", 'Pizza Hut', 'Olive Garden', "Applebee's", 'Panda Express', 'Five Guys', 'Sonic',
  ].map((n) => ({ name: n, match: new RegExp(`^${escapeRe(n).replace("'", "'?")}`, 'i'), cats: ['dining'] })),
  { name: 'Uber Eats', match: /uber\s*eats/i, cats: ['dining'] },
  { name: 'DoorDash', match: /door\s*dash/i, cats: ['dining'] },
  { name: 'Uber', match: /^uber$/i, cats: ['rideshare'] },
  { name: 'Lyft', match: /^lyft/i, cats: ['rideshare'] },
  { name: 'AMC Theatres', match: /^amc\b/i, cats: ['entertainment'] },
  { name: 'Regal', match: /^regal\b/i, cats: ['entertainment'] },
  { name: 'Cinemark', match: /cinemark/i, cats: ['entertainment'] },
  { name: 'Chevrolet dealer', match: /chevrolet|chevy/i, cats: ['gm', 'auto_service'] },
  { name: 'GMC dealer', match: /\bgmc\b/i, cats: ['gm', 'auto_service'] },
  { name: 'Buick dealer', match: /buick/i, cats: ['gm', 'auto_service'] },
  { name: 'Cadillac dealer', match: /cadillac/i, cats: ['gm', 'auto_service'] },
  { name: "Macy's", match: /^macy'?s/i, cats: ['department'] },
  { name: "Kohl's", match: /^kohl'?s/i, cats: ['department'] },
  { name: 'Nordstrom', match: /nordstrom/i, cats: ['department'] },
  { name: 'JCPenney', match: /jc\s*penney/i, cats: ['department'] },
  { name: 'Netflix', match: /netflix/i, cats: ['streaming'] },
  { name: 'Spotify', match: /spotify/i, cats: ['streaming'] },
  { name: 'Hulu', match: /hulu/i, cats: ['streaming'] },
  { name: 'Disney+', match: /disney\s*\+|disney plus/i, cats: ['streaming'] },
  { name: 'YouTube TV / Premium', match: /youtube/i, cats: ['streaming'] },
  { name: 'PayPal', match: /paypal/i, cats: ['paypal'] },
  { name: 'Comcast / Xfinity', match: /comcast|xfinity/i, cats: ['utilities'] },
  { name: 'Verizon', match: /verizon/i, cats: ['utilities'] },
  { name: 'AT&T', match: /at\s*&\s*t|\batt\b/i, cats: ['utilities'] },
  { name: 'T-Mobile', match: /t-?mobile/i, cats: ['utilities'] },
  { name: 'Delta', match: /^delta\b/i, cats: ['airfare'] },
  { name: 'United Airlines', match: /united\s*airlines/i, cats: ['airfare'] },
  { name: 'American Airlines', match: /american\s*airlines/i, cats: ['airfare'] },
  { name: 'Southwest', match: /southwest/i, cats: ['airfare'] },
  { name: 'Marriott', match: /marriott|courtyard|residence inn|fairfield (inn|by)|springhill|towneplace|sheraton|westin|\bw hotel|ritz-carlton|st\.? regis|aloft|four points|le m[eé]ridien|renaissance|moxy|\bac hotel|delta hotels|gaylord/i, cats: ['hotels'] },
  { name: 'Hilton', match: /hilton|hampton inn|doubletree|embassy suites|homewood suites|home2 suites|tru by|waldorf|conrad|curio|canopy by|tapestry|motto by|spark by|lxr/i, cats: ['hotels'] },
  { name: 'Hyatt', match: /hyatt|andaz|thompson hotel|alila|caption by|the standard/i, cats: ['hotels'] },
  { name: 'Planet Fitness', match: /planet\s*fitness/i, cats: ['fitness'] },
  { name: 'Red Cross', match: /red\s*cross/i, cats: ['charity'] }, // id: red_cross (Chase Freedom Q4 2026)
  { name: 'Instacart', match: /instacart/i, cats: ['groceries', 'online'] },
  { name: 'Grubhub', match: /grubhub/i, cats: ['dining'] },
  { name: 'Peloton', match: /peloton/i, cats: ['fitness'] },
  { name: 'IHG', match: /\bihg\b|holiday inn|crowne plaza|intercontinental/i, cats: ['hotels'] },
  { name: 'JetBlue', match: /jet\s*blue/i, cats: ['airfare'] },
  { name: 'Alaska Airlines', match: /alaska\s*air/i, cats: ['airfare'] },
  { name: 'Best Buy', match: /best\s*buy/i, cats: ['electronics'] },
  { name: 'Apple Store', match: /^apple(\s*store)?$/i, cats: ['electronics'] },
  { name: 'TJ Maxx / Marshalls / HomeGoods', match: /t\.?j\.?\s*maxx|marshalls|homegoods|sierra trading/i, cats: ['department'] },
  { name: 'Disney Parks & Stores', match: /walt disney world|disneyland|disney store|disney springs/i, cats: ['entertainment'] },
  { name: 'Air Canada', match: /air\s*canada/i, cats: ['airfare'] },
  { name: 'British Airways', match: /british\s*airways|aer lingus|iberia/i, cats: ['airfare'] },
  { name: 'Hawaiian Airlines', match: /hawaiian\s*air/i, cats: ['airfare'] },
  { name: 'Wyndham', match: /wyndham|days inn|super 8|la quinta|ramada|microtel|baymont|howard johnson/i, cats: ['hotels'] },
  { name: 'Rent via Bilt', match: /^rent$|^bilt\b|rent payment|mortgage payment/i, cats: ['rent'] },
  { name: 'Chase Travel portal', match: /chase\s*travel/i, cats: ['travel_other', 'hotels', 'airfare', 'car_rental'] },
  { name: 'Capital One Travel portal', match: /capital\s*one\s*travel/i, cats: ['travel_other', 'hotels', 'airfare', 'car_rental'] },
  { name: 'Amex Travel portal', match: /amex\s*travel|american\s*express\s*travel/i, cats: ['travel_other', 'hotels', 'airfare'] },
];

export const merchantId = (name) => name.toLowerCase().replace(/'/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Every merchant also gets its own hidden category "m:<id>" so cards can give
// a bonus at one specific store (e.g. Sapphire Preferred 5x at Lyft).
export const MERCHANTS = MERCHANT_LIST.map((m) => {
  const id = merchantId(m.name);
  return { ...m, id, cats: [...m.cats, `m:${id}`] };
});
export const MERCHANT_BY_ID = Object.fromEntries(MERCHANTS.map((m) => [m.id, m]));

export function isCategory(id) {
  return !!CATEGORY_BY_ID[id] || (id.startsWith('m:') && !!MERCHANT_BY_ID[id.slice(2)]);
}

export function categoryLabel(id) {
  if (id.startsWith('m:')) return MERCHANT_BY_ID[id.slice(2)]?.name ?? id.slice(2);
  return CATEGORY_BY_ID[id]?.label ?? id;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// OpenStreetMap tag -> categories, used when the store isn't in MERCHANTS.
export const OSM_TAG_CATEGORIES = [
  ['amenity', /^(restaurant|fast_food|cafe|bar|pub|food_court|ice_cream|biergarten)$/, ['dining']],
  ['amenity', /^fuel$/, ['gas']],
  ['amenity', /^charging_station$/, ['ev_charging']],
  ['amenity', /^pharmacy$/, ['drugstore']],
  ['amenity', /^(cinema|theatre|arts_centre|nightclub)$/, ['entertainment']],
  ['amenity', /^car_rental$/, ['car_rental']],
  ['amenity', /^(parking|bus_station|ferry_terminal)$/, ['transit']],
  ['amenity', /^taxi$/, ['rideshare']],
  ['shop', /^(supermarket|grocery|greengrocer|butcher|deli|seafood|health_food|frozen_food)$/, ['groceries']],
  ['shop', /^(bakery|pastry|coffee)$/, ['dining']],
  ['shop', /^chemist$/, ['drugstore']],
  ['shop', /^department_store$/, ['department']],
  ['shop', /^(doityourself|hardware|trade|garden_centre)$/, ['home_improvement']],
  ['shop', /^wholesale$/, ['wholesale']],
  ['shop', /^(car_repair|tyres|car_parts)$/, ['auto_service']],
  ['shop', /^car$/, ['auto_service']],
  ['shop', /^(mobile_phone|telecommunication)$/, ['utilities']],
  ['shop', /^(electronics|computer|hifi|video_games)$/, ['electronics']],
  ['leisure', /^(fitness_centre|sports_centre)$/, ['fitness']],
  ['leisure', /^(bowling_alley|amusement_arcade|water_park|stadium|miniature_golf|escape_game)$/, ['entertainment']],
  ['tourism', /^(zoo|aquarium|theme_park|museum)$/, ['entertainment']],
  ['tourism', /^(hotel|motel|hostel|guest_house)$/, ['hotels']],
  ['aeroway', /^(aerodrome|terminal)$/, ['airfare']],
  ['railway', /^station$/, ['transit']],
  ['public_transport', /^station$/, ['transit']],
];
