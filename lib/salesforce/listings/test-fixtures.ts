import type { SfListingRecord } from "./fields";
import type { Lookups } from "./plan";

/**
 * Listings shaped exactly like the sandbox returned them on 24 Sept 2026 —
 * the quirks are the point: rooms as strings, coordinates as strings, photo
 * URLs comma-separated, uploads as `/sfc/servlet.shepherd` links inside
 * rich text, a villa filed as "Duplex" in one type field and "Villa" in the
 * other. The CRM users' names and emails are replaced.
 */

export const NOW = new Date("2026-09-24T09:00:00Z");

/** The sandbox's only published listing: almost nothing filled in. */
export const SPARSE_PUBLISHED: SfListingRecord = {
  Id: "a03iy000000R7rpAAC",
  Name: "LST-00000",
  LastModifiedDate: "2026-09-24T05:09:47.000+0000",
  Website_Status__c: "Published",
  Listing_Status__c: "Active",
  Sale_Rent__c: "Sale",
  Price__c: null,
  Expired_Date__c: "2026-11-05",
  Website_Published_Date__c: "2026-09-15",
  Property__c: "a01iy000000WjEyAAK",
  Assigned_Agent__c: "005iy000000A9ozAAC",
  Assigned_Agent__r: { Name: "Agent One", Email: "agent.one@crm.example" },
  Property__r: {
    Id: "a01iy000000WjEyAAK",
    Name: "Property 1",
    LastModifiedDate: "2026-09-22T08:18:34.000+0000",
    Amenities__c:
      "Shared Pool;Children's Pool;Children's Play Area;Location URL;Maids Room;Balcony;Concierge Service;Pets Allowed;Study;Private Garden;Private Pool;Private Gym;Private Jacuzzi;Built in Kitchen;Appliances;Maid Service",
    Bathrooms__c: "3",
    Rooms__c: "6",
    Latitude__c: "25.1168",
    Longitude__c: "55.2550",
    PropertyPrice__c: 1000000,
    PropertySizeSqft__c: 2000,
    Plot_Size__c: 3000,
    Purpose__c: "Sale",
    Property_Status__c: "Available",
    Listing_Images__c:
      '<img src="/sfc/servlet.shepherd/version/download/068iy0000002GlRAAU" alt="Image"></img><br><img src="/sfc/servlet.shepherd/version/download/068iy0000002Gn3AAE" alt="Image"></img><br>',
    Agent_Name__r: { Name: "Agent Two", Email: "agent.two@crm.example" },
  },
};

/** A rental in a location the website has no area for. */
export const RENT_UNMAPPED: SfListingRecord = {
  Id: "a03iy000000XHoUAAW",
  Name: "LST-00003",
  LastModifiedDate: "2026-09-23T10:31:43.000+0000",
  Website_Status__c: "Published",
  Listing_Status__c: "Active",
  Sale_Rent__c: "Rent",
  Price__c: 145000,
  Published_Date__c: "2026-09-17",
  Expired_Date__c: "2026-10-01",
  Property__c: "a01iy000000aUfWAAU",
  Assigned_Agent__c: "005iy000000A9ozAAC",
  Assigned_Agent__r: { Name: "Agent One", Email: "agent.one@crm.example" },
  Property__r: {
    Id: "a01iy000000aUfWAAU",
    Name: "P-0005",
    Title__c: "Property 3 - 3BR Apt Sobha City",
    Title_Arabic__c: "شقة عصرية 3 غرف في شوبا سيتي",
    Description__c:
      "Bright 3-bedroom apartment with balcony, shared pool access, gym, and covered parking. Ready to move in.",
    Description_Arabic__c: "شقة مشرقة من 3 غرف نوم مع شرفة ومسبح مشترك وصالة رياضية وموقف سيارات مغطى.",
    Location__c: "Sobha City, Abu Dhabi",
    Emirate__c: "Abu Dhabi",
    Category__c: "Residential",
    PropertyType__c: "Apartment",
    Property_Type_Bayut_Picklist__c: "Apartments",
    OfferingType__c: "Rent",
    ProjectStatus__c: "Primary - Ready to move",
    Project_Type__c: "Secondary",
    Developer__c: "Sobha Realty",
    Rooms__c: "3",
    Bathrooms__c: "3",
    PropertySizeSqft__c: 1850,
    FurnishingType__c: "Partly Furnished",
    NoOfParkingSpaces__c: 1,
    FloorNumber__c: "12",
    Latitude__c: "24.4539",
    Longitude__c: "54.3773",
    PropertyPrice__c: 145000,
    Yearly__c: 145000,
    Rent_Frequency__c: "Yearly",
    Property_Status__c: "Available",
    RERAPermitNumber__c: "RERA-2026-1003",
    Permit_Expiry_Date_c__c: "2026-12-01",
    Reference__c: "BZR-PROP-003",
    Listing_ID__c: "BYT-10003",
    Amenities__c: "Central A/C;Shared Pool;Covered Parking;Balcony",
    Main_Image_URL__c: "https://example.com/properties/property-3-main.jpg",
  },
};

/** An off-plan villa whose listing has already expired. */
export const EXPIRED_OFF_PLAN_VILLA: SfListingRecord = {
  Id: "a03iy000000XDJTAA4",
  Name: "LST-00004",
  Website_Status__c: "Published",
  Listing_Status__c: "Active",
  Sale_Rent__c: "Sale",
  Price__c: 5200000,
  Expired_Date__c: "2026-09-18",
  Property__c: "a01iy000000aUfXAAU",
  Property__r: {
    Id: "a01iy000000aUfXAAU",
    Name: "P-0006",
    Title__c: "Property 4 - 5BR Villa Hudayriyat",
    Location__c: "Hudayriyat Island, Abu Dhabi",
    Emirate__c: "Abu Dhabi",
    PropertyType__c: "Duplex",
    Property_Type_Bayut_Picklist__c: "Villa",
    ProjectStatus__c: "Primary - Off-Plan",
    Developer__c: "Modon",
    Rooms__c: "5",
    Bathrooms__c: "6",
    RERAPermitNumber__c: "RERA-2026-1004",
    Permit_Expiry_Date_c__c: "2026-12-01",
    Property_Status__c: "Reserved",
    Listing_Image_URLs__c:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200,https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200",
  },
};

