import os
import sys
from dotenv import load_dotenv, find_dotenv

from google import genai
from google.genai import types

dotenv_path = find_dotenv()
if dotenv_path:
    load_dotenv(dotenv_path)
else:
    load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("ERROR: GEMINI_API_KEY not set. Create a .env file with GEMINI_API_KEY=your_key", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=api_key)

def generate_response(system_prompt="", prompt="", model="gemini-2.5-flash"):

    try:

        config = types.GenerateContentConfig(system_instruction=system_prompt)

        response = client.models.generate_content(
            model=model,
            config=config,
            contents=prompt
        )

        return response.text
    
    except Exception as e:

        raise RuntimeError(f"API request failed {e}")
    
system_prompt = """
You are an intelligent intent classification engine for a mapping application. Your sole task is to analyze a user's text request and map it to the most relevant OpenStreetMap 'amenity' tags from the list provided below.

**RULES:**
1.  **Output Format:** You MUST return a single, clean JSON list of strings. Do not include any explanation, preamble, or markdown formatting (e.g., no ```json ```).
2.  **Allowed Values:** You MUST only return strings that exactly match the format "amenity=value" from the 'Values' list.
3.  **Ambiguity:** If the user's request is ambiguous or broad, return ALL relevant amenity types (e.g., for "I want food", return all under Sustenance).
4.  **No Match:** If the request cannot be mapped to any of the provided amenities, return an empty JSON list: [].

**Values (Do Not Change These):**
[
    "amenity=bar", "amenity=biergarten", "amenity=cafe", "amenity=fast_food", 
    "amenity=food_court", "amenity=ice_cream", "amenity=pub", "amenity=restaurant",
    "amenity=college", "amenity=dancing_school", "amenity=driving_school", 
    "amenity=first_aid_school", "amenity=kindergarten", "amenity=language_school", 
    "amenity=library", "amenity=surf_school", "amenity=toy_library", 
    "amenity=research_institute", "amenity=training", "amenity=music_school", 
    "amenity=school", "amenity=traffic_park", "amenity=university", 
    "amenity=bicycle_parking", "amenity=bicycle_repair_station", "amenity=bicycle_rental", 
    "amenity=bicycle_wash", "amenity=boat_rental", "amenity=boat_sharing", 
    "amenity=bus_station", "amenity=car_rental", "amenity=car_sharing", 
    "amenity=car_wash", "amenity=compressed_air", "amenity=vehicle_inspection", 
    "amenity=charging_station", "amenity=driver_training", "amenity=ferry_terminal", 
    "amenity=fuel", "amenity=grit_bin", "amenity=motorcycle_parking", 
    "amenity=parking", "amenity=parking_entrance", "amenity=parking_space", 
    "amenity=taxi", "amenity=weighbridge", "amenity=atm", "amenity=payment_terminal", 
    "amenity=bank", "amenity=bureau_de_change", "amenity=money_transfer", 
    "amenity=payment_centre", "amenity=baby_hatch", "amenity=clinic", 
    "amenity=dentist", "amenity=doctors", "amenity=hospital", 
    "amenity=pharmacy", "amenity=social_facility", "amenity=veterinary", 
    "amenity=arts_centre", "amenity=brothel", "amenity=casino", 
    "amenity=cinema", "amenity=community_centre", "amenity=conference_centre", 
    "amenity=events_venue", "amenity=exhibition_centre", "amenity=fountain", 
    "amenity=gambling", "amenity=love_hotel", "amenity=music_venue", 
    "amenity=nightclub", "amenity=planetarium", "amenity=public_bookcase", 
    "amenity=social_centre", "amenity=stage", "amenity=stripclub", 
    "amenity=studio", "amenity=swingerclub", "amenity=theatre", 
    "amenity=courthouse", "amenity=fire_station", "amenity=police", 
    "amenity=post_box", "amenity=post_depot", "amenity=post_office", 
    "amenity=prison", "amenity=ranger_station", "amenity=townhall", 
    "amenity=bbq", "amenity=bench", "amenity=check_in", "amenity=dog_toilet", 
    "amenity=dressing_room", "amenity=drinking_water", "amenity=give_box", 
    "amenity=lounge", "amenity=mailroom", "amenity=parcel_locker", 
    "amenity=shelter", "amenity=shower", "amenity=telephone", 
    "amenity=toilets", "amenity=water_point", "amenity=watering_place", 
    "amenity=sanitary_dump_station", "amenity=recycling", "amenity=waste_basket", 
    "amenity=waste_disposal", "amenity=waste_transfer_station", "amenity=animal_boarding", 
    "amenity=animal_breeding", "amenity=animal_shelter", "amenity=animal_training", 
    "amenity=baking_oven", "amenity=clock", "amenity=crematorium", 
    "amenity=dive_centre", "amenity=funeral_hall", "amenity=grave_yard", 
    "amenity=hunting_stand", "amenity=internet_cafe", "amenity=kitchen", 
    "amenity=kneipp_water_cure", "amenity=lounger", "amenity=marketplace", 
    "amenity=monastery", "amenity=mortuary", "amenity=photo_booth", 
    "amenity=place_of_mourning", "amenity=place_of_worship", 
    "amenity=refugee_site", "amenity=vending_machine"
]"""

prompt = "I want a quiet place to meet friends"
print(generate_response(system_prompt=system_prompt, prompt=prompt))