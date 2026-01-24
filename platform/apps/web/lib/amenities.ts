import {
  Waves,
  Wifi,
  Dumbbell,
  Mountain,
  Footprints,
  Bike,
  Bath,
  Store,
  ShowerHead,
  Shirt,
  Baby,
  Fish,
  Ship,
  Dog,
  Gamepad2,
  Flame,
  Trash2,
  TreeDeciduous,
  Square,
  Leaf,
  type LucideIcon,
  Table2,
  Armchair,
  Sun,
  Cable,
  Wifi as WifiIcon,
  Bed,
  BedDouble,
  Tv,
  UtensilsCrossed,
  Snowflake,
  Heater,
  Sparkles,
  WashingMachine,
  CookingPot,
  Coffee,
  Refrigerator,
  Home,
  DoorOpen,
  Sofa,
  Zap,
  Users,
  Truck,
  PawPrint,
  Tent,
  Package,
  Wind,
  GlassWater,
  Lightbulb,
} from "lucide-react";

export interface AmenityOption {
  id: string;
  label: string;
  icon: LucideIcon;
  category?: string;
}

// Park-wide amenities (stored in campground.amenities)
export const PARK_AMENITIES: AmenityOption[] = [
  { id: "pool", label: "Pool", icon: Waves, category: "recreation" },
  { id: "wifi", label: "WiFi", icon: Wifi, category: "utilities" },
  { id: "pickleball", label: "Pickleball", icon: Dumbbell, category: "recreation" },
  { id: "hiking_trails", label: "Hiking Trails", icon: Mountain, category: "outdoor" },
  { id: "walking_trails", label: "Walking Trails", icon: Footprints, category: "outdoor" },
  { id: "biking_trails", label: "Biking Trails", icon: Bike, category: "outdoor" },
  { id: "bath_house", label: "Bath House", icon: Bath, category: "facilities" },
  { id: "store", label: "Camp Store", icon: Store, category: "facilities" },
  { id: "restrooms", label: "Restrooms", icon: Bath, category: "facilities" },
  { id: "showers", label: "Showers", icon: ShowerHead, category: "facilities" },
  { id: "laundry", label: "Laundry", icon: Shirt, category: "facilities" },
  { id: "playground", label: "Playground", icon: Baby, category: "recreation" },
  { id: "fishing", label: "Fishing", icon: Fish, category: "outdoor" },
  { id: "boat_launch", label: "Boat Launch", icon: Ship, category: "outdoor" },
  { id: "dog_park", label: "Dog Park", icon: Dog, category: "recreation" },
  { id: "rec_room", label: "Rec Room", icon: Gamepad2, category: "recreation" },
  { id: "fire_pit_communal", label: "Communal Fire Pit", icon: Flame, category: "outdoor" },
  { id: "dump_station", label: "Dump Station", icon: Trash2, category: "utilities" },
];

// Site class amenities (stored in siteClass.amenityTags)
export const SITE_CLASS_AMENITIES: AmenityOption[] = [
  // Site surface & structure
  { id: "picnic_table", label: "Picnic Table", icon: Table2 },
  { id: "fire_pit", label: "Fire Pit", icon: Flame },
  { id: "patio", label: "Patio", icon: Armchair },
  { id: "bbq_grill", label: "BBQ Grill", icon: Flame },
  { id: "concrete_pad", label: "Concrete Pad", icon: Square },
  { id: "grass_pad", label: "Grass Pad", icon: Leaf },
  { id: "gravel_pad", label: "Gravel Pad", icon: Square },
  { id: "paved_driveway", label: "Paved Driveway", icon: Square },
  { id: "covered", label: "Covered", icon: Sun },
  { id: "level_site", label: "Level Site", icon: Square },

  // Views & Nature
  { id: "shade", label: "Shade/Trees", icon: TreeDeciduous },
  { id: "lake_view", label: "Lake View", icon: Waves },
  { id: "river_view", label: "River View", icon: Waves },
  { id: "ocean_view", label: "Ocean View", icon: Waves },
  { id: "mountain_view", label: "Mountain View", icon: Mountain },
  { id: "forest_view", label: "Forest View", icon: TreeDeciduous },
  { id: "waterfront", label: "Waterfront Access", icon: Waves },

  // Connectivity
  { id: "cable_tv", label: "Cable TV", icon: Cable },
  { id: "site_wifi", label: "Site WiFi", icon: WifiIcon },
  { id: "satellite_friendly", label: "Satellite Friendly", icon: Cable },

  // Parking & Access
  { id: "extra_parking", label: "Extra Vehicle Parking", icon: Square },
  { id: "golf_cart_parking", label: "Golf Cart Parking", icon: Square },
  { id: "ev_charging", label: "EV Charging", icon: Zap },
  { id: "boat_dock", label: "Boat Dock/Slip", icon: Ship },

  // RV Site Features
  { id: "pull_through", label: "Pull-Through Site", icon: Truck },
  { id: "back_in", label: "Back-In Site", icon: Truck },
  { id: "big_rig_friendly", label: "Big Rig Friendly", icon: Truck },
  { id: "slide_out_space", label: "Slide-Out Space", icon: Square },

  // Pet Features
  { id: "pet_friendly", label: "Pet Friendly", icon: PawPrint },
  { id: "fenced_pet_area", label: "Fenced Pet Area", icon: PawPrint },

  // Tent Features
  { id: "tent_platform", label: "Tent Platform", icon: Tent },
  { id: "bear_box", label: "Bear Box/Food Locker", icon: Package },
  { id: "lean_to", label: "Lean-To/Shelter", icon: Tent },

  // Extras
  { id: "hammock_hooks", label: "Hammock Hooks", icon: TreeDeciduous },
  { id: "clothesline", label: "Clothesline", icon: Shirt },
  { id: "storage_locker", label: "Storage Locker", icon: Square },
  { id: "buddy_site", label: "Buddy Site Available", icon: Users },
  { id: "outdoor_lighting", label: "Outdoor Lighting", icon: Lightbulb },
];

