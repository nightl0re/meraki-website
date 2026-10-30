// Built-in places for the Klang Valley launch (Kuala Lumpur, Selangor,
// Putrajaya): neighbourhood names, common spellings and postcodes with an
// approximate centre point. Lookups here need no network, so sign-up, job
// posts and "near me" search keep working even when the OpenStreetMap
// geocoder is slow or blocks requests from cloud servers.
// Precision is neighbourhood level on purpose: Meraki never shows exact
// addresses, only the area and distance.

// `broad`: a whole city; only used when no neighbourhood matches.
type Place = { name: string; city: string; lat: number; lng: number; aliases?: string[]; postcodes?: string[]; broad?: boolean };

const KL = "Kuala Lumpur";

export const PLACES: Place[] = [
  // Kuala Lumpur
  { name: "Bangsar", city: KL, lat: 3.129, lng: 101.672, aliases: ["bangsar baru", "telawi", "lucky garden"], postcodes: ["59000", "59100"] },
  { name: "Bangsar South", city: KL, lat: 3.111, lng: 101.665, aliases: ["kerinchi", "pantai dalam"], postcodes: ["59200"] },
  { name: "Mid Valley", city: KL, lat: 3.118, lng: 101.677, aliases: ["midvalley"] },
  { name: "Mont Kiara", city: KL, lat: 3.171, lng: 101.651, aliases: ["mont' kiara", "montkiara"], postcodes: ["50480"] },
  { name: "Sri Hartamas", city: KL, lat: 3.162, lng: 101.65, aliases: ["hartamas", "desa sri hartamas"] },
  { name: "Damansara Heights", city: KL, lat: 3.152, lng: 101.662, aliases: ["bukit damansara", "bukit damansara heights"], postcodes: ["50490"] },
  { name: "Taman Tun Dr Ismail", city: KL, lat: 3.146, lng: 101.629, aliases: ["ttdi", "taman tun"], postcodes: ["60000"] },
  { name: "Bukit Bintang", city: KL, lat: 3.1466, lng: 101.7101, aliases: ["pudu", "jalan alor"], postcodes: ["55100"] },
  { name: "KLCC", city: KL, lat: 3.1579, lng: 101.7123, aliases: ["kuala lumpur city centre", "jalan ampang"], postcodes: ["50088", "50450"] },
  { name: "Chow Kit", city: KL, lat: 3.165, lng: 101.698, postcodes: ["50350"] },
  { name: "Kampung Baru", city: KL, lat: 3.164, lng: 101.705, aliases: ["kampung bharu", "kg baru"], postcodes: ["50300"] },
  { name: "Brickfields", city: KL, lat: 3.131, lng: 101.686, aliases: ["kl sentral", "little india"], postcodes: ["50470"] },
  { name: "Titiwangsa", city: KL, lat: 3.178, lng: 101.703, postcodes: ["53200"] },
  { name: "Setapak", city: KL, lat: 3.2, lng: 101.717, aliases: ["danau kota", "wangsa maju"], postcodes: ["53300"] },
  { name: "Keramat", city: KL, lat: 3.166, lng: 101.73, aliases: ["ampang hilir"], postcodes: ["54200"] },
  { name: "Cheras", city: KL, lat: 3.106, lng: 101.727, aliases: ["taman connaught", "bandar tun razak", "taman midah"], postcodes: ["56000", "56100"] },
  { name: "Sri Petaling", city: KL, lat: 3.069, lng: 101.688, aliases: ["bukit jalil", "kuchai lama", "desa petaling"], postcodes: ["57000", "57100", "58200"] },
  { name: "Old Klang Road", city: KL, lat: 3.095, lng: 101.673, aliases: ["jalan klang lama", "taman desa", "seputeh"], postcodes: ["58000", "58100"] },
  { name: "Segambut", city: KL, lat: 3.187, lng: 101.675, postcodes: ["51200"] },
  { name: "Sentul", city: KL, lat: 3.185, lng: 101.692, postcodes: ["51000", "51100"] },
  { name: "Kepong", city: KL, lat: 3.213, lng: 101.636, aliases: ["menjalara", "desa parkcity", "desa park city"], postcodes: ["52100", "52000", "52200"] },
  { name: "Kuala Lumpur", city: KL, lat: 3.139, lng: 101.6869, broad: true, aliases: ["kl", "kl city", "city centre"], postcodes: ["50000", "50050", "50100", "50200", "50250", "50400"] },
  // Selangor
  { name: "Ampang", city: "Selangor", lat: 3.15, lng: 101.76, aliases: ["ampang jaya", "pandan indah", "pandan jaya"], postcodes: ["68000"] },
  { name: "Petaling Jaya", city: "Selangor", lat: 3.1073, lng: 101.6067, aliases: ["pj", "ss2", "section 17", "seksyen 17", "taman paramount", "jaya one"], postcodes: ["46000", "46050", "46100", "46150", "46200", "46300", "46350", "46400", "47300"] },
  { name: "Damansara Utama", city: "Selangor", lat: 3.136, lng: 101.623, aliases: ["uptown", "damansara uptown", "ss21", "damansara jaya"], postcodes: ["47400"] },
  { name: "Bandar Utama", city: "Selangor", lat: 3.144, lng: 101.615, aliases: ["one utama", "1 utama"] },
  { name: "Mutiara Damansara", city: "Selangor", lat: 3.155, lng: 101.611, aliases: ["the curve", "ikea damansara"], postcodes: ["47800"] },
  { name: "Kota Damansara", city: "Selangor", lat: 3.16, lng: 101.59, postcodes: ["47810"] },
  { name: "Damansara", city: "Selangor", lat: 3.15, lng: 101.62, broad: true, aliases: ["damansara perdana"] },
  { name: "Ara Damansara", city: "Selangor", lat: 3.12, lng: 101.585, aliases: ["kelana jaya", "subang airport"], postcodes: ["47301"] },
  { name: "Subang Jaya", city: "Selangor", lat: 3.0567, lng: 101.5851, aliases: ["ss15", "ss14", "ss19"], postcodes: ["47500"] },
  { name: "USJ", city: "Selangor", lat: 3.04, lng: 101.58, aliases: ["usj taipan", "subang usj"], postcodes: ["47600", "47610", "47620", "47630", "47640", "47650"] },
  { name: "Sunway", city: "Selangor", lat: 3.068, lng: 101.605, aliases: ["bandar sunway", "sunway pyramid"] },
  { name: "Puchong", city: "Selangor", lat: 3.033, lng: 101.617, aliases: ["bandar puteri puchong", "puchong jaya"], postcodes: ["47100", "47110", "47120", "47130", "47140", "47150", "47160", "47170", "47180", "47190"] },
  { name: "Shah Alam", city: "Selangor", lat: 3.0733, lng: 101.5185, aliases: ["setia alam", "kota kemuning", "bukit jelutong"], postcodes: ["40000", "40100", "40150", "40160", "40170", "40200", "40300", "40400", "40450", "40460", "40470"] },
  { name: "Klang", city: "Selangor", lat: 3.0449, lng: 101.4456, aliases: ["bukit tinggi klang", "bandar botanic"], postcodes: ["41000", "41050", "41100", "41150", "41200", "41300", "42000"] },
  { name: "Seri Kembangan", city: "Selangor", lat: 3.022, lng: 101.709, aliases: ["serdang", "the mines"], postcodes: ["43300"] },
  { name: "Kajang", city: "Selangor", lat: 2.993, lng: 101.788, aliases: ["sungai long", "balakong"], postcodes: ["43000", "43200"] },
  { name: "Bangi", city: "Selangor", lat: 2.965, lng: 101.777, aliases: ["bandar baru bangi"], postcodes: ["43650"] },
  { name: "Cyberjaya", city: "Selangor", lat: 2.9213, lng: 101.6559, postcodes: ["63000"] },
  { name: "Putrajaya", city: "Putrajaya", lat: 2.9264, lng: 101.6964, postcodes: ["62000", "62100", "62150", "62200", "62250", "62300"] },
  { name: "Selayang", city: "Selangor", lat: 3.25, lng: 101.65, aliases: ["batu caves", "gombak"], postcodes: ["68100", "53100"] },
  { name: "Rawang", city: "Selangor", lat: 3.32, lng: 101.58, postcodes: ["48000"] },
  { name: "Sungai Buloh", city: "Selangor", lat: 3.2, lng: 101.58, aliases: ["kota damansara sg buloh"], postcodes: ["47000"] },
];

