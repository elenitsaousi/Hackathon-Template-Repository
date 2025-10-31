"""
Scoring logic for geographic_proximity

This module scores how geographically close each mentee-mentor pair is, based on precomputed travel distances (in kilometers) between their home locations. Locations are mapped to coordinates using 'location_mappings.json', and distances between all relevant pairs are loaded from 'distances.json'. For each mentee and mentor, their location is looked up in the mappings, and the distance between their coordinates is found via the precomputed distance matrix.

Scoring principle:
- If the distance between a mentee and mentor is zero (same coordinates), the pair receives the maximum score of 1.0.
- For larger distances, the score decreases linearly according to the formula:
    score = max(0.0, 1.0 - (distance_km / max_reasonable_distance))
  where max_reasonable_distance is typically set at 200 km; distances at or above this threshold receive the minimum score of 0.0.
- If a location is unmapped or a distance is missing, the score defaults to 0.0 for that pair.
- All scores are multiplied by an optional importance_modifier (default 1.0) and fall in the range [0, 1].
- The result is a dictionary mapping (mentee_id, mentor_id) to float scores.

Rationale: smaller distances produce higher compatibility scores, prioritizing pairs who can more easily meet in person. The scoring logic is strictly monotonic and strictly based on precomputed travel distances; no API calls or runtime geocoding are performed as part of scoring.
"""




import json
import math
import os
import time
from collections import deque
from pathlib import Path
from typing import Dict, Optional, Tuple

import openrouteservice
import pandas as pd
from dotenv import load_dotenv
from geopy.geocoders import Nominatim, OpenCage

# Rate limiting for OpenRouteService: max 40 requests per minute
_ORS_RATE_LIMIT = 40  # requests
_ORS_RATE_WINDOW = 60  # seconds
_ors_request_times: deque = deque()


def _wait_for_rate_limit():
    """Wait if needed to respect OpenRouteService rate limit (40 requests/minute)."""
    current_time = time.time()
    
    # Remove timestamps older than 1 minute
    while _ors_request_times and current_time - _ors_request_times[0] >= _ORS_RATE_WINDOW:
        _ors_request_times.popleft()
    
    # If we've hit the limit, wait until the oldest request is more than 1 minute ago
    if len(_ors_request_times) >= _ORS_RATE_LIMIT:
        oldest_time = _ors_request_times[0]
        wait_time = _ORS_RATE_WINDOW - (current_time - oldest_time) + 0.1  # Add small buffer
        if wait_time > 0:
            print(f"Rate limit reached ({_ORS_RATE_LIMIT} requests/minute), waiting {wait_time:.1f}s...")
            time.sleep(wait_time)
            # Update current_time after waiting
            current_time = time.time()
            # Clean up old timestamps again
            while _ors_request_times and current_time - _ors_request_times[0] >= _ORS_RATE_WINDOW:
                _ors_request_times.popleft()
    
    # Record this API call
    _ors_request_times.append(time.time())

# Load .env file if it exists
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)

# Cache directory for geographic data
CACHE_DIR = BASE_DIR / "temp" / "geographic_data"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

LOCATION_CACHE_FILE = CACHE_DIR / "location_mappings.json"
DISTANCE_CACHE_FILE = CACHE_DIR / "distances.json"

# In-memory cache dictionaries
_location_cache: Dict[str, Optional[Tuple[float, float]]] = {}
_distance_cache: Dict[str, float] = {}


