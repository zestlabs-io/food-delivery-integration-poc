import { GeoCoordinates } from "./FoodDeliveryZESTAPI";

import got from 'got';

const baseURL = `https://us1.locationiq.com/v1/search.php`
export class LocationIQAPI {

  private _key: string


  constructor(key: string) {
    this._key = key;
  }

  getCoordinates = async (address: string): Promise<LocationIQCoordinates[]> => {
    const reqObject = {
      key: this._key,
      format: 'json',
      q: address
    };

    try {
      const resp = await got.get(baseURL, { searchParams: reqObject });
      return JSON.parse(resp.body) as LocationIQCoordinates[];
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}

// [    
//   {        
//     "place_id": "42176382",        
//     "licence": "https://locationiq.com/attribution",        
//     "osm_type": "node",        
//     "osm_id": "3176611873",        
//     "boundingbox": [            
//       "42.6578469",            
//       "42.6978469",            
//       "23.2422161",            
//       "23.2822161"        
//     ],        
//     "lat": "42.6778469",        
//     "lon": "23.2622161",        
//     "display_name": "kv. Ovcha kupel, Ovcha kupel, Sofia City, Sofia-City, 1618, Bulgaria",        
//     "class": "place",        
//     "type": "suburb",        
//     "importance": 0.432075306013723,        
//     "icon": "https://locationiq.org/static/images/mapicons/poi_place_village.p.20.png"    
//   }
// ]
export interface LocationIQCoordinates {
  lat: string,
  lon: string,
  boundingbox: string[],
  display_name: string,
  place_id: string
}