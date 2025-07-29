// Improved OpenStreetMap Service
// Completely FREE - uses multiple OSM endpoints for better reliability

interface OSMElement {
    type: string;
    id: number;
    lat: number;
    lon: number;
    tags: {
        name?: string;
        amenity?: string;
        healthcare?: string;
        phone?: string;
        'contact:phone'?: string;
        'addr:street'?: string;
        'addr:housenumber'?: string;
        'addr:city'?: string;
        'addr:postcode'?: string;
        opening_hours?: string;
        website?: string;
    };
}

interface NominatimPlace {
    place_id: number;
    licence: string;
    osm_type: string;
    osm_id: number;
    lat: string;
    lon: string;
    display_name: string;
    address?: {
        amenity?: string;
        house_number?: string;
        road?: string;
        suburb?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
    };
    extratags?: {
        phone?: string;
        website?: string;
        opening_hours?: string;
    };
}

export class ImprovedOSMService {
    // Multiple Overpass API endpoints for better reliability
    private static readonly OVERPASS_ENDPOINTS = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.openstreetmap.ru/api/interpreter',
    ];

    // Nominatim endpoints for geocoding
    private static readonly NOMINATIM_ENDPOINTS = [
        'https://nominatim.openstreetmap.org/search',
        'https://nominatim.openstreetmap.org/reverse',
    ];

    static async findNearbyMedicalFacilities(
        latitude: number,
        longitude: number,
        radius: number = 4000
    ) {
        try {
            console.log('🔍 Starting improved OSM search...');

            // Try multiple approaches
            const results = await Promise.allSettled([
                this.searchWithOverpass(latitude, longitude, radius),
                this.searchWithNominatim(latitude, longitude, radius),
            ]);

            let allFacilities: any[] = [];

            // Combine results from all successful searches
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    console.log(`✅ Search method ${index + 1} returned ${result.value.length} facilities`);
                    allFacilities = allFacilities.concat(result.value);
                } else {
                    console.warn(`❌ Search method ${index + 1} failed:`, result.reason);
                }
            });

            // Remove duplicates and process
            const uniqueFacilities = this.removeDuplicates(allFacilities);
            return this.processAndSort(uniqueFacilities, latitude, longitude);

        } catch (error) {
            console.error('❌ All OSM search methods failed:', error);
            throw error;
        }
    }

    private static async searchWithOverpass(
        latitude: number,
        longitude: number,
        radius: number
    ): Promise<any[]> {
        const query = `
      [out:json][timeout:25];
      (
        node["amenity"="pharmacy"](around:${radius},${latitude},${longitude});
        node["amenity"="hospital"](around:${radius},${latitude},${longitude});
        node["amenity"="clinic"](around:${radius},${latitude},${longitude});
        node["amenity"="doctors"](around:${radius},${latitude},${longitude});
        node["healthcare"="pharmacy"](around:${radius},${latitude},${longitude});
        node["healthcare"="hospital"](around:${radius},${latitude},${longitude});
        node["healthcare"="clinic"](around:${radius},${latitude},${longitude});
        node["healthcare"="centre"](around:${radius},${latitude},${longitude});
        way["amenity"="pharmacy"](around:${radius},${latitude},${longitude});
        way["amenity"="hospital"](around:${radius},${latitude},${longitude});
        way["amenity"="clinic"](around:${radius},${latitude},${longitude});
        way["healthcare"="pharmacy"](around:${radius},${latitude},${longitude});
        way["healthcare"="hospital"](around:${radius},${latitude},${longitude});
        way["healthcare"="clinic"](around:${radius},${latitude},${longitude});
      );
      out center 100;
    `;

        for (const endpoint of this.OVERPASS_ENDPOINTS) {
            try {
                console.log(`🌐 Trying Overpass endpoint: ${endpoint}`);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    },
                    body: `data=${encodeURIComponent(query)}`,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                if (data.elements && data.elements.length > 0) {
                    console.log(`✅ Overpass returned ${data.elements.length} elements`);
                    return this.processOverpassData(data.elements, latitude, longitude);
                }
            } catch (error) {
                console.warn(`❌ Overpass endpoint ${endpoint} failed:`, error);
                continue;
            }
        }

        throw new Error('All Overpass endpoints failed');
    }

    private static async searchWithNominatim(
        latitude: number,
        longitude: number,
        radius: number
    ): Promise<any[]> {
        const searchTerms = ['pharmacy', 'hospital', 'clinic', 'medical center'];
        const radiusKm = radius / 1000;

        // Create bounding box
        const latOffset = radiusKm / 111.32;
        const lonOffset = radiusKm / (111.32 * Math.cos(latitude * Math.PI / 180));

        const bbox = [
            longitude - lonOffset, // min lon
            latitude - latOffset,  // min lat
            longitude + lonOffset, // max lon
            latitude + latOffset   // max lat
        ].join(',');

        let allResults: any[] = [];

        for (const term of searchTerms) {
            try {
                const url = `${this.NOMINATIM_ENDPOINTS[0]}?` +
                    `q=${encodeURIComponent(term)}&` +
                    `format=json&` +
                    `viewbox=${bbox}&` +
                    `bounded=1&` +
                    `limit=20&` +
                    `addressdetails=1&` +
                    `extratags=1`;

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'NammaMedic-App/1.0',
                    },
                });

                if (!response.ok) continue;

                const data: NominatimPlace[] = await response.json();

                if (data && data.length > 0) {
                    console.log(`✅ Nominatim found ${data.length} results for "${term}"`);
                    allResults = allResults.concat(this.processNominatimData(data, latitude, longitude));
                }

                // Rate limiting - wait 1 second between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.warn(`❌ Nominatim search for "${term}" failed:`, error);
            }
        }

        return allResults;
    }

    private static processOverpassData(elements: OSMElement[], userLat: number, userLng: number) {
        return elements.map(element => {
            const lat = element.lat || (element as any).center?.lat || userLat;
            const lon = element.lon || (element as any).center?.lon || userLng;

            const distance = this.calculateDistance(userLat, userLng, lat, lon);

            return {
                id: `osm-${element.id}`,
                name: element.tags.name || this.getDefaultName(element.tags.amenity || element.tags.healthcare),
                address: this.formatAddress(element.tags),
                distance,
                category: element.tags.amenity || element.tags.healthcare || 'pharmacy',
                phone: element.tags.phone || element.tags['contact:phone'],
                coordinates: { latitude: lat, longitude: lon },
                rating: this.generateRealisticRating(element.tags.amenity || element.tags.healthcare),
                isOpen: this.isLikelyOpen(element.tags.amenity || element.tags.healthcare),
                source: 'overpass'
            };
        }).filter(facility => facility.distance <= 4);
    }

    private static processNominatimData(places: NominatimPlace[], userLat: number, userLng: number) {
        return places.map(place => {
            const lat = parseFloat(place.lat);
            const lon = parseFloat(place.lon);
            const distance = this.calculateDistance(userLat, userLng, lat, lon);

            return {
                id: `nom-${place.place_id}`,
                name: this.extractNameFromNominatim(place),
                address: place.display_name,
                distance,
                category: this.getCategoryFromNominatim(place),
                phone: place.extratags?.phone,
                coordinates: { latitude: lat, longitude: lon },
                rating: this.generateRealisticRating('pharmacy'),
                isOpen: this.isLikelyOpen('pharmacy'),
                source: 'nominatim'
            };
        }).filter(facility => facility.distance <= 4);
    }

    private static extractNameFromNominatim(place: NominatimPlace): string {
        const displayParts = place.display_name.split(',');
        return displayParts[0].trim() || 'Medical Facility';
    }

    private static getCategoryFromNominatim(place: NominatimPlace): string {
        const displayName = place.display_name.toLowerCase();
        if (displayName.includes('pharmacy')) return 'pharmacy';
        if (displayName.includes('hospital')) return 'hospital';
        if (displayName.includes('clinic') || displayName.includes('medical')) return 'clinic';
        return 'pharmacy';
    }

    private static formatAddress(tags: OSMElement['tags']): string {
        const parts = [
            tags['addr:housenumber'],
            tags['addr:street'],
            tags['addr:city'],
            tags['addr:postcode']
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(', ') : 'Address not available';
    }

    private static removeDuplicates(facilities: any[]): any[] {
        const unique = [];
        const seen = new Set();

        for (const facility of facilities) {
            // Create a unique key based on coordinates and name
            const key = `${Math.round(facility.coordinates.latitude * 1000)}-${Math.round(facility.coordinates.longitude * 1000)}-${facility.name.toLowerCase().trim()}`;

            if (!seen.has(key)) {
                seen.add(key);
                unique.push(facility);
            }
        }

        return unique;
    }

    private static processAndSort(facilities: any[], userLat: number, userLng: number) {
        return facilities
            .filter(f => f.distance <= 4)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 20);
    }

    private static getDefaultName(category?: string): string {
        switch (category) {
            case 'pharmacy': return 'Pharmacy';
            case 'hospital': return 'Hospital';
            case 'clinic': case 'doctors': return 'Medical Clinic';
            default: return 'Medical Facility';
        }
    }

    private static generateRealisticRating(category?: string): number {
        const base = category === 'hospital' ? 3.8 : category === 'pharmacy' ? 4.1 : 3.9;
        return Math.round((base + (Math.random() * 0.6 - 0.3)) * 10) / 10;
    }

    private static isLikelyOpen(category?: string): boolean {
        const now = new Date();
        const hour = now.getHours();

        if (category === 'hospital') return true;
        if (category === 'pharmacy') return hour >= 8 && hour <= 22;
        return hour >= 9 && hour <= 18;
    }

    private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) *
            Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private static deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}
