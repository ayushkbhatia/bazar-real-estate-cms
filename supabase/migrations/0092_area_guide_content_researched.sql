-- 0092_area_guide_content_researched.sql
-- Per-area copy for the thirteen areas the content deck does not cover.
--
-- Companion to 0091. Same thirteen-band structure, same storage, same
-- editability — the difference is provenance: this copy was researched and
-- written rather than supplied, so it is deliberately more conservative.
--
-- Specifically, **no market index figures**. The deck's areas carry sale and
-- rental indices with the month they belong to; those are third-party index
-- data, and inventing an equivalent for Corniche or Mussafah would put a
-- fabricated number on a page that reads as authoritative. Where an area has a
-- published structural figure instead — KEZAD's 550 sq. km, Hidd Al Saadiyat's
-- 464 villas, Zayed City's 370,000 planned residents — the statistics band
-- carries that. Where it has neither, the band is left empty and hides itself.
-- Supplying index data for these areas later is a CMS edit, not a code change.
--
-- Covers the seven remaining top-level areas (Al Raha, ADGM, Corniche, Zayed
-- City, Mussafah, KIZAD, Nurai Island) and the six sub-communities that have
-- their own guide page (Al Raha Gardens, Hidd Al Saadiyat, Mamsha Al Saadiyat,
-- Saadiyat Lagoons, Saadiyat Reserve, Yas Acres). Together with 0091 that is
-- every row in `areas` bar the `abu-dhabi` emirate itself, which is a
-- hierarchy root rather than a guide.
--
-- Idempotent, on the same terms as 0091.

