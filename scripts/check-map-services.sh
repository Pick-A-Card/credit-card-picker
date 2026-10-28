#!/usr/bin/env bash
# Sends the app's real store-lookup request to each map service, the way Chrome
# on Android at pick-a-card.github.io would, and reports what comes back.
# Run by .github/workflows/check-maps.yml (Actions tab → Check map services).
LAT=${LAT:-40.7505}; LON=${LON:--73.9934}
ORIGIN=${ORIGIN:-https://pick-a-card.github.io}
QUERY=$(node --input-type=module -e "import('./js/location.js').then(m => process.stdout.write(m.overpassQuery($LAT, $LON, 120)))")
CHROME='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'

probe() { # label url curl-args...
  local label=$1 url=$2; shift 2
  printf '%-28s ' "$label"
  curl -sS -m 25 -o /tmp/body -D /tmp/headers -w 'status=%{http_code} time=%{time_total}s ' "$@" "$url" 2>&1 | tr '\n' ' '
  if grep -qi '^access-control-allow-origin' /tmp/headers; then printf 'CORS=yes '; else printf 'CORS=NO '; fi
  printf 'body: %s\n' "$(head -c 120 /tmp/body | tr '\n' ' ')"
}

# Only services the app uses (US/EU operators).
for url in https://overpass-api.de/api/interpreter; do
  echo "=== $url"
  probe 'POST, curl defaults' "$url" -H "Origin: $ORIGIN" --data-urlencode "data=$QUERY"
  probe 'POST, like Chrome Android' "$url" -A "$CHROME" -H "Origin: $ORIGIN" -H "Referer: $ORIGIN/" -H 'Accept: */*' \
    -H 'Sec-Fetch-Mode: cors' -H 'Sec-Fetch-Site: cross-site' -H 'Sec-Fetch-Dest: empty' --data-urlencode "data=$QUERY"
  probe 'GET, like Chrome Android' "$url?data=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$QUERY")" \
    -A "$CHROME" -H "Origin: $ORIGIN" -H "Referer: $ORIGIN/" -H 'Accept: */*' -H 'Sec-Fetch-Mode: cors'
done

echo "=== Nominatim reverse"
probe 'GET, like Chrome Android' "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=$LAT&lon=$LON&zoom=18&extratags=1" \
  -A "$CHROME" -H "Origin: $ORIGIN" -H "Referer: $ORIGIN/"

echo "=== Photon (komoot) reverse: nearby places"
probe 'all nearby' "https://photon.komoot.io/reverse?lat=$LAT&lon=$LON&limit=15&radius=0.15" -A "$CHROME" -H "Origin: $ORIGIN"
probe 'shops+amenities' "https://photon.komoot.io/reverse?lat=$LAT&lon=$LON&limit=15&radius=0.15&osm_tag=shop&osm_tag=amenity" -A "$CHROME" -H "Origin: $ORIGIN"
node -e '
  const b = require("fs").readFileSync("/tmp/body", "utf8");
  try { const j = JSON.parse(b); for (const f of j.features || []) console.log("   ", f.properties.osm_key + "=" + f.properties.osm_value, "|", f.properties.name || "(no name)"); }
  catch (e) { console.log("   not JSON"); }'
