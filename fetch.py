import urllib.request
import json

overpass_url = 'http://overpass-api.de/api/interpreter'
overpass_query = '''
[out:json];
(
  node["amenity"~"restaurant|cafe|fast_food"](around:2500,18.586,73.742);
  node["leisure"~"fitness_centre|swimming_pool"](around:2500,18.586,73.742);
  node["amenity"="gym"](around:2500,18.586,73.742);
  node["name"~"(?i)PG|Hostel|Paying Guest|Living|Apartment|Flat"](around:2500,18.586,73.742);
);
out center 100;
'''

req = urllib.request.Request(overpass_url, data=overpass_query.encode('utf-8'))
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read())
        results = []
        for el in data['elements']:
            tags = el.get('tags', {})
            name = tags.get('name')
            if not name: continue
            
            lat, lon = el.get('lat'), el.get('lon')
            if not lat and 'center' in el:
                lat, lon = el['center']['lat'], el['center']['lon']
                
            amenity = tags.get('amenity')
            leisure = tags.get('leisure')
            building = tags.get('building')
            
            type_str = amenity or leisure or building or 'PG'
            results.append({
                'name': name,
                'type': type_str,
                'lat': lat,
                'lng': lon
            })
        print(json.dumps(results, indent=2))
except Exception as e:
    print('Error:', e)