const normalise = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const containsWord = (haystack: string, needle: string) => ` ${haystack} `.includes(` ${needle} `);

// Postcode first areas: rough fallback by the first two digits.
const PREFIX: Record<string, string> = {
  "50": "Kuala Lumpur", "51": "Sentul", "52": "Kepong", "53": "Setapak", "54": "Keramat", "55": "Bukit Bintang",
  "56": "Cheras", "57": "Sri Petaling", "58": "Old Klang Road", "59": "Bangsar", "60": "Taman Tun Dr Ismail",
  "40": "Shah Alam", "41": "Klang", "42": "Klang", "43": "Kajang", "46": "Petaling Jaya", "47": "Petaling Jaya",
  "48": "Rawang", "62": "Putrajaya", "63": "Cyberjaya", "68": "Ampang",
};

export function lookupMalaysianPlace(query: string): { lat: number; lng: number; label: string } | null {
  const q = normalise(query);
  if (!q) return null;
  const hit = (p: Place) => ({ lat: p.lat, lng: p.lng, label: `${p.name}, ${p.city}` });

  // 1. A 5-digit postcode anywhere in the text.
  const postcode = q.match(/\b(\d{5})\b/)?.[1];
  if (postcode) {
    const exact = PLACES.find((p) => p.postcodes?.includes(postcode));
    if (exact) return hit(exact);
    const byPrefix = PREFIX[postcode.slice(0, 2)];
    if (byPrefix) return hit(PLACES.find((p) => p.name === byPrefix)!);
  }

  // 2. A neighbourhood name or alias in the text. Neighbourhoods beat whole
  //    cities ("Bangsar, Kuala Lumpur" -> Bangsar), and the longest match wins
  //    ("Bangsar South" beats "Bangsar", "Damansara Heights" beats "Damansara").
  let best: { place: Place; score: number } | null = null;
  for (const p of PLACES) {
    for (const name of [p.name, ...(p.aliases ?? [])]) {
      const n = normalise(name);
      const score = (p.broad ? 0 : 1000) + n.length;
      if (n && containsWord(q, n) && (!best || score > best.score)) best = { place: p, score };
    }
  }
  return best ? hit(best.place) : null;
}