insert into public.pages (slug, title, status, blocks)
values (
  'subpage/area/al-raha',
  'Al Raha (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Al Raha",
      "intro": "An established mainland district on Abu Dhabi’s eastern waterfront, bringing together the waterfront apartments of Al Raha Beach, the gated villa precincts of Al Raha Gardens and a mature spread of schools, retail and workplaces along the Sheikh Zayed Bin Sultan Street corridor.",
      "position": "Located approximately 20 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Wide aerial across the Al Raha corridor showing the beachfront blocks, the marina channel, Aldar HQ and the villa precincts inland."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Al Raha Property Market at a Glance",
      "intro": null,
      "stats": [],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Al Raha on the map.",
      "intro": null,
      "detail": "A mainland district on the eastern edge of the city, positioned between central Abu Dhabi, Khalifa City and the crossing to Yas Island."
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
          "name": "Al Raha Mall",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al raha mall",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Raha Beach Promenade",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al raha beach promenade",
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
          "name": "Al Raha Gardens Community Parks",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al raha gardens community parks",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Island Crossing",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas island crossing",
          "href": null
        }
      ],
      "footnote": "Aldar’s circular headquarters on Al Raha Beach is one of the most recognisable buildings on the Abu Dhabi coastline."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Al Raha",
      "intro": "Al Raha is read as two halves — waterfront apartments on the channel, gated villas inland.",
      "items": [
        {
          "enabled": true,
          "name": "Al Raha Beach",
          "desc": "Waterfront apartments, townhouses and sky villas along the channel.",
          "href": "/areas/al-raha-beach",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al raha beach"
        },
        {
          "enabled": true,
          "name": "Al Raha Gardens",
          "desc": "Gated villa precincts built around parks and community centres.",
          "href": "/areas/al-raha-gardens",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al raha gardens"
        },
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
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Al Raha",
      "intro": "Explore waterfront apartments, townhouses and family villas across the Al Raha communities.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Al Raha",
      "intro": "Discover rental homes across one of Abu Dhabi’s most established eastern-corridor districts.",
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
          "time": "approx. 15 min",
          "href": "/areas/yas-island"
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 15 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Khalifa City",
          "time": "approx. 10 min",
          "href": "/areas/khalifa-city"
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 25 min",
          "href": null
        }
      ],
      "footnote": "Travel times vary by exact location within the district and by traffic."
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Al Raha?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Two Ways to Live",
          "desc": "Waterfront apartments on the beach side, gated villas in the gardens."
        },
        {
          "enabled": true,
          "name": "Established Community",
          "desc": "Mature retail, schools, clinics and community facilities."
        },
        {
          "enabled": true,
          "name": "Eastern Corridor Position",
          "desc": "Between central Abu Dhabi, the airport and Yas Island."
        },
        {
          "enabled": true,
          "name": "Ready Stock",
          "desc": "A deep resale and rental market rather than a construction site."
        },
        {
          "enabled": true,
          "name": "Waterfront Access",
          "desc": "Private beaches, promenades and marina frontage."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Al Raha?",
      "intro": "Get a free property consultation and discover available homes across the Al Raha communities.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Al Raha",
      "intro": null,
      "items": [
        {
          "q": "What is the difference between Al Raha Beach and Al Raha Gardens?",
          "a": "Al Raha Beach is the waterfront half — apartments, townhouses and sky villas in low-rise blocks along the channel. Al Raha Gardens is the inland half — gated precincts of family villas and townhouses built around parks."
        },
        {
          "q": "What properties are available in Al Raha?",
          "a": "Apartments, townhouses, villas and sky villas, almost all of it ready stock rather than off-plan."
        },
        {
          "q": "Is Al Raha close to the airport?",
          "a": "Yes. Zayed International Airport is roughly 15 minutes away, and Yas Island is a similar distance."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Al Raha",
      "intro": "Explore waterfront and gated-community homes with Bazar Real Estate.",
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
  'subpage/area/adgm',
  'ADGM (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "ADGM",
      "intro": "Abu Dhabi Global Market is the emirate’s international financial centre — an English common-law jurisdiction with its own courts and regulator, spanning Al Maryah Island and, since the 2023 expansion, the whole of Al Reem Island. For residents it means a workplace district with two of Abu Dhabi’s densest residential markets built directly around it.",
      "position": "Al Maryah and Al Reem islands, approximately 10 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Skyline image of ADGM Square on Al Maryah Island with the towers, the promenade and Al Reem beyond."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "ADGM at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "1,438 hectares",
          "label": "Combined Financial District Area"
        },
        {
          "enabled": true,
          "value": "2 Islands",
          "label": "Al Maryah & Al Reem"
        },
        {
          "enabled": true,
          "value": "2023",
          "label": "Year the Jurisdiction Expanded to Al Reem"
        }
      ],
      "footnote": "Figures published by ADGM on the expansion of its jurisdiction. Businesses on Al Reem Island transitioned to ADGM licensing by the end of 2024."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find ADGM on the map.",
      "intro": null,
      "detail": "Centred on Al Maryah Island and extending across Al Reem Island, immediately east of Downtown Abu Dhabi."
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
          "name": "ADGM Square",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "adgm square",
          "href": null
        },
        {
          "enabled": true,
          "name": "ADGM Courts",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "adgm courts",
          "href": null
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
          "name": "Reem Mall",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "reem mall",
          "href": null
        }
      ],
      "footnote": "The expansion created one of the largest concentrated financial districts in the world by area."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Where to Live Around ADGM",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Al Maryah Island",
          "desc": "Branded residences and premium apartments beside ADGM Square.",
          "href": "/areas/al-maryah",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al maryah island"
        },
        {
          "enabled": true,
          "name": "Al Reem Island",
          "desc": "The deepest apartment market within the jurisdiction.",
          "href": "/areas/al-reem-island",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al reem island"
        },
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
          "name": "Reem Hills",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "reem hills"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in the ADGM District",
      "intro": "Explore apartments and branded residences within Abu Dhabi’s international financial district.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in the ADGM District",
      "intro": "Find rental homes within walking or short-drive distance of ADGM Square.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "At the Heart of the City",
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
          "name": "Al Reem Island",
          "time": "adjacent",
          "href": "/areas/al-reem-island"
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
      "heading": "Why Choose ADGM?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Financial Centre",
          "desc": "An English common-law jurisdiction with its own courts and regulator."
        },
        {
          "enabled": true,
          "name": "Walk to Work",
          "desc": "Two dense residential islands built around the business district."
        },
        {
          "enabled": true,
          "name": "Premium Amenity",
          "desc": "The Galleria, Cleveland Clinic and the waterfront promenade on the doorstep."
        },
        {
          "enabled": true,
          "name": "Tenant Demand",
          "desc": "A concentrated professional workforce underpinning rental demand."
        },
        {
          "enabled": true,
          "name": "Expanding Footprint",
          "desc": "The 2023 expansion to Al Reem multiplied the district’s area tenfold."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property Near ADGM?",
      "intro": "Get a free property consultation on living or investing within Abu Dhabi’s financial district.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About ADGM",
      "intro": null,
      "items": [
        {
          "q": "What is ADGM?",
          "a": "Abu Dhabi Global Market is the emirate’s international financial centre — a free zone with its own English common-law framework, courts and financial regulator."
        },
        {
          "q": "Where is ADGM located?",
          "a": "It covers Al Maryah Island and, following a 2023 UAE Cabinet resolution, the whole of Al Reem Island."
        },
        {
          "q": "Can you live inside the ADGM jurisdiction?",
          "a": "Yes. Al Maryah and Al Reem are both residential islands, offering apartments, branded residences and newer townhouse and villa communities."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property Near ADGM",
      "intro": "Explore homes inside Abu Dhabi’s financial district with Bazar Real Estate.",
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
  'subpage/area/corniche',
  'Corniche (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Corniche",
      "intro": "Abu Dhabi’s waterfront address — a landscaped promenade and Blue Flag beach running the length of the city’s north-western shore, backed by a wall of established residential towers with sea views, and within walking distance of the central business district.",
      "position": "Central Abu Dhabi, along the city’s north-western waterfront."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Corniche promenade at golden hour with the beach in the foreground and the residential and office towers behind."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "The Corniche at a Glance",
      "intro": null,
      "stats": [],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Corniche on the map.",
      "intro": null,
      "detail": "Running along the north-western edge of Abu Dhabi island, with Al Markaziyah, Al Khalidiyah and Al Bateen immediately behind it."
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
          "name": "Corniche Beach",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "corniche beach",
          "href": null
        },
        {
          "enabled": true,
          "name": "Corniche Promenade",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "corniche promenade",
          "href": null
        },
        {
          "enabled": true,
          "name": "Emirates Palace",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "emirates palace",
          "href": null
        },
        {
          "enabled": true,
          "name": "Etihad Towers",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "etihad towers",
          "href": null
        },
        {
          "enabled": true,
          "name": "Marina Mall",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "marina mall",
          "href": null
        },
        {
          "enabled": true,
          "name": "Lulu Island",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "lulu island",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Khalidiyah Park",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al khalidiyah park",
          "href": null
        }
      ],
      "footnote": "Corniche Beach holds Blue Flag certification and is one of the few places in the city where you can live directly on a public beach."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Living on the Corniche",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Al Markaziyah",
          "desc": "Central towers within walking distance of the business district.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al markaziyah"
        },
        {
          "enabled": true,
          "name": "Al Khalidiyah",
          "desc": "An upscale, walkable stretch of cafés and residential towers.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al khalidiyah"
        },
        {
          "enabled": true,
          "name": "Al Bateen",
          "desc": "Lower-rise, quieter, with the marina and private schools.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al bateen"
        },
        {
          "enabled": true,
          "name": "Corniche Road Towers",
          "desc": "Sea-facing apartments directly on the waterfront.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "corniche road towers"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale on the Corniche",
      "intro": "Explore sea-facing apartments and central city residences along Abu Dhabi’s waterfront.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent on the Corniche",
      "intro": "Find rental apartments with beach and skyline frontage in the heart of the city.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "In the Heart of the City",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "walking distance",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Maryah Island",
          "time": "approx. 10 min",
          "href": "/areas/al-maryah"
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
          "time": "approx. 35 min",
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
      "heading": "Why Choose Corniche?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Beachfront in the City",
          "desc": "A Blue Flag public beach at the foot of the towers."
        },
        {
          "enabled": true,
          "name": "Walkable Central Living",
          "desc": "Offices, government, retail and dining within walking distance."
        },
        {
          "enabled": true,
          "name": "Sea Views",
          "desc": "One of the few residential stretches with uninterrupted Gulf frontage."
        },
        {
          "enabled": true,
          "name": "Established Rental Market",
          "desc": "Deep, liquid tenant demand across studios to four-bedroom apartments."
        },
        {
          "enabled": true,
          "name": "Everyday Convenience",
          "desc": "Parks, schools, clinics and malls already in place."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property on the Corniche?",
      "intro": "Get a free property consultation on waterfront apartments in central Abu Dhabi.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Corniche",
      "intro": null,
      "items": [
        {
          "q": "What kind of properties are on the Corniche?",
          "a": "Almost entirely apartments, from studios to four-bedroom units, in established residential towers. Villas are rare on this stretch."
        },
        {
          "q": "Is the Corniche beach public?",
          "a": "Yes. Corniche Beach is a Blue Flag certified public beach with both free and paid sections along the promenade."
        },
        {
          "q": "Which neighbourhoods sit behind the Corniche?",
          "a": "Al Markaziyah, Al Khalidiyah and Al Bateen run behind the waterfront, each with its own character and price point."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property on the Corniche",
      "intro": "Explore waterfront apartments in central Abu Dhabi with Bazar Real Estate.",
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
  'subpage/area/zayed-city',
  'Zayed City (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Zayed City",
      "intro": "A major master-planned district being developed as an important new urban centre for Abu Dhabi, combining residential neighbourhoods, federal government institutions, open spaces and future mixed-use destinations under Plan Abu Dhabi 2030.",
      "position": "Located approximately 25 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Masterplan-scale aerial or render showing Zayed City’s civic spine, residential districts and landscaped public realm."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Zayed City at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "4,900+ hectares",
          "label": "Masterplan Area"
        },
        {
          "enabled": true,
          "value": "370,000+",
          "label": "Planned Residents"
        },
        {
          "enabled": true,
          "value": "Plan 2030",
          "label": "Framework Behind the District"
        }
      ],
      "footnote": "Masterplan figures published for the Zayed City capital district. Residential index data is not yet meaningful for a district still being delivered."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Zayed City on the map.",
      "intro": null,
      "detail": "Positioned inland between Mohammed Bin Zayed City and Zayed International Airport, on the mainland side of the city."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "District Highlights",
      "intro": "Zayed City is a masterplan in delivery rather than a landmark-led destination — these are the anchors it is being built around.",
      "items": [
        {
          "enabled": true,
          "name": "Government Precinct",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "government precinct",
          "href": null
        },
        {
          "enabled": true,
          "name": "Civic & Cultural Spine",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "civic & cultural spine",
          "href": null
        },
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
          "name": "Community Retail Centres",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "community retail centres",
          "href": null
        },
        {
          "enabled": true,
          "name": "Planned Rail & Metro Corridor",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "planned rail & metro corridor",
          "href": null
        }
      ],
      "footnote": "The masterplan is designed around an integrated transport system taking in regional rail, metro, tram and bus networks."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Zayed City",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Bloom Living",
          "desc": "A walkable, Mediterranean-styled masterplan of villas and townhouses.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "bloom living"
        },
        {
          "enabled": true,
          "name": "Zayed City Residential Districts",
          "desc": "Mixed-density housing from family villas to mid-rise apartments.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "zayed city residential districts"
        },
        {
          "enabled": true,
          "name": "Government Precinct",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "government precinct"
        },
        {
          "enabled": true,
          "name": "Commercial Districts",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "commercial districts"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Zayed City",
      "intro": "Explore villas, townhouses and apartments across Abu Dhabi’s emerging capital district.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Zayed City",
      "intro": "Discover rental homes in a district being delivered in phases.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": "Looking to rent in Zayed City? Speak with our team about current and upcoming availability as new phases hand over."
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
          "time": "approx. 15 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Masdar City",
          "time": "approx. 15 min",
          "href": "/areas/masdar-city"
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 25 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "approx. 25 min",
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
      "heading": "Why Choose Zayed City?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Capital District",
          "desc": "Planned as a federal administrative centre alongside its residential districts."
        },
        {
          "enabled": true,
          "name": "Masterplan Scale",
          "desc": "More than 4,900 hectares, planned for over 370,000 residents."
        },
        {
          "enabled": true,
          "name": "Early-Stage Pricing",
          "desc": "Entry points below the established island markets."
        },
        {
          "enabled": true,
          "name": "Planned Transit",
          "desc": "Designed around rail, metro, tram and bus connectivity."
        },
        {
          "enabled": true,
          "name": "Family Formats",
          "desc": "Villas and townhouses alongside mid-rise apartments."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Zayed City?",
      "intro": "Get a free property consultation and explore opportunities in Abu Dhabi’s emerging capital district.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Zayed City",
      "intro": null,
      "items": [
        {
          "q": "Where is Zayed City?",
          "a": "It sits inland between Mohammed Bin Zayed City and Zayed International Airport, on the mainland side of Abu Dhabi."
        },
        {
          "q": "How large is the Zayed City masterplan?",
          "a": "The district spans more than 4,900 hectares and is planned to accommodate over 370,000 residents."
        },
        {
          "q": "What properties are available?",
          "a": "Mixed-density housing — family villas and townhouses alongside mid-rise apartments — with communities such as Bloom Living already delivering."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Zayed City",
      "intro": "Explore Abu Dhabi’s emerging capital district with Bazar Real Estate.",
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
  'subpage/area/mussafah',
  'Mussafah (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Mussafah",
      "intro": "Abu Dhabi’s largest industrial and light-manufacturing district, with two established residential clusters — Shabiya and Mussafah Gardens — built alongside it. It is the most affordable mainland entry point into the Abu Dhabi apartment market, and the workplace for a large share of the city.",
      "position": "Located approximately 25 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Wide view over Mussafah’s residential blocks and the industrial corridor beyond, taken toward the city."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Mussafah Property Market at a Glance",
      "intro": null,
      "stats": [],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Mussafah on the map.",
      "intro": null,
      "detail": "On the mainland south of Abu Dhabi island, along the Mussafah and Sheikh Rashid Bin Saeed corridors toward Mohammed Bin Zayed City."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "District Highlights",
      "intro": "Mussafah is a working district rather than a landmark-led one — these are the anchors residents use.",
      "items": [
        {
          "enabled": true,
          "name": "Mussafah Industrial Area",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mussafah industrial area",
          "href": null
        },
        {
          "enabled": true,
          "name": "Shabiya Community Centres",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "shabiya community centres",
          "href": null
        },
        {
          "enabled": true,
          "name": "Mussafah Gardens",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mussafah gardens",
          "href": null
        },
        {
          "enabled": true,
          "name": "Community Parks & Playgrounds",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "community parks & playgrounds",
          "href": null
        },
        {
          "enabled": true,
          "name": "Mussafah Bridge",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mussafah bridge",
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
      "heading": "Explore Mussafah",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Shabiya",
          "desc": "The main residential cluster, with Shabiya 9 among its most established sectors.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "shabiya"
        },
        {
          "enabled": true,
          "name": "Mussafah Gardens",
          "desc": "Low-rise residential blocks with everyday retail and schools.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mussafah gardens"
        },
        {
          "enabled": true,
          "name": "Mussafah East (ME Sectors)",
          "desc": "Planned sectors bordering Mohammed Bin Zayed City.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mussafah east me sectors"
        },
        {
          "enabled": true,
          "name": "Mussafah Industrial Sectors",
          "desc": "Warehousing, workshops and light manufacturing.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mussafah industrial sectors"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Mussafah",
      "intro": "Explore apartments and commercial and industrial property across Mussafah.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Mussafah",
      "intro": "Find affordable rental apartments in one of Abu Dhabi’s most practical mainland districts.",
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
          "name": "Mohammed Bin Zayed City",
          "time": "adjacent",
          "href": null
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 25 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 25 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Khalifa City",
          "time": "approx. 20 min",
          "href": "/areas/khalifa-city"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Mussafah?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Affordability",
          "desc": "Among the lowest entry points for apartments on the Abu Dhabi mainland."
        },
        {
          "enabled": true,
          "name": "Live Near Work",
          "desc": "Immediate access to the city’s largest industrial employment base."
        },
        {
          "enabled": true,
          "name": "Established Services",
          "desc": "Supermarkets, schools, clinics and transport already in place."
        },
        {
          "enabled": true,
          "name": "Commercial Stock",
          "desc": "Warehousing, workshops and showroom space alongside the housing."
        },
        {
          "enabled": true,
          "name": "Road Connectivity",
          "desc": "Direct links to the airport, Mohammed Bin Zayed City and the Dubai corridor."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Mussafah?",
      "intro": "Get a free consultation on residential, commercial or industrial property in Mussafah.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Mussafah",
      "intro": null,
      "items": [
        {
          "q": "Is Mussafah residential or industrial?",
          "a": "Both. The industrial sectors are the district’s core, with two established residential clusters — Shabiya and Mussafah Gardens — built alongside them."
        },
        {
          "q": "What properties are available in Mussafah?",
          "a": "Mainly apartments in mid-rise buildings, from compact one-bedroom to three-bedroom layouts, plus a substantial commercial and industrial market."
        },
        {
          "q": "Why do people choose Mussafah?",
          "a": "Affordability and proximity to work. It is one of the cheapest ways into the Abu Dhabi rental market and sits beside the city’s largest employment base."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Mussafah",
      "intro": "Explore homes and commercial space in Mussafah with Bazar Real Estate.",
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
  'subpage/area/kizad',
  'KIZAD (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "KIZAD",
      "intro": "Khalifa Industrial Zone Abu Dhabi, now part of KEZAD Group, is the emirate’s flagship trade, logistics and industrial platform — built beside Khalifa Port and combining free-zone and mainland licensing with purpose-built warehousing, land plots and staff residential communities.",
      "position": "Beside Khalifa Port, approximately 40 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Aerial of the KEZAD industrial estate and Khalifa Port, showing warehousing, plots and the port terminals."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "KEZAD at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "550 sq. km",
          "label": "Total Area Across KEZAD Group"
        },
        {
          "enabled": true,
          "value": "100 sq. km",
          "label": "Designated Free Zone"
        },
        {
          "enabled": true,
          "value": "12",
          "label": "Economic Zones"
        },
        {
          "enabled": true,
          "value": "300,000+ sq. m.",
          "label": "Pre-Built Warehousing"
        }
      ],
      "footnote": "Figures published by KEZAD Group, the AD Ports Group business that now operates KIZAD alongside ZonesCorp and KEZAD Communities."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find KIZAD on the map.",
      "intro": null,
      "detail": "On the Abu Dhabi–Dubai corridor beside Khalifa Port, roughly midway between the two cities."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Zone Highlights",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Khalifa Port",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "khalifa port",
          "href": null
        },
        {
          "enabled": true,
          "name": "KEZAD Free Zone",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "kezad free zone",
          "href": null
        },
        {
          "enabled": true,
          "name": "Pre-Built Warehousing",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "pre-built warehousing",
          "href": null
        },
        {
          "enabled": true,
          "name": "Staff Residential Cities",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "staff residential cities",
          "href": null
        },
        {
          "enabled": true,
          "name": "Logistics & Distribution Parks",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "logistics & distribution parks",
          "href": null
        }
      ],
      "footnote": "KEZAD Group is the largest operator of purpose-built economic zones and workers’ residential cities in the UAE."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Within KEZAD",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "KEZAD Communities",
          "desc": "Purpose-built staff residential cities across more than 40 complexes.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "kezad communities"
        },
        {
          "enabled": true,
          "name": "KEZAD Free Zone",
          "desc": "100 sq. km of designated free-zone land and facilities.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "kezad free zone"
        },
        {
          "enabled": true,
          "name": "Industrial & Logistics Plots",
          "desc": "Serviced land for manufacturing, warehousing and distribution.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "industrial & logistics plots"
        },
        {
          "enabled": true,
          "name": "Khalifa Port Cluster",
          "desc": "Deep-water port frontage and terminal-adjacent operations.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "khalifa port cluster"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Commercial Property for Sale in KIZAD",
      "intro": "Explore warehousing, industrial plots and logistics facilities across the Khalifa Economic Zones.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Commercial Property for Lease in KIZAD",
      "intro": "Find warehousing, workshop and light-industrial space available to lease.",
      "cta_label": "Enquire About Available Space",
      "cta_href": null,
      "empty_body": "Looking for industrial or logistics space in KIZAD? Speak with our commercial team about current and upcoming availability."
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
          "name": "Khalifa Port",
          "time": "adjacent",
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
          "name": "Downtown Abu Dhabi",
          "time": "approx. 40 min",
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
      "heading": "Why Choose KIZAD?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Port-Side Location",
          "desc": "Direct access to Khalifa Port’s deep-water terminals."
        },
        {
          "enabled": true,
          "name": "Dual Licensing",
          "desc": "Free-zone and mainland options within one integrated platform."
        },
        {
          "enabled": true,
          "name": "Built Stock",
          "desc": "More than 300,000 sq. m. of pre-built warehousing ready to occupy."
        },
        {
          "enabled": true,
          "name": "Workforce Housing",
          "desc": "Purpose-built staff residential cities on the same estate."
        },
        {
          "enabled": true,
          "name": "Corridor Position",
          "desc": "Roughly midway between Abu Dhabi and Dubai on the main freight route."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for Space in KIZAD?",
      "intro": "Get a free consultation on industrial, logistics and warehousing opportunities across the Khalifa Economic Zones.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About KIZAD",
      "intro": null,
      "items": [
        {
          "q": "What is the difference between KIZAD and KEZAD?",
          "a": "KIZAD is the original Khalifa Industrial Zone, opened in 2012. KEZAD Group, launched in 2022 by AD Ports Group, is the wider platform that now operates KIZAD alongside ZonesCorp and KEZAD Communities."
        },
        {
          "q": "Is there residential property in KIZAD?",
          "a": "The zone’s housing is purpose-built staff accommodation operated by KEZAD Communities rather than an open residential sale market."
        },
        {
          "q": "What kind of property is available?",
          "a": "Serviced industrial land plots, pre-built warehousing, workshop and logistics facilities, on free-zone or mainland terms."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Space in KIZAD",
      "intro": "Explore industrial and logistics opportunities with Bazar Real Estate.",
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
  'subpage/area/nurai-island',
  'Nurai Island (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Nurai Island",
      "intro": "A private island off the northern shore of Saadiyat, developed by Zaya as a boutique resort with a small collection of beachfront estates and water villas around it. It is the most exclusive residential address in Abu Dhabi — measured in dozens of homes rather than thousands.",
      "position": "A private island off Saadiyat Island, reached by a short boat transfer."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Aerial of Nurai Island showing the water villas on their piers, the beachfront estates and the turquoise shallows around the island."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Nurai Island at a Glance",
      "intro": null,
      "stats": [],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Nurai Island on the map.",
      "intro": null,
      "detail": "Positioned in the Arabian Gulf immediately off Saadiyat Island, accessed by boat from the Saadiyat shore."
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
          "name": "Zaya Nurai Island Resort",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "zaya nurai island resort",
          "href": null
        },
        {
          "enabled": true,
          "name": "Beach Club",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "beach club",
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
          "name": "Island Spa",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "island spa",
          "href": null
        },
        {
          "enabled": true,
          "name": "Resort Restaurants",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "resort restaurants",
          "href": null
        },
        {
          "enabled": true,
          "name": "Water Sports Centre",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "water sports centre",
          "href": null
        }
      ],
      "footnote": "Villa owners have access to the resort’s five-star facilities and services, from dining to wellness and water sports."
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Explore Nurai Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Water Villas",
          "desc": "Four-bedroom villas on the water, around 10,000 sq. ft.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "water villas"
        },
        {
          "enabled": true,
          "name": "Beachfront Estates",
          "desc": "Four- to six-bedroom mansions with large plots and direct beach access.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "beachfront estates"
        },
        {
          "enabled": true,
          "name": "Zaya Nurai Resort Villas",
          "desc": "Resort-serviced residences on the island.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "zaya nurai resort villas"
        }
      ],
      "footnote": "The island is developed by Zaya, a boutique UAE developer founded in 2008 and specialising in ultra-prime real estate."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale on Nurai Island",
      "intro": "Explore water villas and beachfront estates on Abu Dhabi’s most exclusive private island.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent on Nurai Island",
      "intro": "Rental availability on Nurai Island is extremely limited and rarely advertised.",
      "cta_label": "Enquire About Availability",
      "cta_href": null,
      "empty_body": "Rental availability on Nurai Island is extremely limited and rarely advertised. Speak with our team about what is quietly available."
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "Naturally Secluded",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Saadiyat Island",
          "time": "short boat transfer",
          "href": "/areas/saadiyat-island"
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 25 min from the mainland jetty",
          "href": null
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 35 min from the mainland jetty",
          "href": null
        }
      ],
      "footnote": "Access is by boat from Saadiyat; road times are measured from the mainland jetty."
    }
  },
  {
    "key": "why",
    "enabled": true,
    "values": {
      "heading": "Why Choose Nurai Island?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Absolute Privacy",
          "desc": "A private island with a residential community measured in dozens of homes."
        },
        {
          "enabled": true,
          "name": "Resort Services",
          "desc": "Owners draw on the five-star resort’s staffing, dining and wellness."
        },
        {
          "enabled": true,
          "name": "Direct Water Frontage",
          "desc": "Water villas on piers and estates with private beach access."
        },
        {
          "enabled": true,
          "name": "Scarcity",
          "desc": "A closed collection — supply cannot expand."
        },
        {
          "enabled": true,
          "name": "Minutes from Saadiyat",
          "desc": "Seclusion without leaving the cultural and beach district behind."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property on Nurai Island?",
      "intro": "Get a free, discreet consultation on availability across Abu Dhabi’s private island market.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Nurai Island",
      "intro": null,
      "items": [
        {
          "q": "Where is Nurai Island?",
          "a": "It sits in the Arabian Gulf just off Saadiyat Island, reached by a short boat transfer from the Saadiyat shore."
        },
        {
          "q": "What properties are available on Nurai Island?",
          "a": "Four-bedroom water villas and four- to six-bedroom beachfront estates, developed by Zaya."
        },
        {
          "q": "Who developed Nurai Island?",
          "a": "Zaya, a boutique UAE developer founded in 2008 that specialises in ultra-prime residential property."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property on Nurai Island",
      "intro": "Explore Abu Dhabi’s private island market with Bazar Real Estate.",
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
  'subpage/area/al-raha-gardens',
  'Al Raha Gardens (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Al Raha Gardens",
      "intro": "One of Abu Dhabi’s most established gated villa communities, developed by Aldar across eleven residential precincts of townhouses and family villas built around parks, community centres and a mature school and retail offering.",
      "position": "Within Al Raha, approximately 20 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Street-level or low aerial view of Al Raha Gardens showing villa rooftops, mature landscaping and the community parks."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Al Raha Gardens at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "665,000+ sq. m.",
          "label": "Community Area"
        },
        {
          "enabled": true,
          "value": "11",
          "label": "Residential Precincts"
        },
        {
          "enabled": true,
          "value": "Freehold",
          "label": "Tenure for Eligible Buyers"
        }
      ],
      "footnote": "Community figures published by Aldar. Tenure varies by buyer nationality — your advisor will confirm eligibility."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Al Raha Gardens on the map.",
      "intro": null,
      "detail": "Inland from Al Raha Beach, off Sheikh Zayed Bin Sultan Street, between central Abu Dhabi and Khalifa City."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Community Highlights",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Al Raha Gardens Community Centre",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al raha gardens community centre",
          "href": null
        },
        {
          "enabled": true,
          "name": "Community Parks",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "community parks",
          "href": null
        },
        {
          "enabled": true,
          "name": "Swimming Pools & Clubhouses",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "swimming pools & clubhouses",
          "href": null
        },
        {
          "enabled": true,
          "name": "Al Raha Mall",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al raha mall",
          "href": null
        },
        {
          "enabled": true,
          "name": "Nearby International Schools",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "nearby international schools",
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
      "heading": "The Precincts",
      "intro": "Eleven gated precincts, each with its own character and villa mix.",
      "items": [
        {
          "enabled": true,
          "name": "Khannour",
          "desc": "Three and four-bedroom townhouses; three to five-bedroom villas.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "khannour"
        },
        {
          "enabled": true,
          "name": "Sidra",
          "desc": "Three to five-bedroom villas with Arabesque detailing and private terraces.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "sidra"
        },
        {
          "enabled": true,
          "name": "Yasmina",
          "desc": "Three to six-bedroom villas with pool, clubhouse and community centre.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yasmina"
        },
        {
          "enabled": true,
          "name": "Muzera",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "muzera"
        },
        {
          "enabled": true,
          "name": "Al Mariah",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al mariah"
        },
        {
          "enabled": true,
          "name": "Samra",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "samra"
        },
        {
          "enabled": true,
          "name": "Qattouf",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "qattouf"
        },
        {
          "enabled": true,
          "name": "Hemaim",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "hemaim"
        },
        {
          "enabled": true,
          "name": "Al Tharwaniyah",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al tharwaniyah"
        },
        {
          "enabled": true,
          "name": "Lehwieh",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "lehwieh"
        },
        {
          "enabled": true,
          "name": "Al Ward",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al ward"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Al Raha Gardens",
      "intro": "Explore townhouses and family villas across the eleven Al Raha Gardens precincts.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Al Raha Gardens",
      "intro": "Discover rental villas and townhouses in one of Abu Dhabi’s most established gated communities.",
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
          "name": "Al Raha Beach",
          "time": "approx. 5 min",
          "href": "/areas/al-raha-beach"
        },
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "approx. 15 min",
          "href": "/areas/yas-island"
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 15 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
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
      "heading": "Why Choose Al Raha Gardens?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Gated Family Living",
          "desc": "Eleven precincts of villas and townhouses behind a single gate."
        },
        {
          "enabled": true,
          "name": "Mature Landscaping",
          "desc": "Established parks, walkways and community centres rather than a new build site."
        },
        {
          "enabled": true,
          "name": "Space",
          "desc": "Three to six-bedroom homes with gardens, terraces and multiple parking bays."
        },
        {
          "enabled": true,
          "name": "Schools & Retail",
          "desc": "International schools and Al Raha Mall within a short drive."
        },
        {
          "enabled": true,
          "name": "Ready Market",
          "desc": "A deep resale and rental pool with no construction risk."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Al Raha Gardens?",
      "intro": "Get a free property consultation and find the precinct that fits your family.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Al Raha Gardens",
      "intro": null,
      "items": [
        {
          "q": "How many precincts are there in Al Raha Gardens?",
          "a": "Eleven — Muzera, Al Mariah, Samra, Sidra, Yasmina, Qattouf, Khannour, Hemaim, Al Tharwaniyah, Lehwieh and Al Ward."
        },
        {
          "q": "What properties are available?",
          "a": "Three to six-bedroom villas and three and four-bedroom townhouses, developed by Aldar."
        },
        {
          "q": "Is Al Raha Gardens gated?",
          "a": "Yes. It is a gated community with its own parks, clubhouses, pools and community centres."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Al Raha Gardens",
      "intro": "Explore gated family homes with Bazar Real Estate.",
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
  'subpage/area/hidd-al-saadiyat',
  'Hidd Al Saadiyat (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Hidd Al Saadiyat",
      "intro": "A private beachfront community on the northern shore of Saadiyat Island — a closed collection of large villas across four phases, each with its own pool and direct access to the beach. It is one of the most exclusive addresses on the island.",
      "position": "Northern Saadiyat Island, approximately 15 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Beachfront aerial of Hidd Al Saadiyat showing the villa rows, private pools and the open shoreline in front of them."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Hidd Al Saadiyat at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "464",
          "label": "Villas in the Community"
        },
        {
          "enabled": true,
          "value": "4",
          "label": "Residential Phases"
        },
        {
          "enabled": true,
          "value": "4–7",
          "label": "Bedrooms per Villa"
        },
        {
          "enabled": true,
          "value": "4,678 – 20,171 sq. ft.",
          "label": "Villa Size Range"
        }
      ],
      "footnote": "Community figures published for the Hidd Al Saadiyat masterplan."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Hidd Al Saadiyat on the map.",
      "intro": null,
      "detail": "On the northern shore of Saadiyat Island, next to Saadiyat Marina and a short drive from the Cultural District."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Community Highlights",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Private Beach Access",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "private beach access",
          "href": null
        },
        {
          "enabled": true,
          "name": "Saadiyat Marina",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "saadiyat marina",
          "href": null
        },
        {
          "enabled": true,
          "name": "Community Parks",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "community parks",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yacht Club",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yacht club",
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
        },
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
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "The Phases",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Qaryat Al Hidd",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "qaryat al hidd"
        },
        {
          "enabled": true,
          "name": "Al Suhoul",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al suhoul"
        },
        {
          "enabled": true,
          "name": "Al Seef",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "al seef"
        },
        {
          "enabled": true,
          "name": "Ras Al Hidd",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "ras al hidd"
        }
      ],
      "footnote": "Villas are offered in eight configurations across the four phases, all with a private pool and beach access."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Hidd Al Saadiyat",
      "intro": "Explore large beachfront villas across one of Saadiyat Island’s most private communities.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Hidd Al Saadiyat",
      "intro": "Rental stock in Hidd Al Saadiyat is limited and moves quickly.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": "Rental stock in Hidd Al Saadiyat is limited. Speak with our team about current and upcoming availability."
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "On Saadiyat Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Saadiyat Island",
          "time": "surrounding community",
          "href": "/areas/saadiyat-island"
        },
        {
          "enabled": true,
          "name": "Louvre Abu Dhabi",
          "time": "approx. 10 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 15 min",
          "href": null
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
      "heading": "Why Choose Hidd Al Saadiyat?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Beachfront Villas",
          "desc": "Direct beach access from a closed collection of homes."
        },
        {
          "enabled": true,
          "name": "Scale",
          "desc": "Villas from roughly 4,700 to over 20,000 sq. ft."
        },
        {
          "enabled": true,
          "name": "Privacy",
          "desc": "Four gated phases away from the island’s busier districts."
        },
        {
          "enabled": true,
          "name": "Private Pools",
          "desc": "Every residence has its own pool and covered parking."
        },
        {
          "enabled": true,
          "name": "Cultural District Access",
          "desc": "The Louvre, marina and golf club minutes away."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Hidd Al Saadiyat?",
      "intro": "Get a free property consultation on Saadiyat Island’s beachfront villa market.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Hidd Al Saadiyat",
      "intro": null,
      "items": [
        {
          "q": "How many villas are there in Hidd Al Saadiyat?",
          "a": "The community comprises 464 villas in eight configurations across four phases."
        },
        {
          "q": "What are the four phases?",
          "a": "Qaryat Al Hidd, Al Suhoul, Al Seef and Ras Al Hidd."
        },
        {
          "q": "How large are the villas?",
          "a": "They range from roughly 4,678 sq. ft. to 20,171 sq. ft., with four to seven bedrooms."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Hidd Al Saadiyat",
      "intro": "Explore Saadiyat’s beachfront villa market with Bazar Real Estate.",
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
  'subpage/area/mamsha-al-saadiyat',
  'Mamsha Al Saadiyat (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Mamsha Al Saadiyat",
      "intro": "Saadiyat Island’s beachfront apartment address — a low-rise promenade of one to four-bedroom apartments, townhouses and penthouses opening directly onto the sand, with the Cultural District and its museums a short walk inland.",
      "position": "Saadiyat Cultural District, approximately 15 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Beach-level view along the Mamsha promenade showing the low-rise residences, the boardwalk and the restaurants at ground level."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Mamsha Al Saadiyat at a Glance",
      "intro": null,
      "stats": [],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Mamsha Al Saadiyat on the map.",
      "intro": null,
      "detail": "On the beach in front of the Saadiyat Cultural District, between the Louvre Abu Dhabi and Saadiyat Beach Golf Club."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "On the Doorstep",
      "intro": null,
      "items": [
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
          "name": "The Mamsha Promenade",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the mamsha promenade",
          "href": null
        },
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
          "name": "Soul Beach",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "soul beach",
          "href": null
        },
        {
          "enabled": true,
          "name": "Waterfront Restaurants",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "waterfront restaurants",
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
      "heading": "Living at Mamsha",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Mamsha Al Saadiyat Residences",
          "desc": "One to four-bedroom apartments with Gulf views.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mamsha al saadiyat residences"
        },
        {
          "enabled": true,
          "name": "Mamsha Townhouses",
          "desc": "Ground-level homes opening onto the promenade.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mamsha townhouses"
        },
        {
          "enabled": true,
          "name": "Mamsha Penthouses",
          "desc": "Top-floor residences with terraces over the beach.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mamsha penthouses"
        },
        {
          "enabled": true,
          "name": "Mamsha Gardens",
          "desc": "The newer garden-facing addition to the Mamsha address.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "mamsha gardens"
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Mamsha Al Saadiyat",
      "intro": "Explore beachfront apartments, townhouses and penthouses on Saadiyat’s promenade.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Mamsha Al Saadiyat",
      "intro": "Find rental apartments with direct beach and promenade frontage.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "On Saadiyat Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Louvre Abu Dhabi",
          "time": "walking distance",
          "href": null
        },
        {
          "enabled": true,
          "name": "Saadiyat Island",
          "time": "surrounding community",
          "href": "/areas/saadiyat-island"
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 15 min",
          "href": null
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
      "heading": "Why Choose Mamsha Al Saadiyat?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Beachfront Apartments",
          "desc": "Residences opening straight onto the sand — rare in Abu Dhabi."
        },
        {
          "enabled": true,
          "name": "Cultural District",
          "desc": "The Louvre and Manarat Al Saadiyat within walking distance."
        },
        {
          "enabled": true,
          "name": "Walkable Promenade",
          "desc": "Restaurants, cafés and retail at ground level."
        },
        {
          "enabled": true,
          "name": "Low-Rise Living",
          "desc": "Human-scale blocks rather than towers."
        },
        {
          "enabled": true,
          "name": "Strong Rental Demand",
          "desc": "One of the island’s most consistently let addresses."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Mamsha Al Saadiyat?",
      "intro": "Get a free property consultation on Saadiyat’s beachfront apartment market.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Mamsha Al Saadiyat",
      "intro": null,
      "items": [
        {
          "q": "What properties are available at Mamsha Al Saadiyat?",
          "a": "One to four-bedroom apartments, townhouses and penthouses, most with sea or promenade views."
        },
        {
          "q": "Is Mamsha Al Saadiyat on the beach?",
          "a": "Yes. The residences sit directly behind Mamsha Beach, with the promenade running in front of them."
        },
        {
          "q": "What is nearby?",
          "a": "The Saadiyat Cultural District — including the Louvre Abu Dhabi and Manarat Al Saadiyat — is within walking distance."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Mamsha Al Saadiyat",
      "intro": "Explore Saadiyat’s beachfront apartments with Bazar Real Estate.",
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
  'subpage/area/saadiyat-lagoons',
  'Saadiyat Lagoons (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Saadiyat Lagoons",
      "intro": "Aldar’s nature-led villa community on Saadiyat Island — four to six-bedroom standalone homes set within a protected mangrove ecosystem, designed around an eco corniche, parks and wellness amenities rather than a conventional street grid.",
      "position": "Saadiyat Island, approximately 15 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Aerial of Saadiyat Lagoons showing the villa clusters against the mangrove channels and the eco corniche."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Saadiyat Lagoons at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "900,000+ sq. m.",
          "label": "Protected Mangroves Around the Community"
        },
        {
          "enabled": true,
          "value": "5 km",
          "label": "Eco Corniche"
        },
        {
          "enabled": true,
          "value": "4–6",
          "label": "Bedrooms per Villa"
        }
      ],
      "footnote": "Masterplan figures published by Aldar for the Saadiyat Lagoons community."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Saadiyat Lagoons on the map.",
      "intro": null,
      "detail": "On the eastern side of Saadiyat Island, wrapped by protected mangrove channels."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Community Highlights",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Protected Mangroves",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "protected mangroves",
          "href": null
        },
        {
          "enabled": true,
          "name": "5 km Eco Corniche",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "5 km eco corniche",
          "href": null
        },
        {
          "enabled": true,
          "name": "Community Parks",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "community parks",
          "href": null
        },
        {
          "enabled": true,
          "name": "Wellness Amenities",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "wellness amenities",
          "href": null
        },
        {
          "enabled": true,
          "name": "Cultural Spine",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "cultural spine",
          "href": null
        },
        {
          "enabled": true,
          "name": "Retail Hubs",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "retail hubs",
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
      "heading": "The Phases",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Saadiyat Lagoons Phase 1",
          "desc": "The first release of four to six-bedroom standalone villas.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "saadiyat lagoons phase 1"
        },
        {
          "enabled": true,
          "name": "Saadiyat Lagoons Phase 2",
          "desc": "The follow-on release across further clusters.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "saadiyat lagoons phase 2"
        },
        {
          "enabled": true,
          "name": "Clusters 5A & 2B",
          "desc": "Later phases within the community.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "clusters 5a & 2b"
        }
      ],
      "footnote": "Villas range from roughly 4,994 to 6,361 sq. ft. across the released phases."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Saadiyat Lagoons",
      "intro": "Explore standalone four to six-bedroom villas within Saadiyat’s mangrove community.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Saadiyat Lagoons",
      "intro": "Rental stock appears as phases hand over.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": "Rental stock in Saadiyat Lagoons appears as phases hand over. Speak with our team about current and upcoming availability."
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "On Saadiyat Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Saadiyat Island",
          "time": "surrounding community",
          "href": "/areas/saadiyat-island"
        },
        {
          "enabled": true,
          "name": "Louvre Abu Dhabi",
          "time": "approx. 10 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 15 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "approx. 20 min",
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
      "heading": "Why Choose Saadiyat Lagoons?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Mangrove Setting",
          "desc": "More than 900,000 sq. m. of protected mangroves around the community."
        },
        {
          "enabled": true,
          "name": "Standalone Villas",
          "desc": "Four to six-bedroom detached homes rather than townhouses."
        },
        {
          "enabled": true,
          "name": "Eco Corniche",
          "desc": "A five-kilometre waterfront route for walking and cycling."
        },
        {
          "enabled": true,
          "name": "Saadiyat Address",
          "desc": "The Cultural District, beaches and golf club minutes away."
        },
        {
          "enabled": true,
          "name": "Aldar Delivery",
          "desc": "Built by the emirate’s largest listed developer."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Saadiyat Lagoons?",
      "intro": "Get a free property consultation on Saadiyat’s mangrove villa community.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Saadiyat Lagoons",
      "intro": null,
      "items": [
        {
          "q": "What properties are available in Saadiyat Lagoons?",
          "a": "Standalone four, five and six-bedroom villas, released in phases by Aldar."
        },
        {
          "q": "What surrounds the community?",
          "a": "More than 900,000 sq. m. of protected mangroves, with a five-kilometre eco corniche running through the masterplan."
        },
        {
          "q": "How large are the villas?",
          "a": "Released homes run from roughly 4,994 to 6,361 sq. ft."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Saadiyat Lagoons",
      "intro": "Explore Saadiyat’s mangrove villa community with Bazar Real Estate.",
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
  'subpage/area/saadiyat-reserve',
  'Saadiyat Reserve (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Saadiyat Reserve",
      "intro": "A low-density residential district on Saadiyat Island given over to plots and large villas, positioned away from the beachfront and cultural crowds for buyers who want space, privacy and the option to build.",
      "position": "Saadiyat Island, approximately 15 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Low aerial across Saadiyat Reserve showing generous plots, landscaped verges and the island beyond."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Saadiyat Reserve at a Glance",
      "intro": null,
      "stats": [],
      "footnote": null
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Saadiyat Reserve on the map.",
      "intro": null,
      "detail": "Set inland on Saadiyat Island, between the Cultural District and the island’s eastern communities."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Community Highlights",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Landscaped Public Realm",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "landscaped public realm",
          "href": null
        },
        {
          "enabled": true,
          "name": "Community Parks",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "community parks",
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
        },
        {
          "enabled": true,
          "name": "Saadiyat Beach",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "saadiyat beach",
          "href": null
        },
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
        }
      ],
      "footnote": null
    }
  },
  {
    "key": "communities",
    "enabled": true,
    "values": {
      "heading": "Living at Saadiyat Reserve",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "The Dunes",
          "desc": "Plotted development within the Reserve.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the dunes"
        },
        {
          "enabled": true,
          "name": "Residential Plots",
          "desc": "Land for buyers building their own home.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "residential plots"
        },
        {
          "enabled": true,
          "name": "Custom Villas",
          "desc": "Large detached homes on generous plots.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "custom villas"
        }
      ],
      "footnote": "Saadiyat Reserve sits alongside Saadiyat Lagoons, Hidd Al Saadiyat, Mamsha Al Saadiyat and Saadiyat Grove within the island’s residential mix."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Saadiyat Reserve",
      "intro": "Explore plots and large detached villas in Saadiyat’s low-density residential district.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Saadiyat Reserve",
      "intro": "Rental stock here is thin — the district is dominated by owner-occupied and self-built homes.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": "Rental stock in Saadiyat Reserve is thin — the district is dominated by owner-occupied and self-built homes. Speak with our team about what is available."
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "On Saadiyat Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Saadiyat Island",
          "time": "surrounding community",
          "href": "/areas/saadiyat-island"
        },
        {
          "enabled": true,
          "name": "Saadiyat Beach",
          "time": "approx. 10 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 15 min",
          "href": null
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
      "heading": "Why Choose Saadiyat Reserve?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Space & Privacy",
          "desc": "Generous plots in one of the island’s least dense districts."
        },
        {
          "enabled": true,
          "name": "Build Your Own",
          "desc": "Residential plots for buyers who want to design the house."
        },
        {
          "enabled": true,
          "name": "Saadiyat Address",
          "desc": "Beaches, golf and the Cultural District within the island."
        },
        {
          "enabled": true,
          "name": "Low Density",
          "desc": "Away from the beachfront apartment and visitor traffic."
        },
        {
          "enabled": true,
          "name": "Long-Term Hold",
          "desc": "A scarce, plotted product on a maturing island."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Saadiyat Reserve?",
      "intro": "Get a free property consultation on plots and villas across Saadiyat Island.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Saadiyat Reserve",
      "intro": null,
      "items": [
        {
          "q": "What is Saadiyat Reserve?",
          "a": "A low-density residential district on Saadiyat Island made up of residential plots and large detached villas."
        },
        {
          "q": "Can you buy land in Saadiyat Reserve?",
          "a": "Yes — the district includes residential plots for buyers who want to build their own home, subject to the island’s design guidelines."
        },
        {
          "q": "What else is on Saadiyat Island?",
          "a": "Saadiyat Lagoons, Hidd Al Saadiyat, Mamsha Al Saadiyat and Saadiyat Grove all sit within the island’s residential mix."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Saadiyat Reserve",
      "intro": "Explore plots and villas on Saadiyat Island with Bazar Real Estate.",
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
  'subpage/area/yas-acres',
  'Yas Acres (area guide)',
  'published',
  $doc$[
  {
    "key": "hero",
    "enabled": true,
    "values": {
      "eyebrow": null,
      "heading": "Yas Acres",
      "intro": "Yas Island’s flagship villa community — seven phases of townhouses, duplexes and family villas laid out around a golf course in Yas North, with schools, parks and retail built into the masterplan.",
      "position": "Yas North, approximately 20 minutes from Downtown Abu Dhabi."
    }
  },
  {
    "key": "hero-image",
    "enabled": true,
    "values": {
      "brief": "Aerial over Yas Acres showing the golf course fairways threading between the villa clusters, with the marina beyond."
    }
  },
  {
    "key": "stats",
    "enabled": true,
    "values": {
      "heading": "Yas Acres at a Glance",
      "intro": null,
      "stats": [
        {
          "enabled": true,
          "value": "7",
          "label": "Residential Phases"
        },
        {
          "enabled": true,
          "value": "~10%",
          "label": "Share of Yas Island’s Total Area"
        },
        {
          "enabled": true,
          "value": "2–6",
          "label": "Bedrooms Across the Community"
        }
      ],
      "footnote": "Community figures published for the Yas Acres masterplan by Aldar."
    }
  },
  {
    "key": "map",
    "enabled": true,
    "values": {
      "heading": "Find Yas Acres on the map.",
      "intro": null,
      "detail": "In Yas North, wrapped around the community golf course, a short drive from Yas Marina and Yas Mall."
    }
  },
  {
    "key": "landmarks",
    "enabled": true,
    "values": {
      "heading": "Community Highlights",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Yas Acres Golf Course",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas acres golf course",
          "href": null
        },
        {
          "enabled": true,
          "name": "Community Parks",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "community parks",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Acres Retail & Clubhouse",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas acres retail & clubhouse",
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
          "name": "Yas Beach",
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "yas beach",
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
      "heading": "The Phases",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "The Magnolias",
          "desc": "312 premium townhouses and villas overlooking the golf course.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the magnolias"
        },
        {
          "enabled": true,
          "name": "The Dahlias",
          "desc": "120 homes at the core of Yas Acres.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the dahlias"
        },
        {
          "enabled": true,
          "name": "The Redwoods",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the redwoods"
        },
        {
          "enabled": true,
          "name": "The Aspens",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the aspens"
        },
        {
          "enabled": true,
          "name": "The Cedars",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "the cedars"
        },
        {
          "enabled": true,
          "name": "Lea",
          "desc": null,
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "lea"
        },
        {
          "enabled": true,
          "name": "North Bay",
          "desc": "18 residential plots within the mixed-use phase.",
          "href": null,
          "image": {
            "media_id": null,
            "alt": null,
            "label": null
          },
          "img": "north bay"
        }
      ],
      "footnote": "The Magnolias comprises 312 homes; The Dahlias comprises 120; North Bay offers 18 plots for buyers building their own."
    }
  },
  {
    "key": "listings",
    "enabled": true,
    "values": {
      "heading": "Properties for Sale in Yas Acres",
      "intro": "Explore townhouses, duplexes and family villas across the seven Yas Acres phases.",
      "cta_label": "View All Properties for Sale",
      "cta_href": null
    }
  },
  {
    "key": "rentals",
    "enabled": true,
    "values": {
      "heading": "Properties for Rent in Yas Acres",
      "intro": "Discover rental villas and townhouses in Yas Island’s established golf community.",
      "cta_label": "View All Properties for Rent",
      "cta_href": null,
      "empty_body": null
    }
  },
  {
    "key": "nearby",
    "enabled": true,
    "values": {
      "heading": "On Yas Island",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Yas Mall",
          "time": "approx. 10 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Yas Island",
          "time": "surrounding community",
          "href": "/areas/yas-island"
        },
        {
          "enabled": true,
          "name": "Zayed International Airport",
          "time": "approx. 15 min",
          "href": null
        },
        {
          "enabled": true,
          "name": "Downtown Abu Dhabi",
          "time": "approx. 20 min",
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
      "heading": "Why Choose Yas Acres?",
      "intro": null,
      "items": [
        {
          "enabled": true,
          "name": "Golf Community",
          "desc": "Homes laid out around the community’s own course."
        },
        {
          "enabled": true,
          "name": "Family Formats",
          "desc": "Two to six-bedroom townhouses, duplexes and villas."
        },
        {
          "enabled": true,
          "name": "Built-In Amenity",
          "desc": "Schools, parks, retail and a clubhouse inside the masterplan."
        },
        {
          "enabled": true,
          "name": "Yas Island Lifestyle",
          "desc": "The marina, beach, mall and attractions minutes away."
        },
        {
          "enabled": true,
          "name": "Seven Phases",
          "desc": "A deep, liquid resale and rental market across price points."
        }
      ]
    }
  },
  {
    "key": "lead-form",
    "enabled": true,
    "values": {
      "heading": "Looking for a Property in Yas Acres?",
      "intro": "Get a free property consultation and find the Yas Acres phase that fits your brief.",
      "cta_label": "Request a Free Consultation"
    }
  },
  {
    "key": "faq",
    "enabled": true,
    "values": {
      "heading": "Frequently Asked Questions About Yas Acres",
      "intro": null,
      "items": [
        {
          "q": "How many phases are there in Yas Acres?",
          "a": "Seven — The Redwoods, The Aspens, The Magnolias, The Dahlias, The Cedars, Lea and the mixed-use North Bay."
        },
        {
          "q": "What properties are available?",
          "a": "Two to six-bedroom townhouses, duplexes and villas, plus residential plots in North Bay."
        },
        {
          "q": "Is Yas Acres on a golf course?",
          "a": "Yes. The community is built around its own golf course, with many homes fronting the fairways."
        }
      ]
    }
  },
  {
    "key": "final-cta",
    "enabled": true,
    "values": {
      "heading": "Find Your Property in Yas Acres",
      "intro": "Explore Yas Island’s golf community with Bazar Real Estate.",
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
