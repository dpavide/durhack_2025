import os
from dotenv import load_dotenv
import requests
import json
import sys

load_dotenv() 

# API_KEY is now correctly loaded from the .env file
API_KEY = os.environ.get('GMAPS_API_KEY') 

# --- Location Data ---
LOCATION_NAME = "Las Iguanas"
LAT = 52.4801211
LNG = -1.8990618
LOCATION = f"{LAT},{LNG}"
RADIUS = 50  # Search within 50 meters of the coordinates

if not API_KEY:
    print("Error: GMAPS_API_KEY environment variable not set.")
    sys.exit(1)

# --- Step 1: Find the Place ID using Nearby Search ---
def find_place_id(name, location, radius, key):
    """Searches for a place ID using name and nearby location."""
    
    # URL for the Nearby Search (Legacy) API
    nearby_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    
    # Parameters for the search
    params = {
        "location": location,
        "radius": radius,
        "keyword": name,
        "key": key
    }
    
    print(f"1. Searching for Place ID near {location}...")
    
    try:
        response = requests.get(nearby_url, params=params)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        data = response.json()
        
        if data['status'] == 'OK' and data['results']:
            # Assume the first result is the correct one
            place_id = data['results'][0]['place_id']
            place_name = data['results'][0]['name']
            print(f"   -> Found Place ID for '{place_name}': {place_id}")
            return place_id
        else:
            print(f"   -> Failed to find Place ID. Status: {data.get('status', 'Unknown')}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"An error occurred during Nearby Search: {e}")
        return None

# --- Step 2: Get the Rating AND Reviews using Place Details ---
def get_rating_and_reviews_by_place_id(place_id, key):
    """Retrieves the rating, total reviews, and up to 5 relevant reviews."""
    
    details_url = "https://maps.googleapis.com/maps/api/place/details/json"
    
    # *** UPDATED FIELDS HERE ***
    params = {
        "place_id": place_id,
        "fields": "rating,user_ratings_total,reviews", 
        "key": key
    }
    
    print("2. Retrieving Rating, Review Count, and 5 Reviews...")
    
    try:
        response = requests.get(details_url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'OK' and 'result' in data:
            result = data['result']
            rating = result.get('rating')
            total_reviews = result.get('user_ratings_total')
            reviews = result.get('reviews', []) # Get the list of reviews
            
            return rating, total_reviews, reviews
        else:
            print(f"   -> Failed to retrieve details. Status: {data.get('status', 'Unknown')}")
            return None, None, []
            
    except requests.exceptions.RequestException as e:
        print(f"An error occurred during Place Details request: {e}")
        return None, None, []

# --- Main Execution Update ---
if __name__ == "__main__":
    
    # Step 1
    place_id = find_place_id(LOCATION_NAME, LOCATION, RADIUS, API_KEY)
    # place_id = find_place_id(LOCATION_NAME, LOCATION, RADIUS, API_KEY)
    
    if place_id:
        # Step 2: Update the call to receive the third return value (reviews)
        rating, total_reviews, reviews = get_rating_and_reviews_by_place_id(place_id, API_KEY)
        
        print("\n--- Google Maps Rating & Reviews Result ---")
        if rating is not None and total_reviews is not None:
            print(f"⭐ Rating: {rating} / 5.0")
            print(f"💬 Total Reviews: {total_reviews}")
            
            if reviews:
                print(f"\n✅ Found {len(reviews)} Most Relevant Reviews:")
                for i, review in enumerate(reviews):
                    print(f"  --- Review {i+1} ---")
                    print(f"  Author: {review.get('author_name', 'N/A')}")
                    print(f"  Review Rating: {review.get('rating', 'N/A')}")
                    print(f"  Text: {review.get('text', '')[:100]}...") # Print first 100 chars
                    print(f"  Time: {review.get('relative_time_description', 'N/A')}")
            else:
                print("\nNo reviews found in the API response.")
        else:
            print("Could not retrieve rating details.")