def _load_cache():
    """Load cached location mappings and distances from disk."""
    global _location_cache, _distance_cache
    
    # Load location mappings
    if LOCATION_CACHE_FILE.exists():
        try:
            with open(LOCATION_CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Convert lists back to tuples
                _location_cache = {
                    k: tuple(v) if v is not None else None 
                    for k, v in data.items()
                }
                print(f"Loaded {len(_location_cache)} location mappings from cache")
        except Exception as e:
            print(f"Warning: Failed to load location cache: {e}")
            _location_cache = {}
    else:
        _location_cache = {}
    
    # Load distance calculations
    if DISTANCE_CACHE_FILE.exists():
        try:
            with open(DISTANCE_CACHE_FILE, 'r', encoding='utf-8') as f:
                _distance_cache = json.load(f)
                print(f"Loaded {len(_distance_cache)} distance calculations from cache")
        except Exception as e:
            print(f"Warning: Failed to load distance cache: {e}")
            _distance_cache = {}
    else:
        _distance_cache = {}


def _save_location_cache():
    """Save location mappings to disk."""
    try:
        with open(LOCATION_CACHE_FILE, 'w', encoding='utf-8') as f:
            # Convert tuples to lists for JSON serialization
            data = {
                k: list(v) if v is not None else None 
                for k, v in _location_cache.items()
            }
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to save location cache: {e}")


def _save_distance_cache():
    """Save distance calculations to disk."""
    try:
        with open(DISTANCE_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(_distance_cache, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to save distance cache: {e}")


def _cache_key_for_coords(coords1: Tuple[float, float], coords2: Tuple[float, float]) -> str:
    """Generate a cache key for a coordinate pair (order-independent)."""
    sorted_coords = tuple(sorted([coords1, coords2]))
    return f"{sorted_coords[0][0]:.6f},{sorted_coords[0][1]:.6f}|{sorted_coords[1][0]:.6f},{sorted_coords[1][1]:.6f}"


def _haversine_distance_km(coords1: Tuple[float, float], coords2: Tuple[float, float]) -> float:
    """
    Calculate great-circle (straight-line) distance between two coordinates using Haversine formula.
    Returns distance in kilometers.
    
    Args:
        coords1: (longitude, latitude) of first point
        coords2: (longitude, latitude) of second point
    
    Returns:
        Distance in kilometers
    """
    lon1, lat1 = math.radians(coords1[0]), math.radians(coords1[1])
    lon2, lat2 = math.radians(coords2[0]), math.radians(coords2[1])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    
    # Earth radius in kilometers
    R = 6371.0
    
    distance_km = R * c
    return distance_km


# Load cache on module import
_load_cache()

# Initialize geocoders
_nominatim_geolocator = Nominatim(user_agent="geo_app", timeout=10)

# Initialize OpenCage geocoder if API key is available (fallback)
_open_cage_api_key = os.getenv("OPEN_CAGE_DATA")
_open_cage_geolocator = None
if _open_cage_api_key:
    _open_cage_geolocator = OpenCage(api_key=_open_cage_api_key, timeout=10)


def _city_to_coords(location_str: str) -> Optional[Tuple[float, float]]:
    """
    Convert a city/address string to (longitude, latitude) coordinates.
    Returns None if geocoding fails after retries.
    Uses disk cache to avoid repeated API calls for the same location.
    """
    if not location_str or pd.isna(location_str):
        return None
    
    location_str = str(location_str).strip()
    if not location_str:
        return None
    
    # Check cache first
    if location_str in _location_cache:
        coords = _location_cache[location_str]
        if coords is not None:
            print(f"Location: {location_str} (from cache)")
            print(f"  -> Coordinates: ({coords[0]:.6f}, {coords[1]:.6f})")
        else:
            print(f"Location: {location_str} (cached: failed)")
        return coords
    
    # Print location string
    print(f"Location: {location_str}")
    
    max_retries = 10
    for attempt in range(max_retries):
        try:
            # Try Nominatim first (free, no API key needed)
            location = _nominatim_geolocator.geocode(f"{location_str}, Switzerland")
            if not location:
                # Fallback to global Nominatim search
                location = _nominatim_geolocator.geocode(location_str)
            
            if location:
                # OpenRouteService expects (longitude, latitude)
                coords = (location.longitude, location.latitude)
                print(f"  -> Coordinates (Nominatim): ({coords[0]:.6f}, {coords[1]:.6f})")
                # Save to cache
                _location_cache[location_str] = coords
                _save_location_cache()
                return coords
            else:
                # Nominatim failed, try OpenCage as fallback if available
                if _open_cage_geolocator is not None:
                    try:
                        print("  Nominatim failed, trying OpenCage...")
                        location = _open_cage_geolocator.geocode(f"{location_str}, Switzerland")
                        if not location:
                            location = _open_cage_geolocator.geocode(location_str)
                        
                        if location:
                            coords = (location.longitude, location.latitude)
                            print(f"  -> Coordinates (OpenCage): ({coords[0]:.6f}, {coords[1]:.6f})")
                            # Save to cache
                            _location_cache[location_str] = coords
                            _save_location_cache()
                            return coords
                    except Exception as oc_e:
                        print(f"  OpenCage geocoding failed: {oc_e}")
                
                # If both geocoding attempts returned None, retry if we have attempts left
                if attempt < max_retries - 1:
                    wait_time = 0.5 * (attempt + 1)
                    print(f"  Geocoding returned None (attempt {attempt + 1}/{max_retries}) for '{location_str}', retrying in {wait_time:.1f}s...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"  -> Geocoding failed after {max_retries} attempts for '{location_str}': location not found")
                    # Cache the failure (None) to avoid retrying
                    _location_cache[location_str] = None
                    _save_location_cache()
                    return None
        except Exception as e:
            if attempt < max_retries - 1:
                # Wait a bit before retrying (exponential backoff)
                wait_time = 0.5 * (attempt + 1)
                print(f"  Geocoding exception (attempt {attempt + 1}/{max_retries}) for '{location_str}', retrying in {wait_time:.1f}s...")
                time.sleep(wait_time)
                continue
            else:
                print(f"  -> Geocoding failed after {max_retries} attempts for '{location_str}': {e}")
                # Cache the failure (None) to avoid retrying
                _location_cache[location_str] = None
                _save_location_cache()
                return None
    
    return None


def _driving_distance_km(
    coords1: Optional[Tuple[float, float]],
    coords2: Optional[Tuple[float, float]],
    ors_client: Optional[openrouteservice.Client],
    mentee_id: Optional[int] = None,
    mentor_id: Optional[int] = None,
) -> Optional[float]:
    """
    Calculate driving distance in kilometers between two coordinates.
    Returns None if calculation fails after retries or either coordinate is None.
    Retries up to 10 times on failure.
    Enforces rate limit of 40 requests/minute.
    If API keeps failing, retry delay increases to 1 minute after 3 failures.
    """
    if coords1 is None or coords2 is None:
        return None
    
    if ors_client is None:
        return None
    
    max_retries = 10
    consecutive_failures = 0
    
    # Check cache first
    cache_key = _cache_key_for_coords(coords1, coords2)
    if cache_key in _distance_cache:
        distance_km = _distance_cache[cache_key]
        pair_info = ""
        if mentee_id is not None and mentor_id is not None:
            pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
        print(f"Distance: {distance_km:.2f} km{pair_info} (from cache)")
        return distance_km
    
    for attempt in range(max_retries):
        try:
            # Wait for rate limit before making API call
            _wait_for_rate_limit()
            
            route = ors_client.directions(
                coordinates=[coords1, coords2],
                profile="driving-car",
                format="json",
            )
            
            # Check if response structure is valid
            if not isinstance(route, dict):
                # Invalid response - fallback to Haversine
                print("\nWARNING: Invalid route response type. Falling back to Haversine distance")
                distance_km = _haversine_distance_km(coords1, coords2)
                pair_info = ""
                if mentee_id is not None and mentor_id is not None:
                    pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
                print(f"Distance (Haversine fallback): {distance_km:.2f} km{pair_info}")
                _distance_cache[cache_key] = distance_km
                _save_distance_cache()
                return distance_km
            
            if "routes" not in route:
                # Missing routes key - fallback to Haversine
                print("\nWARNING: 'routes' key not found in response. Falling back to Haversine distance")
                print(f"Available keys: {list(route.keys())}")
                distance_km = _haversine_distance_km(coords1, coords2)
                pair_info = ""
                if mentee_id is not None and mentor_id is not None:
                    pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
                print(f"Distance (Haversine fallback): {distance_km:.2f} km{pair_info}")
                _distance_cache[cache_key] = distance_km
                _save_distance_cache()
                return distance_km
            
            if not route["routes"]:
                # Empty routes list - fallback to Haversine
                print("\nWARNING: Routes list is empty. Falling back to Haversine distance")
                distance_km = _haversine_distance_km(coords1, coords2)
                pair_info = ""
                if mentee_id is not None and mentor_id is not None:
                    pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
                print(f"Distance (Haversine fallback): {distance_km:.2f} km{pair_info}")
                _distance_cache[cache_key] = distance_km
                _save_distance_cache()
                return distance_km
            
            route_data = route["routes"][0]
            if not isinstance(route_data, dict):
                # Invalid route data - fallback to Haversine
                print("\nWARNING: Invalid route data type. Falling back to Haversine distance")
                distance_km = _haversine_distance_km(coords1, coords2)
                pair_info = ""
                if mentee_id is not None and mentor_id is not None:
                    pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
                print(f"Distance (Haversine fallback): {distance_km:.2f} km{pair_info}")
                _distance_cache[cache_key] = distance_km
                _save_distance_cache()
                return distance_km
            
            if "summary" not in route_data:
                # Missing summary - fallback to Haversine
                print("\nWARNING: 'summary' key not found in route. Falling back to Haversine distance")
                print(f"Available keys: {list(route_data.keys())}")
                distance_km = _haversine_distance_km(coords1, coords2)
                pair_info = ""
                if mentee_id is not None and mentor_id is not None:
                    pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
                print(f"Distance (Haversine fallback): {distance_km:.2f} km{pair_info}")
                _distance_cache[cache_key] = distance_km
                _save_distance_cache()
                return distance_km
            
            summary = route_data["summary"]
            if not isinstance(summary, dict):
                # Invalid summary type - fallback to Haversine
                print("\nWARNING: Invalid summary type. Falling back to Haversine distance")
                distance_km = _haversine_distance_km(coords1, coords2)
                pair_info = ""
                if mentee_id is not None and mentor_id is not None:
                    pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
                print(f"Distance (Haversine fallback): {distance_km:.2f} km{pair_info}")
                _distance_cache[cache_key] = distance_km
                _save_distance_cache()
                return distance_km
            
            if "distance" not in summary:
                # API didn't return distance - fallback to Haversine (straight-line) distance
                print("\nWARNING: 'distance' key not found in summary")
                print(f"Summary keys: {list(summary.keys())}")
                print("Falling back to Haversine (straight-line) distance calculation")
                
                distance_km = _haversine_distance_km(coords1, coords2)
                pair_info = ""
                if mentee_id is not None and mentor_id is not None:
                    pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
                print(f"Distance (Haversine fallback): {distance_km:.2f} km{pair_info}")
                
                # Save to cache
                _distance_cache[cache_key] = distance_km
                _save_distance_cache()
                return distance_km
            
            # Distance is in meters, convert to km
            distance_m = summary["distance"]
            distance_km = distance_m / 1000.0
            
            # Print distance for debugging
            pair_info = ""
            if mentee_id is not None and mentor_id is not None:
                pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
            print(f"Distance: {distance_km:.2f} km{pair_info}")
            
            # Save to cache
            _distance_cache[cache_key] = distance_km
            _save_distance_cache()
            
            # Reset consecutive failures on success
            consecutive_failures = 0
            return distance_km
        except Exception as e:
            consecutive_failures += 1
            
            # If we've exhausted retries, fallback to Haversine distance
            if attempt == max_retries - 1:
                print("\nWARNING: API call failed after all retries. Falling back to Haversine (straight-line) distance calculation")
                distance_km = _haversine_distance_km(coords1, coords2)
                pair_info = ""
                if mentee_id is not None and mentor_id is not None:
                    pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
                print(f"Distance (Haversine fallback): {distance_km:.2f} km{pair_info}")
                
                # Save to cache
                _distance_cache[cache_key] = distance_km
                _save_distance_cache()
                return distance_km
            
            # Print detailed error information
            pair_info = ""
            if mentee_id is not None and mentor_id is not None:
                pair_info = f" (Mentee {mentee_id} <-> Mentor {mentor_id})"
            
            error_type = type(e).__name__
            error_msg = str(e)
            
            # Try to extract HTTP status code and response details if available
            status_code = None
            response_body = None
            
            # Check if it's an HTTP error from openrouteservice (usually wraps requests exceptions)
            if hasattr(e, 'response'):
                try:
                    if hasattr(e.response, 'status_code'):
                        status_code = e.response.status_code
                    if hasattr(e.response, 'text'):
                        response_body = e.response.text
                    elif hasattr(e.response, 'content'):
                        response_body = str(e.response.content)
                except Exception:
                    pass
            
            # Also check for status_code attribute directly
            if status_code is None and hasattr(e, 'status_code'):
                status_code = e.status_code
            
            # OpenRouteService ApiError sometimes has status code in the error message
            # Format: "403 ({'error': '...'})" or similar
            if status_code is None:
                import re
                import ast
                status_match = re.search(r'^(\d{3})\s*\(', error_msg)
                if status_match:
                    status_code = int(status_match.group(1))
                
                # Also try to extract from error message dict if present
                if status_code and '(' in error_msg and ')' in error_msg:
                    try:
                        # Extract the dict part from error message like "403 ({'error': '...'})"
                        dict_start = error_msg.find('(') + 1
                        dict_end = error_msg.rfind(')')
                        if dict_start < dict_end:
                            error_dict_str = error_msg[dict_start:dict_end]
                            # Try to safely parse as dict
                            error_dict = ast.literal_eval(error_dict_str)
                            if isinstance(error_dict, dict):
                                response_body = str(error_dict)
                    except Exception:
                        pass
            
            # Print detailed error
            print(f"\n{'='*60}")
            print(f"API ERROR{pair_info}:")
            print(f"  Error Type: {error_type}")
            print(f"  Error Message: {error_msg}")
            if status_code is not None:
                print(f"  HTTP Status Code: {status_code}")
            if response_body:
                # Limit response body length to avoid too much output
                body_preview = response_body[:500] if len(response_body) > 500 else response_body
                print(f"  Response Body: {body_preview}")
                if len(response_body) > 500:
                    print(f"  ... (truncated, total length: {len(response_body)} chars)")
            print(f"{'='*60}\n")
            
            # Fail immediately on authentication/authorization errors (401, 403)
            # These won't resolve with retries
            if status_code in (401, 403):
                print(f"ERROR: Authentication/Authorization failed (HTTP {status_code}).")
                print("This error will not resolve with retries. Please check:")
                print("  - API key is valid and active")
                print("  - API key has permissions for directions endpoint")
                print("  - Account billing/limits are not exceeded")
                print("Skipping this distance calculation.\n")
                return None
            
            # Also fail fast on 429 (rate limit) if we're already being rate limited
            if status_code == 429 and consecutive_failures >= 3:
                print("ERROR: Rate limit exceeded (HTTP 429) after multiple attempts.")
                print("Skipping this distance calculation to avoid further rate limiting.\n")
                return None
            
            if attempt < max_retries - 1:
                # If we've had 3+ consecutive failures, use 1 minute delay
                if consecutive_failures >= 3:
                    wait_time = 60.0  # 1 minute
                    print(f"API call failed ({consecutive_failures} consecutive failures) (attempt {attempt + 1}/{max_retries}), retrying in {wait_time:.0f}s...")
                else:
                    # Use exponential backoff for first few failures
                    wait_time = 0.5 * (attempt + 1)
                    print(f"API call failed (attempt {attempt + 1}/{max_retries}), retrying in {wait_time:.1f}s...")
                time.sleep(wait_time)
                continue
            else:
                print(f"Distance calculation failed after {max_retries} attempts{pair_info}")
                return None
    
    return None


def geographic_proximity_results(
    mentees_df: pd.DataFrame,
    mentors_df: pd.DataFrame,
    importance_modifier: float = 1.0,
    geographic_max_distance: Optional[int] = 200,
    ors_api_key: Optional[str] = None,
) -> Dict[Tuple[int, int], float]:
    """
    Normalized minimize score based on driving distance where:
    - 1.0 when distance is minimum (closest pair)
    - 0.0 when distance is maximum (farthest pair) across all calculated distances
    - -inf if the pair's distance exceeds the specified maximum distance (geographic_max_distance)
    
    If either location cannot be geocoded or distance cannot be calculated, score is 0.0.
    
    Args:
        mentees_df: DataFrame with mentee data
        mentors_df: DataFrame with mentor data
        importance_modifier: Weight multiplier for scores
        geographic_max_distance: maximum allowed distance in km (default: 200)
        ors_api_key: OpenRouteService API key. If None, tries to load from OPEN_ROUTE_SERVICE env var
    """
    
    mentee_id_col = "Mentee Number"
    mentor_id_col = "Mentor Number"
    mentor_address_col = "Postadresse / Postal address"
    mentee_city_col = "Residence (city)"
    
    # Get API key from parameter or environment
    api_key = ors_api_key or os.getenv("OPEN_ROUTE_SERVICE")
    ors_client = None
    if api_key:
        ors_client = openrouteservice.Client(key=api_key)
    else:
        # Return empty results if no API key
        return {}
    
    # Precompute coordinates for all locations
    print("\n=== MENTEE LOCATIONS ===")
    mentee_coords = []
    for _, row in mentees_df.iterrows():
        city = row.get(mentee_city_col, None)
        mentee_id = row.get(mentee_id_col, None)
        print(f"\n[Mentee {mentee_id}]")
        coords = _city_to_coords(city if city is not None else "")
        mentee_coords.append(coords)
    
    print("\n=== MENTOR LOCATIONS ===")
    mentor_coords = []
    for _, row in mentors_df.iterrows():
        address = row.get(mentor_address_col, None)
        mentor_id = row.get(mentor_id_col, None)
        print(f"\n[Mentor {mentor_id}]")
        coords = _city_to_coords(address if address is not None else "")
        mentor_coords.append(coords)
    
    # Calculate all distances with caching
    print("\n=== CALCULATING DISTANCES ===")
    all_distances: list[float] = []
    
    for mentee_idx, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row[mentee_id_col]
        mentee_coord = mentee_coords[mentee_idx]
        
        for mentor_idx, mentor_row in mentors_df.iterrows():
            mentor_id = mentor_row[mentor_id_col]
            mentor_coord = mentor_coords[mentor_idx]
            
            if mentee_coord is not None and mentor_coord is not None:
                # Use cache key for checking/adding to all_distances
                cache_key_str = _cache_key_for_coords(mentee_coord, mentor_coord)
                
                # Check if already in global cache
                if cache_key_str in _distance_cache:
                    dist = _distance_cache[cache_key_str]
                else:
                    # This will check cache internally and save new results
                    dist = _driving_distance_km(
                        mentee_coord, mentor_coord, ors_client, 
                        mentee_id=mentee_id, mentor_id=mentor_id
                    )
                
                if dist is not None:
                    all_distances.append(dist)
    
    if not all_distances:
        return {}
    
    min_dist = min(all_distances)
    max_dist = max(all_distances)
    dist_range = max_dist - min_dist
    print(f"\nDistance range: min={min_dist:.2f} km, max={max_dist:.2f} km, range={dist_range:.2f} km")
    
    # Now calculate scores
    print("\n=== CALCULATING SCORES ===")
    results: Dict[Tuple[int, int], float] = {}
    max_allowed_distance = geographic_max_distance if geographic_max_distance is not None else 200
    
    for mentee_idx, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row[mentee_id_col]
        mentee_coord = mentee_coords[mentee_idx]
        
        for mentor_idx, mentor_row in mentors_df.iterrows():
            mentor_id = mentor_row[mentor_id_col]
            mentor_coord = mentor_coords[mentor_idx]
            
            score = 0.0
            if mentee_coord is not None and mentor_coord is not None:
                cache_key_str = _cache_key_for_coords(mentee_coord, mentor_coord)
                dist = _distance_cache.get(cache_key_str)
                
                if dist is not None:
                    if max_allowed_distance is not None and dist > max_allowed_distance:
                        score = float('-inf')
                    elif dist_range > 0:
                        # Normalized minimize: 1.0 for min distance, 0.0 for max distance
                        score = max(0.0, 1.0 - ((dist - min_dist) / dist_range))
                    else:
                        # All distances are the same
                        score = 1.0
            
            results[(mentee_id, mentor_id)] = score * importance_modifier
    
    return results