// Cabin-specific amenities (for cabin/glamping site classes)
export const CABIN_AMENITIES: AmenityOption[] = [
  // Sleeping
  { id: "bed_king", label: "King Bed", icon: BedDouble, category: "sleeping" },
  { id: "bed_queen", label: "Queen Bed", icon: BedDouble, category: "sleeping" },
  { id: "bed_full", label: "Full Bed", icon: Bed, category: "sleeping" },
  { id: "bed_twin", label: "Twin Bed(s)", icon: Bed, category: "sleeping" },
  { id: "bed_bunk", label: "Bunk Bed(s)", icon: Bed, category: "sleeping" },
  { id: "sleeper_sofa", label: "Sleeper Sofa", icon: Sofa, category: "sleeping" },
  { id: "linens_provided", label: "Linens Provided", icon: Sparkles, category: "sleeping" },

  // Bathroom
  { id: "full_bathroom", label: "Full Bathroom", icon: Bath, category: "bathroom" },
  { id: "half_bathroom", label: "Half Bathroom", icon: Bath, category: "bathroom" },
  { id: "shower", label: "Shower", icon: ShowerHead, category: "bathroom" },
  { id: "bathtub", label: "Bathtub", icon: Bath, category: "bathroom" },
  { id: "towels_provided", label: "Towels Provided", icon: Sparkles, category: "bathroom" },

  // Kitchen
  { id: "full_kitchen", label: "Full Kitchen", icon: UtensilsCrossed, category: "kitchen" },
  { id: "kitchenette", label: "Kitchenette", icon: CookingPot, category: "kitchen" },
  { id: "refrigerator", label: "Refrigerator", icon: Refrigerator, category: "kitchen" },
  { id: "microwave", label: "Microwave", icon: CookingPot, category: "kitchen" },
  { id: "coffee_maker", label: "Coffee Maker", icon: Coffee, category: "kitchen" },
  { id: "dishes_utensils", label: "Dishes & Utensils", icon: UtensilsCrossed, category: "kitchen" },

  // Climate
  { id: "ac", label: "Air Conditioning", icon: Snowflake, category: "climate" },
  { id: "heat", label: "Heat", icon: Heater, category: "climate" },
  { id: "fireplace", label: "Fireplace", icon: Flame, category: "climate" },
  { id: "ceiling_fan", label: "Ceiling Fan", icon: Snowflake, category: "climate" },

  // Entertainment & Connectivity
  { id: "tv", label: "TV", icon: Tv, category: "entertainment" },
  { id: "cable_tv", label: "Cable/Satellite TV", icon: Cable, category: "entertainment" },
  { id: "wifi", label: "WiFi", icon: WifiIcon, category: "entertainment" },

  // Laundry
  { id: "washer", label: "Washer", icon: WashingMachine, category: "laundry" },
  { id: "dryer", label: "Dryer", icon: WashingMachine, category: "laundry" },

  // Outdoor
  { id: "private_deck", label: "Private Deck/Porch", icon: Home, category: "outdoor" },
  { id: "screen_porch", label: "Screened Porch", icon: Wind, category: "outdoor" },
  { id: "private_fire_pit", label: "Private Fire Pit", icon: Flame, category: "outdoor" },
  { id: "grill", label: "Grill", icon: Flame, category: "outdoor" },
  { id: "outdoor_seating", label: "Outdoor Seating", icon: Armchair, category: "outdoor" },
  { id: "private_entrance", label: "Private Entrance", icon: DoorOpen, category: "outdoor" },
  { id: "hot_tub", label: "Hot Tub/Jacuzzi", icon: GlassWater, category: "outdoor" },

  // Kitchen Appliances (additional)
  { id: "dishwasher", label: "Dishwasher", icon: WashingMachine, category: "kitchen" },
  { id: "stove_oven", label: "Stove/Oven", icon: Flame, category: "kitchen" },
  { id: "toaster", label: "Toaster", icon: CookingPot, category: "kitchen" },

  // Structure
  { id: "loft", label: "Loft/Upper Level", icon: Home, category: "structure" },
  { id: "multiple_rooms", label: "Multiple Rooms", icon: DoorOpen, category: "structure" },

  // Policies
  { id: "pet_friendly_cabin", label: "Pet Friendly", icon: PawPrint, category: "policies" },
  { id: "smoke_free", label: "Smoke Free", icon: Wind, category: "policies" },
  { id: "ada_accessible", label: "ADA Accessible", icon: Users, category: "policies" },
];