/** Everything present, everything mappable: this one goes live. */
export const COMPLETE_SALE: SfListingRecord = {
  Id: "a03iy000000XI30AAG",
  Name: "LST-00002",
  Website_Status__c: "Published",
  Listing_Status__c: "Active",
  Sale_Rent__c: "Sale",
  Price__c: 1850000,
  Website_Published_Date__c: "2026-09-17",
  Expired_Date__c: "2026-12-31",
  Property__c: "a01iy000000aUfVAAU",
  Assigned_Agent__c: "005iy000000AE3JAAW",
  Assigned_Agent__r: { Name: "Staff Advisor", Email: "Advisor@Bazar.ae" },
  Property__r: {
    Id: "a01iy000000aUfVAAU",
    Name: "P-0004",
    Title__c: "4BR Villa on Yas Island",
    Description__c: "Fully furnished 4-bedroom villa.\n\nPrivate garden & maid's room.",
    Location__c: "Yas Island, Abu Dhabi",
    Emirate__c: "Abu Dhabi",
    Category__c: "Residential",
    PropertyType__c: "Duplex",
    Property_Type_Bayut_Picklist__c: "Villa",
    ProjectStatus__c: "Resale - Ready to move",
    Developer__c: "Aldar Properties",
    Rooms__c: "4",
    Bathrooms__c: "4",
    PropertySizeSqft__c: 3200.4,
    Plot_Size__c: 4500,
    FurnishingType__c: "Fully Furnished",
    NoOfParkingSpaces__c: 2,
    Latitude__c: "24.4980",
    Longitude__c: "54.6050",
    RERAPermitNumber__c: "ADREC-2026-0042",
    PermitType__c: "ADREC",
    Permit_Expiry_Date_c__c: "2026-12-31",
    Reference__c: "BZR-PROP-002",
    Amenities__c: "Central A/C;Private Garden;Maids Room;Priya testing",
    Cover_Page_Image__c:
      '<p><img src="https://bazarrealestate--sand.sandbox.file.force.com/sfc/servlet.shepherd/version/download/068iy0000002S53AAE" alt="cover"></p>',
    Listing_Images__c:
      '<img src="/sfc/servlet.shepherd/version/download/068iy0000002S53AAE"></img><img src="/sfc/servlet.shepherd/version/download/068iy0000002S9tAAE"></img>',
    Listing_Image_URLs__c: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200",
    Floor_Plans__c:
      '<img src="https://bazarrealestate--sand.sandbox.file.force.com/servlet/rtaImage?eid=a01iy000000aUfV&amp;feoid=00Niy000001&amp;refid=0EMiy0000000XyZ">',
  },
};

export const IDS = {
  abuDhabi: "00000000-0000-4000-8000-000000000001",
  yas: "00000000-0000-4000-8000-000000000002",
  hudayriyat: "00000000-0000-4000-8000-000000000003",
  saadiyat: "00000000-0000-4000-8000-000000000004",
  lagoons: "00000000-0000-4000-8000-000000000005",
  reem: "00000000-0000-4000-8000-000000000006",
  aldar: "00000000-0000-4000-8000-000000000011",
  modon: "00000000-0000-4000-8000-000000000012",
  sobha: "00000000-0000-4000-8000-000000000013",
  advisor: "00000000-0000-4000-8000-000000000021",
};

export function lookups(overrides: Partial<Lookups> = {}): Lookups {
  return {
    areas: [
      { id: IDS.abuDhabi, name: "Abu Dhabi", slug: "abu-dhabi", kind: "emirate", parent_id: null },
      { id: IDS.yas, name: "Yas Island", slug: "yas-island", kind: "area", parent_id: IDS.abuDhabi },
      { id: IDS.hudayriyat, name: "Hudayriyat Island", slug: "hudayriyat-island", kind: "area", parent_id: IDS.abuDhabi },
      { id: IDS.saadiyat, name: "Saadiyat Island", slug: "saadiyat-island", kind: "area", parent_id: IDS.abuDhabi },
      { id: IDS.lagoons, name: "Saadiyat Lagoons", slug: "saadiyat-lagoons", kind: "sub_community", parent_id: IDS.saadiyat },
      { id: IDS.reem, name: "Al Reem Island", slug: "al-reem-island", kind: "area", parent_id: IDS.abuDhabi },
    ],
    developers: [
      { id: IDS.aldar, name: "ALDAR Properties" },
      { id: IDS.modon, name: "MODON Properties" },
      { id: IDS.sobha, name: "Sobha Realty" },
    ],
    staffByEmail: new Map([["advisor@bazar.ae", IDS.advisor]]),
    amenityLabels: [
      "Central Air Conditioning",
      "Swimming Pool",
      "Covered Parking",
      "Balcony",
      "Private Garden",
      "Maid’s Room",
      "Kids’ Pool",
      "Kids’ Play Area",
      "Concierge",
      "Pet friendly",
      "Study Room",
      "Private Swimming Pool",
      "Jacuzzi",
      "Fully Fitted Kitchen",
      "Kitchen Appliances",
    ],
    mappings: { location: new Map(), developer: new Map(), agent: new Map() },
    ...overrides,
  };
}
