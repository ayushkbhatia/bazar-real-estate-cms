-- 0091_area_guide_content.sql
-- Per-area copy for the eleven area guides covered by the content deck.
--
-- The area template (lib/master-pages/subpages.ts) declares the thirteen bands
-- a guide is built from; it deliberately declares no default copy, because copy
-- on a sub-page is an override and there are two dozen areas. The words
-- themselves therefore live here, in the section document the CMS reads and
-- writes — /admin/pages/sub/area/<slug>. Every heading, intro, statistic,
-- landmark, community, destination, reason, question and CTA below is editable
-- there the moment this lands; nothing in this file is hardcoded into a page.
--
-- Ordering matches the deck: hero, cover image, market statistics, map,
-- landmarks, communities, for sale, for rent, nearby, why here, lead form,
-- FAQs, final CTA. The six bands that predate the restructure — schools,
-- market reports, valuation prompt, lifestyle dossier, advisors, similar areas
-- — are written in switched off. They are not deleted: an editor can switch any
-- of them back on per area without touching code.
--
-- Landmark and community rows carry an empty image reference and a placeholder
-- caption. Until someone attaches a photo in the CMS the brand placeholder
-- draws with that caption, so the grid reads as art-directed rather than broken.
--
-- Idempotent: re-running replaces the document rather than duplicating it.
-- Running it a second time will discard edits made in the CMS since the first
-- run, which is the intended behaviour for a content seed.

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/hudayriyat-island',
  'Hudayriyat Island (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Hudayriyat Island",
      "intro": "One of Abu Dhabi’s most distinctive island destinations, offering premium waterfront living alongside beaches, cycling, world-class sports facilities and an extensive range of outdoor and leisure experiences.",
      "position": "Located 15–20 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "A wide aerial image showing Hudayriyat’s coastline, waterfront, greenery and residential masterplan, with Abu Dhabi’s skyline visible in the distance."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Hudayriyat Island Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 1,713 / sq. ft.",
          "label": "Property Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+11.58%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 1,742 / sq. ft.",
          "label": "Off-Plan Property Sale Index"
        },
        {
          "enabled": true,
          "value": "+12.58%",
          "label": "12-Month Off-Plan Index Change"
        },
        {
          "enabled": true,
          "value": "AED 2,208 / sq. ft.",
          "label": "Apartment Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+30.66%",
          "label": "12-Month Apartment Index Change"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Hudayriyat Island on the map.",
      "intro": null,
      "detail": "Located just off Abu Dhabi’s southwest coast, opposite Al Bateen and connected to the city by bridge."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Landmarks & Attractions",
      "intro": "Discover a destination centred around sport, recreation and waterfront experiences.",
      "items": [
        {
          "enabled": true,
          "name": "Surf Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "surf abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "Velodrome Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "velodrome abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "Marsana",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "marsana",
          "href": null
        },
        {
          "enabled": true,
          "name": "Bab Al Nojoum",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "bab al nojoum",
          "href": null
        },
        {
          "enabled": true,
          "name": "321 Sports",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "321 sports",
          "href": null
        },
        {
          "enabled": true,
          "name": "Circuit X",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "circuit x",
          "href": null
        },
        {
          "enabled": true,
          "name": "Trail X",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "trail x",
          "href": null
        },
        {
          "enabled": true,
          "name": "Hudayriyat Heritage Trail",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "hudayriyat heritage trail",
          "href": null
        }
      ],
      "footnote": "The wider masterplan includes 53.5 km of coastline, 16 km of beaches and a planned 220 km cycling network."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Hudayriyat Island",
      "intro": "Discover some of the island’s leading residential communities:",
      "items": [
        {
          "enabled": true,
          "name": "Al Naseem Community",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al naseem community"
        },
        {
          "enabled": true,
          "name": "Bashayer",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "bashayer"
        },
        {
          "enabled": true,
          "name": "Hudayriyat Golf Estates",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "hudayriyat golf estates"
        },
        {
          "enabled": true,
          "name": "Nawayef Park Views",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "nawayef park views"
        },
        {
          "enabled": true,
          "name": "Nawayef Village",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "nawayef village"
        },
        {
          "enabled": true,
          "name": "Nawayef East",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "nawayef east"
        }
      ],
      "footnote": "These are among Modon’s current residential developments across Hudayriyat Island."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale on Hudayriyat Island",
      "intro": "Explore available villas, townhouses, apartments and premium residential opportunities across Hudayriyat Island.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent on Hudayriyat Island",
      "intro": "Discover available rental opportunities across Hudayriyat Island’s growing residential communities.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": "Looking to rent on Hudayriyat Island? Speak with our team about current and upcoming availability."
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Connected to Abu Dhabi",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 20 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 30 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Bateen",
          "time": "directly opposite the island",
          "href": null
        }
      ],
      "footnote": "The current Hudayriyat Golf Estates location guidance places the development around 20 minutes from Downtown and 30 minutes from Zayed International Airport."
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Hudayriyat Island?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Waterfront Lifestyle",
          "desc": "Coastal communities surrounded by beaches and open water."
        },
        {
          "enabled": true,
          "name": "Active Living",
          "desc": "An extensive network of sport, cycling, running and recreation facilities."
        },
        {
          "enabled": true,
          "name": "Premium Communities",
          "desc": "A growing collection of villas, mansions, townhouses and apartments."
        },
        {
          "enabled": true,
          "name": "Wellness & Nature",
          "desc": "Residential environments designed around outdoor living and green spaces."
        },
        {
          "enabled": true,
          "name": "Long-Term Growth",
          "desc": "A major master-planned destination continuing to expand with new communities and infrastructure."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property on Hudayriyat Island?",
      "intro": "Get a free property consultation and discover available opportunities that match your requirements.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Hudayriyat Island",
      "intro": null,
      "items": [
        {
          "q": "What is Hudayriyat Island known for?",
          "a": "Hudayriyat is known for its waterfront setting, premium residential communities and strong focus on sport, wellness and outdoor recreation."
        },
        {
          "q": "What properties are available on Hudayriyat Island?",
          "a": "The island includes apartments, townhouses, villas, mansions and residential plots across different communities."
        },
        {
          "q": "How far is Hudayriyat Island from Downtown Abu Dhabi?",
          "a": "It is approximately 15–20 minutes from central Abu Dhabi, depending on traffic and the exact destination."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property on Hudayriyat Island",
      "intro": "Explore opportunities to buy, rent or invest with trusted property guidance from Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/saadiyat-island',
  'Saadiyat Island (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Saadiyat Island",
      "intro": "A premium cultural and beachfront destination known for its natural white-sand coastline, luxury residences, five-star resorts and world-renowned cultural landmarks. It combines relaxed island living with one of Abu Dhabi’s most prestigious residential environments.",
      "position": "Located 10–15 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "A premium coastal aerial showing Saadiyat Beach, luxury residences and the Cultural District."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Saadiyat Island Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 2,691 / sq. ft.",
          "label": "Property Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+2.52%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 123 / sq. ft.",
          "label": "Property Rental Index"
        },
        {
          "enabled": true,
          "value": "+24.81%",
          "label": "12-Month Rental Index Change"
        },
        {
          "enabled": true,
          "value": "27 sq. km",
          "label": "Approximate Island Area"
        }
      ],
      "footnote": "Sale data: June 2026 | Rental data: May 2026."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Saadiyat Island on the map.",
      "intro": null,
      "detail": "Positioned just off Abu Dhabi’s coast, with convenient connections to Downtown Abu Dhabi, Al Maryah Island, Reem Island and Yas Island."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Landmarks & Attractions",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Louvre Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "louvre abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "Zayed National Museum",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "zayed national museum",
          "href": null
        },
        {
          "enabled": true,
          "name": "teamLab Phenomena Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "teamlab phenomena abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "Abrahamic Family House",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "abrahamic family house",
          "href": null
        },
        {
          "enabled": true,
          "name": "Natural History Museum Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "natural history museum abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "Manarat Al Saadiyat",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "manarat al saadiyat",
          "href": null
        },
        {
          "enabled": true,
          "name": "Mamsha Beach",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mamsha beach",
          "href": null
        },
        {
          "enabled": true,
          "name": "Saadiyat Beach Golf Club",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "saadiyat beach golf club",
          "href": null
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Saadiyat Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Mamsha Al Saadiyat",
          "desc": null,
          "href": "/areas/mamsha-al-saadiyat",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mamsha al saadiyat"
        },
        {
          "enabled": true,
          "name": "Mamsha Gardens",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mamsha gardens"
        },
        {
          "enabled": true,
          "name": "Mandarin Oriental Residences",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mandarin oriental residences"
        },
        {
          "enabled": true,
          "name": "Baccarat Residences Saadiyat",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "baccarat residences saadiyat"
        },
        {
          "enabled": true,
          "name": "Saadiyat Lagoons",
          "desc": null,
          "href": "/areas/saadiyat-lagoons",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "saadiyat lagoons"
        },
        {
          "enabled": true,
          "name": "Marsa Al Saadiyat",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "marsa al saadiyat"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale on Saadiyat Island",
      "intro": "Explore luxury apartments, villas, townhouses and beachfront residences across Saadiyat Island.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent on Saadiyat Island",
      "intro": "Discover premium rental properties across Saadiyat Island’s leading residential communities.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Connected to Abu Dhabi",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 10 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "approx. 20 min",
          "href": "/areas/yas-island"
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 20–30 min",
          "href": null
        }
      ],
      "footnote": "Travel time varies depending on the starting point and traffic."
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Saadiyat Island?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Beachfront Living",
          "desc": "Premium residences surrounded by natural coastline."
        },
        {
          "enabled": true,
          "name": "Cultural Destination",
          "desc": "Immediate access to world-renowned museums and institutions."
        },
        {
          "enabled": true,
          "name": "Luxury Lifestyle",
          "desc": "Five-star hospitality, dining, golf and premium communities."
        },
        {
          "enabled": true,
          "name": "Exclusive Residential Market",
          "desc": "A strong collection of high-end and branded residences."
        },
        {
          "enabled": true,
          "name": "Natural Environment",
          "desc": "Beaches, wildlife and landscaped surroundings complement the cultural setting."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property on Saadiyat Island?",
      "intro": "Get a free property consultation and discover available opportunities across one of Abu Dhabi’s most prestigious addresses.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Saadiyat Island",
      "intro": null,
      "items": [
        {
          "q": "What is Saadiyat Island known for?",
          "a": "Saadiyat is known for its beaches, luxury residences, resorts and globally recognised Cultural District."
        },
        {
          "q": "How large is Saadiyat Island?",
          "a": "The island covers approximately 27 sq. km."
        },
        {
          "q": "What properties are available?",
          "a": "Buyers can find apartments, villas, townhouses, branded residences and ultra-luxury homes across the island."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property on Saadiyat Island",
      "intro": "Discover premium homes and investment opportunities with trusted property guidance from Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/al-reem-island',
  'Al Reem Island (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Al Reem Island",
      "intro": "A modern waterfront community combining high-rise residential living with parks, promenades, retail, dining and convenient access to Abu Dhabi’s financial and business districts. It offers a strong balance between city convenience and island living.",
      "position": "Located 10 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "A skyline-focused waterfront aerial showing Reem Island’s residential towers, waterways and green spaces."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Al Reem Island Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 1,775 / sq. ft.",
          "label": "Property Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+23.61%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 110 / sq. ft.",
          "label": "Property Rental Index"
        },
        {
          "enabled": true,
          "value": "+5.49%",
          "label": "12-Month Rental Index Change"
        }
      ],
      "footnote": "Market data: June 2026."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Al Reem Island on the map.",
      "intro": null,
      "detail": "A central island location with direct connections to Downtown Abu Dhabi, Al Maryah Island and the E12 highway network."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Landmarks & Attractions",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Reem Mall",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "reem mall",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Fay Park",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al fay park",
          "href": null
        },
        {
          "enabled": true,
          "name": "Sorbonne University Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "sorbonne university abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "Waterfront Promenades",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "waterfront promenades",
          "href": null
        },
        {
          "enabled": true,
          "name": "Reem Island’s Parks & Recreation Areas",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "reem islands parks & recreation areas",
          "href": null
        }
      ],
      "footnote": "Two new marine bridges opened in March 2026, providing direct links to Sheikh Khalifa Bin Zayed Highway and improving connectivity toward Saadiyat and the E12 corridor."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Al Reem Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Reem Hills",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "reem hills"
        },
        {
          "enabled": true,
          "name": "Muheira",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "muheira"
        },
        {
          "enabled": true,
          "name": "Tara Park",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "tara park"
        },
        {
          "enabled": true,
          "name": "Maysan",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "maysan"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale on Al Reem Island",
      "intro": "Explore available apartments, townhouses, villas and investment properties across Al Reem Island.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent on Al Reem Island",
      "intro": "Find rental properties across one of Abu Dhabi’s most established urban waterfront communities.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Connected to the Capital",
      "intro": "From the central Tara Park area:",
      "items": [
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 5 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "ADGM / Al Maryah Island",
          "time": "approx. 5 min",
          "href": "/areas/al-maryah"
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 25 min",
          "href": null
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Al Reem Island?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Central Location",
          "desc": "Close to Downtown and Abu Dhabi’s financial district."
        },
        {
          "enabled": true,
          "name": "Waterfront Lifestyle",
          "desc": "Residential towers and communities positioned around canals and promenades."
        },
        {
          "enabled": true,
          "name": "Established Amenities",
          "desc": "Shopping, education, recreation and everyday services close to home."
        },
        {
          "enabled": true,
          "name": "Property Variety",
          "desc": "Ready and off-plan apartments alongside newer townhouse and villa communities."
        },
        {
          "enabled": true,
          "name": "Strong Connectivity",
          "desc": "Continued infrastructure improvements strengthen access across Abu Dhabi."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property on Al Reem Island?",
      "intro": "Get a free property consultation and discover available homes and investment opportunities.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Al Reem Island",
      "intro": null,
      "items": [
        {
          "q": "What is Al Reem Island known for?",
          "a": "It is one of Abu Dhabi’s leading mixed-use waterfront destinations, combining residential, retail and commercial development."
        },
        {
          "q": "What types of properties are available?",
          "a": "Apartments dominate the established market, with newer developments also introducing townhouses and villas."
        },
        {
          "q": "How close is Al Reem Island to Downtown Abu Dhabi?",
          "a": "Selected central Reem locations are approximately five minutes from Downtown."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property on Al Reem Island",
      "intro": "Explore properties for sale, rent and investment with Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/yas-island',
  'Yas Island (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Yas Island",
      "intro": "One of Abu Dhabi’s leading lifestyle and entertainment destinations, bringing together waterfront communities, beaches, golf, luxury hospitality and world-famous attractions including Ferrari World, Yas Waterworld and Warner Bros. World.",
      "position": "Located 30 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Wide aerial showing Yas Island’s waterfront, residential communities and recognisable attractions."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Yas Island Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 2,230 / sq. ft.",
          "label": "Property Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+20.87%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 124 / sq. ft.",
          "label": "Property Rental Index"
        },
        {
          "enabled": true,
          "value": "+18.59%",
          "label": "12-Month Rental Index Change"
        }
      ],
      "footnote": "Sale data: June 2026 | Rental data: May 2026."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Yas Island on the map.",
      "intro": null,
      "detail": "A strategically connected island close to Zayed International Airport and major routes towards Abu Dhabi and Dubai."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Landmarks & Attractions",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Ferrari World Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "ferrari world abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Waterworld",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas waterworld",
          "href": null
        },
        {
          "enabled": true,
          "name": "Warner Bros. World Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "warner bros world abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "SeaWorld Yas Island",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "seaworld yas island",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Marina Circuit",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas marina circuit",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Marina",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas marina",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Mall",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas mall",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Bay Waterfront",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas bay waterfront",
          "href": null
        },
        {
          "enabled": true,
          "name": "CLYMB Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "clymb abu dhabi",
          "href": null
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Yas Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Yas Acres",
          "desc": null,
          "href": "/areas/yas-acres",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas acres"
        },
        {
          "enabled": true,
          "name": "Gardenia Bay",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "gardenia bay"
        },
        {
          "enabled": true,
          "name": "Yas Golf Collection",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas golf collection"
        },
        {
          "enabled": true,
          "name": "Yas Park Place",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas park place"
        },
        {
          "enabled": true,
          "name": "Yas Point",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas point"
        },
        {
          "enabled": true,
          "name": "The Canopies at Yas Point",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the canopies at yas point"
        }
      ],
      "footnote": "Yas Point, launched in July 2026, is a new AED 6 billion waterfront masterplan with approximately 1,600 residences. The Canopies is its first residential community, comprising 592 apartments."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale on Yas Island",
      "intro": "Explore apartments, villas, townhouses and new developments across Yas Island.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent on Yas Island",
      "intro": "Find available rental homes across Yas Island’s established residential communities.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Connected to Abu Dhabi & Beyond",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "less than 10 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 20 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Dubai",
          "time": "approx. 50 min",
          "href": null
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Yas Island?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Complete Lifestyle Destination",
          "desc": "Residential living alongside entertainment, dining and leisure."
        },
        {
          "enabled": true,
          "name": "Family-Friendly Communities",
          "desc": "Villas, townhouses and apartments across established neighbourhoods."
        },
        {
          "enabled": true,
          "name": "Strong Connectivity",
          "desc": "Close to Abu Dhabi’s international airport and major highways."
        },
        {
          "enabled": true,
          "name": "Waterfront Living",
          "desc": "Marinas, beaches and waterfront developments across the island."
        },
        {
          "enabled": true,
          "name": "Continued Growth",
          "desc": "Major new residential destinations such as Yas Point continue to expand the market."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property on Yas Island?",
      "intro": "Get a free property consultation and discover available homes, new launches and investment opportunities.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Yas Island",
      "intro": null,
      "items": [
        {
          "q": "What is Yas Island known for?",
          "a": "Yas Island is internationally recognised for entertainment, motorsport, leisure and residential living."
        },
        {
          "q": "What properties are available on Yas Island?",
          "a": "The market includes apartments, townhouses, villas and premium waterfront residences."
        },
        {
          "q": "How far is Yas Island from Downtown Abu Dhabi?",
          "a": "Approximately 20 minutes by road."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property on Yas Island",
      "intro": "Discover homes, investment opportunities and new developments with Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/al-maryah',
  'Al Maryah Island (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Al Maryah Island",
      "intro": "A prestigious urban and waterfront destination at the heart of Abu Dhabi’s international financial district, home to ADGM, luxury hotels, premium shopping, dining and world-class healthcare.",
      "position": "Located 10 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "A sophisticated skyline image showing ADGM, The Galleria, waterfront towers and the promenade."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Al Maryah Island Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 2,189 / sq. ft.",
          "label": "Property Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+11.23%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 151 / sq. ft.",
          "label": "Property Rental Index"
        },
        {
          "enabled": true,
          "value": "+1.75%",
          "label": "12-Month Rental Index Change"
        }
      ],
      "footnote": "Market data: June 2026."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Al Maryah Island on the map.",
      "intro": null,
      "detail": "A central waterfront location positioned between Downtown Abu Dhabi and Al Reem Island."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Landmarks & Attractions",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Abu Dhabi Global Market",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "abu dhabi global market",
          "href": "/areas/adgm"
        },
        {
          "enabled": true,
          "name": "The Galleria Al Maryah Island",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the galleria al maryah island",
          "href": null
        },
        {
          "enabled": true,
          "name": "Cleveland Clinic Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "cleveland clinic abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Maryah Waterfront Promenade",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al maryah waterfront promenade",
          "href": null
        },
        {
          "enabled": true,
          "name": "Rosewood Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "rosewood abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "Four Seasons Hotel Abu Dhabi",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "four seasons hotel abu dhabi",
          "href": null
        },
        {
          "enabled": true,
          "name": "ACTIVE Al Maryah Island",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "active al maryah island",
          "href": null
        }
      ],
      "footnote": "The island includes a 5.4 km waterfront promenade, while The Galleria offers around 400 stores and 100 dining outlets."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Residential Living on Al Maryah Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Jumeirah Residences Al Maryah Island",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "jumeirah residences al maryah island"
        },
        {
          "enabled": true,
          "name": "Eden House Al Maryah Island",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "eden house al maryah island"
        },
        {
          "enabled": true,
          "name": "Al Maryah Vista",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al maryah vista"
        }
      ],
      "footnote": "Jumeirah Residences is planned with 253 apartments, while Eden House’s Al Maryah development is planned with more than 200 residences across 60 floors."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale on Al Maryah Island",
      "intro": "Explore premium waterfront apartments and branded residential opportunities.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent on Al Maryah Island",
      "intro": "Discover premium rental residences in the heart of Abu Dhabi’s financial and lifestyle district.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "At the Heart of Abu Dhabi",
      "intro": "From the Jumeirah Residences area:",
      "items": [
        {
          "enabled": true,
          "name": "ADGM",
          "time": "approx. 4 min",
          "href": "/areas/adgm"
        },
        {
          "enabled": true,
          "name": "The Galleria",
          "time": "approx. 5 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 10 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Louvre Abu Dhabi",
          "time": "approx. 12 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "approx. 25 min",
          "href": "/areas/yas-island"
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 25 min",
          "href": null
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Al Maryah Island?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Financial District",
          "desc": "Home to ADGM and major international businesses."
        },
        {
          "enabled": true,
          "name": "Luxury Lifestyle",
          "desc": "Premium retail, hotels, restaurants and waterfront experiences."
        },
        {
          "enabled": true,
          "name": "Central Location",
          "desc": "Convenient access to Downtown, Reem and Saadiyat."
        },
        {
          "enabled": true,
          "name": "Premium Residential Market",
          "desc": "New branded residences are expanding the island’s residential offering."
        },
        {
          "enabled": true,
          "name": "Walkable Waterfront",
          "desc": "Promenades connect business, lifestyle and leisure destinations."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property on Al Maryah Island?",
      "intro": "Get a free property consultation and explore premium residential opportunities.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Al Maryah Island",
      "intro": null,
      "items": [
        {
          "q": "What is Al Maryah Island known for?",
          "a": "It is Abu Dhabi’s leading business and lifestyle district, anchored by ADGM and The Galleria."
        },
        {
          "q": "Are there residential properties on Al Maryah Island?",
          "a": "Yes. The island offers existing apartments alongside a growing pipeline of premium and branded residences."
        },
        {
          "q": "Is Al Maryah Island close to Downtown Abu Dhabi?",
          "a": "Yes. Selected locations on the island are approximately 10 minutes from Downtown."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property on Al Maryah Island",
      "intro": "Explore waterfront and branded residences with Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/fahid-island',
  'Fahid Island (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Fahid Island",
      "intro": "A new waterfront destination by Aldar positioned between Yas Island and Saadiyat Island, designed around coastal living, wellness, sustainability and extensive green and blue spaces. It combines island privacy with convenient access to Abu Dhabi’s major lifestyle destinations.",
      "position": "Located 20 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Aerial coastal image showing Fahid’s turquoise waterfront, mangroves, beaches and new residential communities."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Fahid Island Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 3,876 / sq. ft.",
          "label": "Property Sale Price Index — Apr 2026"
        },
        {
          "enabled": true,
          "value": "+2.29%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 3,845 / sq. ft.",
          "label": "Off-Plan Apartment Sale Index — Jun 2026"
        },
        {
          "enabled": true,
          "value": "+8.95%",
          "label": "12-Month Off-Plan Index Change"
        },
        {
          "enabled": true,
          "value": "AED 4,251 / sq. ft.",
          "label": "Studio Apartment Sale Index — Jun 2026"
        },
        {
          "enabled": true,
          "value": "+12.90%",
          "label": "12-Month Studio Index Change"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Fahid Island on the map.",
      "intro": null,
      "detail": "Strategically positioned between Yas Island and Saadiyat Island."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Lifestyle & Island Highlights",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "4.6 km of Beaches",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "46 km of beaches",
          "href": null
        },
        {
          "enabled": true,
          "name": "10 km Berm Park",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "10 km berm park",
          "href": null
        },
        {
          "enabled": true,
          "name": "Coral Drive",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "coral drive",
          "href": null
        },
        {
          "enabled": true,
          "name": "2 km Waterfront Promenade",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "2 km waterfront promenade",
          "href": null
        },
        {
          "enabled": true,
          "name": "Mangrove Landscapes",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mangrove landscapes",
          "href": null
        },
        {
          "enabled": true,
          "name": "Wellness Facilities",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "wellness facilities",
          "href": null
        },
        {
          "enabled": true,
          "name": "Five-Star Hospitality",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "five-star hospitality",
          "href": null
        }
      ],
      "footnote": "The wider masterplan has a development value exceeding AED 40 billion and approximately 11 km of coastline."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Fahid Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Fahid Beach Residences",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "fahid beach residences"
        },
        {
          "enabled": true,
          "name": "Fahid Beach Terraces",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "fahid beach terraces"
        },
        {
          "enabled": true,
          "name": "The Beach House",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the beach house"
        }
      ],
      "footnote": "These developments form part of Fahid’s emerging premium residential market."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale on Fahid Island",
      "intro": "Explore premium apartments, townhouses, penthouses and beachfront residences.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent on Fahid Island",
      "intro": "Looking to rent on Fahid Island? Speak with our property consultants about current and upcoming availability.",
      "cta_label": "Enquire About Rental Properties",
      "cta_href": null,
      "empty_body": "Looking to rent on Fahid Island? Speak with our property consultants about current and upcoming availability."
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Perfectly Positioned",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "approx. 5 min",
          "href": "/areas/yas-island"
        },
        {
          "enabled": true,
          "name": "Saadiyat Island",
          "time": "approx. 15 min",
          "href": "/areas/saadiyat-island"
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 15 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Abu Dhabi City",
          "time": "approx. 20 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Dubai",
          "time": "approx. 50 min",
          "href": null
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Fahid Island?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Coastal Setting",
          "desc": "Beaches, mangroves and waterfront views."
        },
        {
          "enabled": true,
          "name": "Wellness-Led Masterplan",
          "desc": "Designed around walking, cycling, fitness and wellbeing."
        },
        {
          "enabled": true,
          "name": "Prime Position",
          "desc": "Between Yas Island and Saadiyat Island."
        },
        {
          "enabled": true,
          "name": "New Residential Market",
          "desc": "An expanding selection of premium coastal developments."
        },
        {
          "enabled": true,
          "name": "Natural Environment",
          "desc": "30% of the masterplan is dedicated to natural spaces."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property on Fahid Island?",
      "intro": "Get a free property consultation and discover the latest residential opportunities and new launches.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Fahid Island",
      "intro": null,
      "items": [
        {
          "q": "Where is Fahid Island?",
          "a": "Fahid Island is positioned between Yas Island and Saadiyat Island."
        },
        {
          "q": "What properties are available?",
          "a": "Current projects include apartments, townhouses and penthouses, alongside premium beachfront residences."
        },
        {
          "q": "What makes Fahid Island different?",
          "a": "Its masterplan places a strong emphasis on coastal wellness, walkability and access to nature."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property on Fahid Island",
      "intro": "Discover Abu Dhabi’s newest premium coastal opportunities with Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/al-raha-beach',
  'Al Raha Beach (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Al Raha Beach",
      "intro": "Waterfront apartment cluster within Al Raha — promenade restaurants, the marina, and a string of low-rise blocks along the channel between mainland and the islands.",
      "position": "Located 20 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Waterfront view showing Al Raha’s residential buildings, marina, promenade and beach."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Al Raha Beach Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 1,974 / sq. ft.",
          "label": "Property Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+15.01%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 105 / sq. ft.",
          "label": "Property Rental Index"
        },
        {
          "enabled": true,
          "value": "+7.55%",
          "label": "12-Month Rental Index Change"
        }
      ],
      "footnote": "Market data: June 2026."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Al Raha Beach on the map.",
      "intro": null,
      "detail": "A waterfront district positioned between central Abu Dhabi and Yas Island."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Landmarks & Attractions",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Aldar HQ",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "aldar hq",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Muneera Beach Plaza",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al muneera beach plaza",
          "href": null
        },
        {
          "enabled": true,
          "name": "Waterfront Promenades",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "waterfront promenades",
          "href": null
        },
        {
          "enabled": true,
          "name": "Private Beaches",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "private beaches",
          "href": null
        },
        {
          "enabled": true,
          "name": "Marinas & Waterfront Dining",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "marinas & waterfront dining",
          "href": null
        }
      ],
      "footnote": "Aldar HQ is located at Al Raha Beach, while Al Muneera Beach Plaza forms part of the community’s waterfront retail offering."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Al Raha Beach",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Al Zeina",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al zeina"
        },
        {
          "enabled": true,
          "name": "Al Muneera",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al muneera"
        },
        {
          "enabled": true,
          "name": "Al Bandar",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al bandar"
        }
      ],
      "footnote": "Al Zeina combines apartments, townhouses, sky villas and private beach facilities, while Al Muneera includes apartments, townhouses and villas."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Al Raha Beach",
      "intro": "Explore waterfront apartments, villas and townhouses across established Al Raha communities.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Al Raha Beach",
      "intro": "Discover rental homes offering convenient waterfront living and established community amenities.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Connected to Abu Dhabi",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "approx. 20 min",
          "href": "/areas/yas-island"
        },
        {
          "enabled": true,
          "name": "Abu Dhabi City Centre",
          "time": "approx. 25 min",
          "href": null
        }
      ],
      "footnote": "Travel times are based on the Al Raha Beach Resort area and vary by exact location and traffic."
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Al Raha Beach?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Established Waterfront Living",
          "desc": "Mature residential communities close to the sea."
        },
        {
          "enabled": true,
          "name": "Property Variety",
          "desc": "Apartments, townhouses and villas."
        },
        {
          "enabled": true,
          "name": "Community Lifestyle",
          "desc": "Beaches, retail, landscaped spaces and recreation."
        },
        {
          "enabled": true,
          "name": "Convenient Location",
          "desc": "Positioned between central Abu Dhabi and Yas."
        },
        {
          "enabled": true,
          "name": "Ready Property Market",
          "desc": "A strong selection of established resale and rental options."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Al Raha Beach?",
      "intro": "Get a free property consultation and discover available properties for sale or rent.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Al Raha Beach",
      "intro": null,
      "items": [
        {
          "q": "What types of properties are available?",
          "a": "The area offers apartments, townhouses and villas across established waterfront communities."
        },
        {
          "q": "What are the main communities?",
          "a": "Al Zeina, Al Muneera and Al Bandar are among the best-known residential areas."
        },
        {
          "q": "Is Al Raha Beach close to Yas Island?",
          "a": "Yes. The area is approximately 20 minutes from Yas Island from the Al Raha Beach Resort area."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Al Raha Beach",
      "intro": "Explore waterfront homes for sale and rent with Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/al-ghadeer',
  'Al Ghadeer (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Al Ghadeer",
      "intro": "A growing family-focused residential destination positioned along the Abu Dhabi–Dubai corridor, offering established communities alongside new development and convenient connections to both emirates.",
      "position": "Located 40 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Wide community image showing villas, townhouses, greenery and landscaped pedestrian spaces."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Al Ghadeer Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 1,128 / sq. ft.",
          "label": "Property Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+13.29%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 89 / sq. ft.",
          "label": "Property Rental Index"
        },
        {
          "enabled": true,
          "value": "+13.89%",
          "label": "12-Month Rental Index Change"
        },
        {
          "enabled": true,
          "value": "AED 1,217 / sq. ft.",
          "label": "Villa Sale Price Index — June 2026"
        },
        {
          "enabled": true,
          "value": "+17.82%",
          "label": "12-Month Villa Index Change"
        }
      ],
      "footnote": "Market data: May 2026."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Al Ghadeer on the map.",
      "intro": null,
      "detail": "Located on the Abu Dhabi–Dubai border within an important growth corridor connecting both emirates."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Community & Lifestyle Highlights",
      "intro": "Al Ghadeer is primarily a residential destination rather than a landmark-led location.",
      "items": [
        {
          "enabled": true,
          "name": "Landscaped Parks",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "landscaped parks",
          "href": null
        },
        {
          "enabled": true,
          "name": "Community Recreation",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "community recreation",
          "href": null
        },
        {
          "enabled": true,
          "name": "Wellness Facilities",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "wellness facilities",
          "href": null
        },
        {
          "enabled": true,
          "name": "Central Community Hub",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "central community hub",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Ghadeer British School – Planned for 2030",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al ghadeer british school planned for 2030",
          "href": null
        }
      ],
      "footnote": "The upcoming school is planned to accommodate more than 2,800 students."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Al Ghadeer",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Al Ghadeer Phase 2",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al ghadeer phase 2"
        },
        {
          "enabled": true,
          "name": "Al Khaleej Village",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al khaleej village"
        },
        {
          "enabled": true,
          "name": "Breeze Community",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "breeze community"
        },
        {
          "enabled": true,
          "name": "Al Waha",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al waha"
        },
        {
          "enabled": true,
          "name": "Al Sabeel Building",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al sabeel building"
        },
        {
          "enabled": true,
          "name": "Al Ghadeer Gardens",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al ghadeer gardens"
        }
      ],
      "footnote": "The newly launched Al Ghadeer Gardens comprises 437 villas and townhouses."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Al Ghadeer",
      "intro": "Explore apartments, villas and townhouses across Al Ghadeer.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Al Ghadeer",
      "intro": "Discover rental homes in an established residential community positioned between Abu Dhabi and Dubai.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Connected to Abu Dhabi & Dubai",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Expo City Dubai",
          "time": "within approx. 20 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Dubai Parks and Resorts",
          "time": "within approx. 20 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Maktoum International Airport",
          "time": "within approx. 20 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Future Palm Jebel Ali",
          "time": "within approx. 20 min",
          "href": null
        }
      ],
      "footnote": "Aldar also highlights access toward Yas Island, Zayed International Airport and Abu Dhabi city."
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Al Ghadeer?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Strategic Location",
          "desc": "Positioned between Abu Dhabi and Dubai."
        },
        {
          "enabled": true,
          "name": "Family-Focused Living",
          "desc": "Low-rise communities, landscaped areas and recreational facilities."
        },
        {
          "enabled": true,
          "name": "Property Variety",
          "desc": "Apartments, townhouses and villas."
        },
        {
          "enabled": true,
          "name": "Growing Infrastructure",
          "desc": "New residential phases and planned education facilities."
        },
        {
          "enabled": true,
          "name": "Connectivity",
          "desc": "Convenient access to major employment and lifestyle destinations across both emirates."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Al Ghadeer?",
      "intro": "Get a free property consultation and discover available homes and investment opportunities.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Al Ghadeer",
      "intro": null,
      "items": [
        {
          "q": "Where is Al Ghadeer located?",
          "a": "It is positioned close to the Abu Dhabi–Dubai border."
        },
        {
          "q": "What properties are available?",
          "a": "The wider community offers apartments, townhouses and villas."
        },
        {
          "q": "What is Al Ghadeer Gardens?",
          "a": "It is Aldar’s new 437-home community comprising villas and townhouses within a walkable, nature-led masterplan."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Al Ghadeer",
      "intro": "Explore homes positioned between Abu Dhabi and Dubai with Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/jubail-island',
  'Jubail Island (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Jubail Island",
      "intro": "A nature-led, low-density island community set within Abu Dhabi’s protected mangrove environment between Saadiyat and Yas Islands. It combines premium waterfront residences with greenery, wellness and a quieter coastal lifestyle.",
      "position": "Located 15 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Aerial image emphasising the mangroves, waterways, villas and low-density character of Jubail Island."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Jubail Island at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 15 Billion",
          "label": "Masterplan Development Value"
        },
        {
          "enabled": true,
          "value": "40 Million sq. m.",
          "label": "Island Area"
        },
        {
          "enabled": true,
          "value": "30+ km",
          "label": "Waterfront"
        },
        {
          "enabled": true,
          "value": "1,000+",
          "label": "Homes Completed & Handed Over by April 2026"
        },
        {
          "enabled": true,
          "value": "10,000+",
          "label": "Planned Residents"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Jubail Island on the map.",
      "intro": null,
      "detail": "Located between Saadiyat Island and Yas Island within Abu Dhabi’s coastal residential corridor."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Landmarks & Attractions",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Jubail Mangrove Park",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "jubail mangrove park",
          "href": null
        },
        {
          "enabled": true,
          "name": "Marsa Al Jubail",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "marsa al jubail",
          "href": null
        },
        {
          "enabled": true,
          "name": "Jubail Beach Club",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "jubail beach club",
          "href": null
        },
        {
          "enabled": true,
          "name": "Mangrove Boardwalk",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mangrove boardwalk",
          "href": null
        },
        {
          "enabled": true,
          "name": "Marinas & Yacht Clubs",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "marinas & yacht clubs",
          "href": null
        },
        {
          "enabled": true,
          "name": "Kayaking",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "kayaking",
          "href": null
        },
        {
          "enabled": true,
          "name": "Cycling & Walking Trails",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "cycling & walking trails",
          "href": null
        },
        {
          "enabled": true,
          "name": "Souk Al Jubail",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "souk al jubail",
          "href": null
        }
      ],
      "footnote": "Jubail Mangrove Park is described by the island as Abu Dhabi emirate’s first self-contained educational, nature and leisure destination of its kind."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Jubail Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Marfaa Al Jubail",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "marfaa al jubail"
        },
        {
          "enabled": true,
          "name": "Nad Al Jubail",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "nad al jubail"
        },
        {
          "enabled": true,
          "name": "Seef Al Jubail",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "seef al jubail"
        },
        {
          "enabled": true,
          "name": "Souk Al Jubail",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "souk al jubail"
        },
        {
          "enabled": true,
          "name": "Ain Al Maha",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "ain al maha"
        },
        {
          "enabled": true,
          "name": "Bada Al Jubail",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "bada al jubail"
        }
      ],
      "footnote": "Jubail Island’s official FAQ lists six distinct village communities."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale on Jubail Island",
      "intro": "Explore waterfront villas, apartments, townhouses, mansions and premium residential opportunities surrounded by nature.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent on Jubail Island",
      "intro": "Discover available rental properties across Jubail Island’s low-density residential communities.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Naturally Connected",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 15 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 15 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Saadiyat Island",
          "time": "neighbouring destination",
          "href": "/areas/saadiyat-island"
        },
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "neighbouring destination",
          "href": "/areas/yas-island"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Jubail Island?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Nature-First Living",
          "desc": "Residential communities integrated within mangrove landscapes."
        },
        {
          "enabled": true,
          "name": "Low-Density Environment",
          "desc": "Only around 20% of the island is planned for development."
        },
        {
          "enabled": true,
          "name": "Waterfront Lifestyle",
          "desc": "More than 30 km of waterfront."
        },
        {
          "enabled": true,
          "name": "Privacy & Space",
          "desc": "Large homes, premium plots and carefully planned communities."
        },
        {
          "enabled": true,
          "name": "Outdoor Living",
          "desc": "Extensive walking, cycling, waterfront and nature experiences."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property on Jubail Island?",
      "intro": "Get a free property consultation and explore available waterfront and nature-focused homes.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Jubail Island",
      "intro": null,
      "items": [
        {
          "q": "How large is Jubail Island?",
          "a": "Approximately 40 million sq. m."
        },
        {
          "q": "How many communities are on Jubail Island?",
          "a": "The official masterplan contains six distinct villages."
        },
        {
          "q": "What properties are available?",
          "a": "Property options include villas, townhouses, apartments, mansions and residential plots across different parts of the island."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property on Jubail Island",
      "intro": "Discover premium homes surrounded by nature with Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/masdar-city',
  'Masdar City (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Masdar City",
      "intro": "A pioneering sustainable urban community designed around low-carbon living, innovation, walkability and green spaces. It combines residential neighbourhoods with a major business and technology ecosystem focused on sustainability and clean energy.",
      "position": "Located 20 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Modern architectural image showing Masdar City’s distinctive buildings, shaded streets, green spaces and sustainable urban design."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Masdar City Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 1,687 / sq. ft.",
          "label": "Property Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+30.64%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 129 / sq. ft.",
          "label": "Property Rental Index"
        },
        {
          "enabled": true,
          "value": "+13.13%",
          "label": "12-Month Rental Index Change"
        },
        {
          "enabled": true,
          "value": "40% Less Energy & Water",
          "label": "Sustainability Performance"
        }
      ],
      "footnote": "Market data: June 2026. Masdar City states that its buildings use approximately 40% less energy and water than comparable buildings."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Masdar City on the map.",
      "intro": null,
      "detail": "Located close to Zayed International Airport with direct access toward Yas Island and central Abu Dhabi."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Landmarks & Attractions",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Masdar Park",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "masdar park",
          "href": null
        },
        {
          "enabled": true,
          "name": "Masdar City Visitor Center",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "masdar city visitor center",
          "href": null
        },
        {
          "enabled": true,
          "name": "Mohamed bin Zayed University of Artificial Intelligence",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mohamed bin zayed university of artificial intelligence",
          "href": null
        },
        {
          "enabled": true,
          "name": "IRENA Headquarters",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "irena headquarters",
          "href": null
        },
        {
          "enabled": true,
          "name": "Sustainable Urban District",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "sustainable urban district",
          "href": null
        },
        {
          "enabled": true,
          "name": "Innovation & Technology Hub",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "innovation & technology hub",
          "href": null
        }
      ],
      "footnote": "Masdar City positions itself as both a sustainable urban community and a global business and technology hub."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Masdar City",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "The Gate",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the gate"
        },
        {
          "enabled": true,
          "name": "Oasis Residences",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "oasis residences"
        },
        {
          "enabled": true,
          "name": "Leonardo Residences",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "leonardo residences"
        },
        {
          "enabled": true,
          "name": "Royal Park",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "royal park"
        }
      ],
      "footnote": "These developments appear among Masdar City’s current residential sale and rental market activity."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Masdar City",
      "intro": "Explore apartments and residential opportunities within Abu Dhabi’s leading sustainability-focused urban community.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Masdar City",
      "intro": "Find rental properties combining modern urban living with convenient airport and business connectivity.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Strategically Connected",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 5 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 20 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Dubai",
          "time": "approx. 45 min",
          "href": null
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Masdar City?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Sustainable Living",
          "desc": "Energy-efficient urban design and environmentally conscious buildings."
        },
        {
          "enabled": true,
          "name": "Innovation Hub",
          "desc": "Home to technology, research and international organisations."
        },
        {
          "enabled": true,
          "name": "Airport Connectivity",
          "desc": "Only minutes from Zayed International Airport."
        },
        {
          "enabled": true,
          "name": "Modern Residential Market",
          "desc": "Growing selection of ready and off-plan properties."
        },
        {
          "enabled": true,
          "name": "Walkable Environment",
          "desc": "Shaded streets, public spaces and sustainable mobility form part of the city’s design approach."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Masdar City?",
      "intro": "Get a free property consultation and explore available residential and investment opportunities.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Masdar City",
      "intro": null,
      "items": [
        {
          "q": "What is Masdar City known for?",
          "a": "It is internationally recognised for sustainable urban development, clean technology, innovation and research."
        },
        {
          "q": "How sustainable are its buildings?",
          "a": "Masdar City states that its buildings use around 40% less energy and water than comparable buildings."
        },
        {
          "q": "How close is Masdar City to the airport?",
          "a": "Approximately five minutes from Zayed International Airport."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Masdar City",
      "intro": "Explore sustainable urban living and property opportunities with Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/khalifa-city',
  'Khalifa City (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Khalifa City",
      "intro": "An established suburban community known for spacious homes, a relaxed family-friendly environment, international schools and convenient access to major highways, Yas Island and Zayed International Airport.",
      "position": "Located 25 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "A wide residential view highlighting villas, greenery, quiet streets and Khalifa City’s spacious low-rise character."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Khalifa City Property Market at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "AED 952 / sq. ft.",
          "label": "Property Sale Price Index"
        },
        {
          "enabled": true,
          "value": "+5.73%",
          "label": "12-Month Sale Index Change"
        },
        {
          "enabled": true,
          "value": "AED 53 / sq. ft.",
          "label": "Property Rental Index"
        },
        {
          "enabled": true,
          "value": "+12.10%",
          "label": "12-Month Rental Index Change"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Khalifa City on the map.",
      "intro": null,
      "detail": "A well-connected suburban location positioned close to Zayed International Airport, Masdar City and the main routes towards Yas Island and central Abu Dhabi."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Landmarks & Attractions",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Al Forsan International Sports Resort",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al forsan international sports resort",
          "href": null
        },
        {
          "enabled": true,
          "name": "Abu Dhabi Golf Club",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "abu dhabi golf club",
          "href": null
        },
        {
          "enabled": true,
          "name": "Golf & Sports Facilities",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "golf & sports facilities",
          "href": null
        },
        {
          "enabled": true,
          "name": "Equestrian Facilities",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "equestrian facilities",
          "href": null
        },
        {
          "enabled": true,
          "name": "Cycling & Recreation",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "cycling & recreation",
          "href": null
        }
      ],
      "footnote": "Al Forsan occupies approximately 1.6 sq. km in Khalifa City, while Abu Dhabi Golf Club spans around 162 hectares."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Khalifa City",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Al Forsan Village",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al forsan village"
        },
        {
          "enabled": true,
          "name": "Al Rayyana",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al rayyana"
        },
        {
          "enabled": true,
          "name": "Reportage Village Abu Dhabi",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "reportage village abu dhabi"
        },
        {
          "enabled": true,
          "name": "Established Villa Communities",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "established villa communities"
        }
      ],
      "footnote": "Al Forsan Village appears among current Khalifa City sale activity, while Al Rayyana is prominent within the apartment rental market."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Khalifa City",
      "intro": "Explore spacious villas, apartments and residential opportunities across Khalifa City.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Khalifa City",
      "intro": "Discover rental homes across one of Abu Dhabi’s established suburban residential destinations.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Conveniently Connected",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 10 min from the Al Forsan area",
          "href": null
        },
        {
          "enabled": true,
          "name": "Masdar City",
          "time": "nearby",
          "href": "/areas/masdar-city"
        },
        {
          "enabled": true,
          "name": "Al Raha Beach",
          "time": "easy access",
          "href": "/areas/al-raha-beach"
        },
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "easy access",
          "href": "/areas/yas-island"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Khalifa City?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Space",
          "desc": "A strong selection of larger villas and family homes."
        },
        {
          "enabled": true,
          "name": "Established Community",
          "desc": "Mature residential neighbourhoods and everyday services."
        },
        {
          "enabled": true,
          "name": "Family Lifestyle",
          "desc": "A quieter suburban setting away from the dense city centre."
        },
        {
          "enabled": true,
          "name": "Sports & Recreation",
          "desc": "Close to Al Forsan and Abu Dhabi Golf Club."
        },
        {
          "enabled": true,
          "name": "Airport Connectivity",
          "desc": "Convenient access to Zayed International Airport."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Khalifa City?",
      "intro": "Get a free property consultation and find a home that matches your requirements.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Khalifa City",
      "intro": null,
      "items": [
        {
          "q": "What is Khalifa City known for?",
          "a": "It is an established suburban residential area known for spacious homes and convenient airport connectivity."
        },
        {
          "q": "What types of properties are available?",
          "a": "The market is strongly villa-oriented but also includes apartments and newer residential developments. Current Bayut index data covers both apartments and villas."
        },
        {
          "q": "What major attractions are nearby?",
          "a": "Al Forsan International Sports Resort and Abu Dhabi Golf Club are both located in Khalifa City."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Khalifa City",
      "intro": "Explore spacious homes for sale and rent with trusted property guidance from Bazar Real Estate.",
      "cta_label": "Explore Properties",
      "cta_href": null,
      "cta2_label": "Get a Free Consultation",
      "cta2_href": null
    }
  },
  {
    "key": "schools",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "reports",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "valuation",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "lifestyle",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "advisors",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  },
  {
    "key": "similar",
    "enabled": false,
    "values": {
      "heading": null,
      "intro": null
    }
  }
]$doc$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  blocks = excluded.blocks,
  updated_at = now();
