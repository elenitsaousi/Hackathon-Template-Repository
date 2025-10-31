import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

# ---------------------------------------------------------
# Detect project root
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# Paths
gender_path = os.path.join(BASE_DIR, "results_gender.json")
language_path = os.path.join(BASE_DIR, "results_languages.json")
academia_path = os.path.join(BASE_DIR, "results_academia.json")
geo_path = os.path.join(BASE_DIR, "results_geographic_proximity.json")
age_difference_path = os.path.join(BASE_DIR, "results_age_difference.json")
output_path = os.path.join(BASE_DIR, "results_final.json")

# ---------------------------------------------------------
# Load JSON
# ---------------------------------------------------------
def load_json(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f" Missing file: {path}")
    with open(path, "r") as f:
        return json.load(f)

# ---------------------------------------------------------
# Build lookup {(mentor_id, mentee_id): score}
# Handles both numeric values and nested {score, ...}
# ---------------------------------------------------------
def build_lookup(data):
    lookup = {}
    if not isinstance(data, dict):
        return lookup
    # pick inner dict (e.g. "gender": {...})
    if len(data) == 1 and isinstance(next(iter(data.values())), dict):
        data = next(iter(data.values()))
    for pair_key, value in data.items():
        if "-" not in pair_key:
            continue
        mentor_id, mentee_id = pair_key.split("-")
        if isinstance(value, dict):
            score = float(value.get("score", 0))
        else:
            score = float(value)
        lookup[(mentor_id, mentee_id)] = score
    return lookup

# ---------------------------------------------------------
# Load all results
# ---------------------------------------------------------
gender_lookup = build_lookup(load_json(gender_path))
language_lookup = build_lookup(load_json(language_path))
academia_lookup = build_lookup(load_json(academia_path))
age_lookup = build_lookup(load_json(age_difference_path))
geo_lookup = build_lookup(load_json(geo_path))

# ---------------------------------------------------------
# Combine and filter (revised: only reject truly invalid pairs)
# ---------------------------------------------------------
final_scores = []
rejected_hard = 0

for key in academia_lookup.keys():
    mentor_id, mentee_id = key
    gender_score = gender_lookup.get(key, 0)
    language_score = language_lookup.get(key, 0)
    academia_score = academia_lookup.get(key, 0)
    age_score = age_lookup.get(key, 0)
    geo_score = geo_lookup.get(key, 0)

    # Reject only truly invalid pairs
    if gender_score == 0 or language_score == 0:
        rejected_hard += 1
        continue

    # New filter for excessive age gap
    if age_score < 0.2:
        rejected_hard += 1
        continue 

    # Weighted combination
    total_score = 0.7 * academia_score + 0.3 * geo_score


    final_scores.append({
        "mentor_id": mentor_id,
        "mentee_id": mentee_id,
        "gender_score": gender_score,
        "language_score": language_score,
        "academia_score": academia_score,
        "geo_score": geo_score,
        "age_score": age_score,
        "final_score": total_score
    })

# ---------------------------------------------------------
# Sort and assign one-to-one matches (ensure all matched)
# ---------------------------------------------------------
final_scores = sorted(final_scores, key=lambda x: x["final_score"], reverse=True)

# Collect all IDs
all_mentors = {m for m, _ in academia_lookup.keys()}
all_mentees = {n for _, n in academia_lookup.keys()}

matched_mentors = set()
matched_mentees = set()
final_matches = []

# Greedy one-to-one assignment
for item in final_scores:
    mentor = item["mentor_id"]
    mentee = item["mentee_id"]
    if mentor not in matched_mentors and mentee not in matched_mentees:
        matched_mentors.add(mentor)
        matched_mentees.add(mentee)
        final_matches.append(item)

