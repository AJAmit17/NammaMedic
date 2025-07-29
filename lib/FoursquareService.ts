// Foursquare Places API Service
// More affordable than Google, good coverage
// Get API key from https://developer.foursquare.com/

interface FoursquarePlace {
    fsq_id: string;
    name: string;
    location: {
        address?: string;
        locality?: string;
        region?: string;
        postcode?: string;
    };
    distance: number;
    categories: Array<{
        id: string;
        name: string;
        icon: {
            prefix: string;
            suffix: string;
        };
    }>;
    geocodes: {
        main: {
            latitude: number;
            longitude: number;
        };
    };
    tel?: string;
    rating?: number;
    hours?: {
        open_now?: boolean;
    };
}

export class FoursquareService {
    private static readonly API_KEY = process.env.EXPO_PUBLIC_FOURSQUARE_API_KEY || 'YOUR_API_KEY_HERE';
    private static readonly BASE_URL = 'https://api.foursquare.com/v3/places';

    static async findNearbyMedicalFacilities(
        latitude: number,
        longitude: number,
        radius: number = 4000
    ) {
        try {
            const categories = [
                '17003', // Pharmacy
                '17001', // Hospital  
                '17002', // Medical Center
                '17004', // Clinic
                '17005', // Dentist
            ];

            const url = `${this.BASE_URL}/search?` +
                `ll=${latitude},${longitude}&` +
                `radius=${radius}&` +
                `categories=${categories.join(',')}&` +
                `limit=50&` +
                `fields=fsq_id,name,location,distance,categories,geocodes,tel,rating,hours`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': this.API_KEY,
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Foursquare API error: ${response.status}`);
            }

            const data = await response.json();
            return this.processData(data.results || []);
        } catch (error) {
            console.error('Foursquare API error:', error);
            throw error;
        }
    }

    private static processData(places: FoursquarePlace[]) {
        return places.map(place => ({
            id: place.fsq_id,
            name: place.name,
            address: this.formatAddress(place.location),
            distance: place.distance / 1000, // Convert meters to km
            category: this.getCategoryFromFoursquare(place.categories),
            rating: place.rating,
            isOpen: place.hours?.open_now,
            phone: place.tel,
            coordinates: {
                latitude: place.geocodes.main.latitude,
                longitude: place.geocodes.main.longitude,
            },
        }))
            .sort((a, b) => a.distance - b.distance);
    }

    private static formatAddress(location: FoursquarePlace['location']): string {
        const parts = [
            location.address,
            location.locality,
            location.region,
            location.postcode
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(', ') : 'Address not available';
    }

    private static getCategoryFromFoursquare(categories: FoursquarePlace['categories']): string {
        if (!categories || categories.length === 0) return 'pharmacy';

        const categoryName = categories[0].name.toLowerCase();
        if (categoryName.includes('pharmacy')) return 'pharmacy';
        if (categoryName.includes('hospital')) return 'hospital';
        if (categoryName.includes('clinic') || categoryName.includes('medical')) return 'clinic';
        return 'pharmacy';
    }
}