// Group site amenities (for group/pavilion sites)
export const GROUP_AMENITIES: AmenityOption[] = [
  { id: "pavilion", label: "Pavilion/Shelter", icon: Home, category: "structure" },
  { id: "multiple_tables", label: "Multiple Picnic Tables", icon: Table2, category: "seating" },
  { id: "group_fire_ring", label: "Group Fire Ring", icon: Flame, category: "outdoor" },
  { id: "electricity", label: "Electricity Available", icon: Zap, category: "utilities" },
  { id: "water_spigot", label: "Water Spigot", icon: GlassWater, category: "utilities" },
  { id: "volleyball", label: "Volleyball Court", icon: Dumbbell, category: "activities" },
  { id: "horseshoe_pit", label: "Horseshoe Pit", icon: Dumbbell, category: "activities" },
  { id: "large_grill", label: "Large Grill/BBQ", icon: Flame, category: "outdoor" },
  { id: "stage_area", label: "Stage/Presentation Area", icon: Square, category: "structure" },
  { id: "restroom_nearby", label: "Restroom Nearby", icon: Bath, category: "facilities" },
  { id: "parking_lot", label: "Nearby Parking Lot", icon: Square, category: "parking" },
  { id: "ada_accessible_group", label: "ADA Accessible", icon: Users, category: "accessibility" },
];

// Bed size options for room configuration
type BedSizeOption = {
  id: "king" | "queen" | "full" | "twin" | "bunk";
  label: string;
  icon: LucideIcon;
};
export const BED_SIZES: BedSizeOption[] = [
  { id: "king", label: "King", icon: BedDouble },
  { id: "queen", label: "Queen", icon: BedDouble },
  { id: "full", label: "Full", icon: Bed },
  { id: "twin", label: "Twin", icon: Bed },
  { id: "bunk", label: "Bunk", icon: Bed },
];

// Helper to get amenity by id
export function getAmenityById(
  id: string,
  type: "park" | "site" | "cabin",
): AmenityOption | undefined {
  const list =
    type === "park" ? PARK_AMENITIES : type === "cabin" ? CABIN_AMENITIES : SITE_CLASS_AMENITIES;
  return list.find((a) => a.id === id);
}

// Helper to get amenity labels from ids
export function getAmenityLabels(ids: string[], type: "park" | "site" | "cabin"): string[] {
  return ids
    .map((id) => getAmenityById(id, type)?.label)
    .filter((label): label is string => !!label);
}

// Get all amenities for a site type (combines site class + type-specific amenities)
export function getAmenitiesForSiteType(siteType: string): AmenityOption[] {
  if (siteType === "cabin" || siteType === "glamping") {
    return [...SITE_CLASS_AMENITIES, ...CABIN_AMENITIES];
  }
  if (siteType === "group") {
    return [...SITE_CLASS_AMENITIES, ...GROUP_AMENITIES];
  }
  return SITE_CLASS_AMENITIES;
}

// Group group amenities by category
export function getGroupAmenitiesByCategory(): Record<string, AmenityOption[]> {
  const grouped: Record<string, AmenityOption[]> = {};
  for (const amenity of GROUP_AMENITIES) {
    const category = amenity.category || "other";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(amenity);
  }
  return grouped;
}

// Group cabin amenities by category
export function getCabinAmenitiesByCategory(): Record<string, AmenityOption[]> {
  const grouped: Record<string, AmenityOption[]> = {};
  for (const amenity of CABIN_AMENITIES) {
    const category = amenity.category || "other";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(amenity);
  }
  return grouped;
}