# If any mentors or mentees remain unmatched, assign them to the best available remaining option
for mentee in all_mentees - matched_mentees:
    best_match = None
    best_score = -1
    for item in final_scores:
        if item["mentee_id"] == mentee and item["mentor_id"] not in matched_mentors:
            if item["final_score"] > best_score:
                best_score = item["final_score"]
                best_match = item
    if best_match:
        matched_mentors.add(best_match["mentor_id"])
        matched_mentees.add(best_match["mentee_id"])
        final_matches.append(best_match)

# Same for leftover mentors (in case mentees were fewer)
for mentor in all_mentors - matched_mentors:
    best_match = None
    best_score = -1
    for item in final_scores:
        if item["mentor_id"] == mentor and item["mentee_id"] not in matched_mentees:
            if item["final_score"] > best_score:
                best_score = item["final_score"]
                best_match = item
    if best_match:
        matched_mentors.add(best_match["mentor_id"])
        matched_mentees.add(best_match["mentee_id"])
        final_matches.append(best_match)

# ---------------------------------------------------------
# Save and print summary
# ---------------------------------------------------------
with open(output_path, "w") as f:
    json.dump(final_matches, f, indent=4)

print(f" Matching completed. {len(final_matches)} total pairs created (all matched).")
print(f" Results saved to {output_path}")
print(f" Hard rejections (no language/gender): {rejected_hard}\n")

print(" Top 5 matches:")
for item in sorted(final_matches, key=lambda x: x["final_score"], reverse=True)[:5]:
    print(f"Mentor {item['mentor_id']} ↔ Mentee {item['mentee_id']} | "
          f"Final={item['final_score']:.3f} | "
          f"Aca={item['academia_score']:.3f}, Geo={item['geo_score']:.3f}, "
          f"Gender={item['gender_score']:.2f}, Lang={item['language_score']:.2f}")




# -------------------------------------------------------------
# New function: Compute final matches from in-memory data
# -------------------------------------------------------------
def compute_final_matches_from_data(
    category_results: Dict[str, Any],
    manual_matches: Optional[List[str]] = None,
    manual_non_matches: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Compute final matches from category results data (in-memory).
    
    This function works with data directly from run_all_categories_with_params
    instead of loading JSON files from disk.
    
    Args:
        category_results: Dictionary with keys:
            - "gender": Dict[Tuple[int, int], float]
            - "academia": Dict[Tuple[int, int], float]
            - "languages": Dict[Tuple[int, int], Dict[str, Any]] (has "score" key)
            - "age_difference": Dict[Tuple[int, int], float]
            - "geographic_proximity": Dict[Tuple[int, int], float]
        manual_matches: Optional list of strings in format "mentor_id-mentee_id" 
                        to force as matches (override with +inf score)
        manual_non_matches: Optional list of strings in format "mentor_id-mentee_id"
                           to force as non-matches (override with -inf score and exclude)
    
    Returns:
        List of final match dictionaries, each containing:
        - mentor_id: str
        - mentee_id: str
        - gender_score: float
        - language_score: float
        - academia_score: float
        - geo_score: float
        - age_score: float
        - final_score: float
    """
    # Extract lookup dictionaries
    gender_results = category_results.get("gender", {})
    languages_results = category_results.get("languages", {})
    academia_results = category_results.get("academia", {})
    age_results = category_results.get("age_difference", {})
    geo_results = category_results.get("geographic_proximity", {})
    
    # Build lookup dictionaries (keys are already tuples)
    # For languages, extract score from nested dict
    def extract_language_score(value: Any) -> float:
        """Extract score from languages result (can be dict or float)"""
        if isinstance(value, dict):
            return float(value.get("score", 0))
        return float(value) if value is not None else 0.0
    
    # Parse manual matches and non-matches
    manual_match_set = set()
    if manual_matches:
        for pair_str in manual_matches:
            if '-' in pair_str:
                manual_match_set.add(pair_str)  # Store as string "mentor_id-mentee_id"
    
    manual_non_match_set = set()
    if manual_non_matches:
        for pair_str in manual_non_matches:
            if '-' in pair_str:
                manual_non_match_set.add(pair_str)  # Store as string "mentor_id-mentee_id"
    
    # Combine and filter (revised: only reject truly invalid pairs)
    final_scores = []
    rejected_hard = 0
    
    # Use academia_results keys as base (since it should have all pairs)
    # Note: academia_results keys are (mentee_id, mentor_id) tuples
    for key in academia_results.keys():
        mentee_id, mentor_id = key  # Fix order: mentee_id first, mentor_id second
        pair_key = f"{mentor_id}-{mentee_id}"
        
        # Check for manual non-matches first (exclude these pairs)
        if pair_key in manual_non_match_set:
            rejected_hard += 1
            continue
        
        # Extract scores
        gender_score = float(gender_results.get(key, 0))
        
        # Handle languages (can be dict with "score" key)
        language_value = languages_results.get(key, 0)
        language_score = extract_language_score(language_value)
        
        academia_score = float(academia_results.get(key, 0))
        
        # Handle age_score - can be float('-inf') or a regular float
        age_value = age_results.get(key, 0)
        try:
            age_score = float(age_value) if age_value is not None else 0.0
            # Check if it's -inf (after conversion)
            if age_score == float('-inf'):
                age_score = float('-inf')
        except (ValueError, TypeError):
            age_score = 0.0
        
        geo_score = float(geo_results.get(key, 0))
        
        # Check for manual matches (override with +inf score)
        is_manual_match = pair_key in manual_match_set
        
        if is_manual_match:
            # Force match: set final_score to +inf
            total_score = float('inf')
        else:
            # Include ALL pairs, even with low scores or -inf
            # Don't filter out pairs - let frontend display all combinations
            # Weighted combination (will be 0 or negative if scores are low/-inf)
            total_score = 0.7 * academia_score + 0.3 * geo_score
            
            # If any critical score is -inf, set final_score to -inf
            if gender_score == float('-inf') or language_score == float('-inf') or age_score == float('-inf') or geo_score == float('-inf'):
                total_score = float('-inf')
            elif gender_score == 0 or language_score == 0:
                # Invalid pair - set to 0 (will be displayed as light gray)
                total_score = 0.0
        
        final_scores.append({
            "mentor_id": str(mentor_id),
            "mentee_id": str(mentee_id),
            "gender_score": float(gender_score),
            "language_score": float(language_score),
            "academia_score": float(academia_score),
            "geo_score": float(geo_score),
            "age_score": float(age_score),
            "final_score": float(total_score)
        })
    
    # Return ALL pairs (not just one-to-one matches)
    # Sort by final_score for easier viewing (highest first)
    final_scores = sorted(final_scores, key=lambda x: x["final_score"], reverse=True)
    
    return final_scores


# -------------------------------------------------------------
# Assumptions and Matching Logic
# -------------------------------------------------------------

# Input Data Format:
#     - Each results_*.json file contains a single top-level key (e.g., "gender", "languages").
#     - Keys inside are pairs of the form "mentorID-menteeID".
#     - Values are either:
#         • a numeric score (e.g., 0.75), or
#         • an object with {"score": float, "common_language": str} in the case of languages.

# Hard Constraints (must-match conditions):
#     - If gender_score == 0 → the pair is invalid (they prefer not to be matched).
#     - If language_score == 0 → no common language, so pair is invalid.
#     - All other pairs (even low scores) are still considered for matching.

# Soft Scoring Logic:
#     - Final score combines only academic similarity and geographic proximity:
#           final_score = 0.7 * academia_score + 0.3 * geographic_score
#     - Language and gender are used as eligibility filters, not weighted in the final score.

# One-to-One Matching:
#     - Each mentor and mentee can only appear in one final pair.
#     - The algorithm first sorts all valid pairs by final_score (descending).
#     - It greedily assigns the best available match for each mentee/mentor.
#     - If any mentors or mentees remain unmatched, it performs a second pass to assign them
#       to the best remaining option (so everyone ends up matched).