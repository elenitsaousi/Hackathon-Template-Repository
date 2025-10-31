import json
import os
from typing import Dict, Any, List, Optional


# -------------------------------------------------------------
# Utility functions
# -------------------------------------------------------------
def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# -------------------------------------------------------------
# Combine partial scores into one dictionary
# -------------------------------------------------------------
def combine_scores(results_dir):
    """Combine all result JSONs into a unified dictionary of pair → scores."""
    gender = load_json(os.path.join(results_dir, "results_gender.json"))["gender"]
    languages = load_json(os.path.join(results_dir, "results_languages.json"))["languages"]
    academia = load_json(os.path.join(results_dir, "results_academia.json"))["academia"]
    geo = load_json(os.path.join(results_dir, "results_geographic_proximity.json"))["geographic_proximity"]

    all_pairs = set(gender.keys()) & set(languages.keys()) & set(academia.keys()) & set(geo.keys())

    combined = {}
    for pair in all_pairs:
        g = gender[pair]["gender_score"]
        lang = languages[pair]["score"]
        a = academia[pair]["academic_score"]
        d = geo[pair]["distance_score"]

        # even if invalid, keep pair but mark it
        valid = (g > 0 and lang > 0)
        total_score = 0.7 * a + 0.3 * d if valid else 0.0

        combined[pair] = {
            "total_score": round(float(total_score), 3),
            "academic_score": round(float(a), 3),
            "gender_score": round(float(g), 3),
            "language_score": round(float(lang), 3),
            "distance_score": round(float(d), 3),
            "valid": valid,
        }

    print(f"📊 Total pairs loaded: {len(combined)} (including invalid)")
    valid_count = sum(1 for v in combined.values() if v["valid"])
    print(f"✅ Valid pairs (gender>0 & language>0): {valid_count}")

    mentees = sorted({int(p.split('-')[0]) for p in combined})
    mentors = sorted({int(p.split('-')[1]) for p in combined})
    print(f"Mentees: {mentees}")
    print(f"Mentors: {mentors}")

    # Optional preview
    print("\n📋 Preview of all mentor–mentee pairs:")
    for p, v in list(combined.items())[:15]:
        m, n = p.split('-')
        tag = "⭐" if v["valid"] else "❌"
        print(f"{tag} Mentee {m} – Mentor {n} | Total={v['total_score']}")

    return combined


# -------------------------------------------------------------
# Perform 1–1 matching (unique mentor & mentee)
# -------------------------------------------------------------
def perform_matching(combined):
    """Greedy 1–1 matching ensuring all mentees and mentors get paired."""
    valid_pairs = [
        (int(p.split('-')[0]), int(p.split('-')[1]), p, data["total_score"])
        for p, data in combined.items() if data["valid"]
    ]

    # Sort valid pairs by total_score
    sorted_pairs = sorted(valid_pairs, key=lambda x: x[3], reverse=True)

    matched_mentees = set()
    matched_mentors = set()
    selected_pairs = []

    # First pass: match valid pairs greedily
    for mentee, mentor, pair_key, score in sorted_pairs:
        if mentee not in matched_mentees and mentor not in matched_mentors:
            selected_pairs.append(pair_key)
            matched_mentees.add(mentee)
            matched_mentors.add(mentor)

    all_mentees = {int(p.split('-')[0]) for p in combined}
    all_mentors = {int(p.split('-')[1]) for p in combined}

    # Second pass: handle unmatched mentees
    for mentee in all_mentees - matched_mentees:
        best_pair = None
        best_score = -1
        for p, data in combined.items():
            m, n = map(int, p.split('-'))
            if m == mentee and n not in matched_mentors:
                if data["total_score"] > best_score:
                    best_pair = p
                    best_score = data["total_score"]
        if best_pair:
            selected_pairs.append(best_pair)
            matched_mentees.add(mentee)
            matched_mentors.add(int(best_pair.split('-')[1]))

    # Third pass: handle unmatched mentors (symmetry)
    for mentor in all_mentors - matched_mentors:
        best_pair = None
        best_score = -1
        for p, data in combined.items():
            m, n = map(int, p.split('-'))
            if n == mentor and m not in matched_mentees:
                if data["total_score"] > best_score:
                    best_pair = p
                    best_score = data["total_score"]
        if best_pair:
            selected_pairs.append(best_pair)
            matched_mentees.add(int(best_pair.split('-')[0]))
            matched_mentors.add(mentor)

    print(f"\n🎯 Final 1–1 matches: {len(selected_pairs)} total.")
    return selected_pairs



# -------------------------------------------------------------
# Save all pairs (100 total), highlighting the chosen ones
# -------------------------------------------------------------
def save_results(selected_pairs, combined, output_path):
    """Save all pairs with 'selected' flag for matched ones."""
    result = {}
    for pair, data in combined.items():
        result[pair] = {
            **data,
            "selected": pair in selected_pairs,
        }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Results saved to {output_path}")

    print("\n🏆 Final matches:")
    for p in selected_pairs:
        m, n = p.split('-')
        print(f"  Mentee {m} → Mentor {n} | Score: {combined[p]['total_score']:.3f}")


# -------------------------------------------------------------
# Compute final matches from in-memory data (for backend use)
# -------------------------------------------------------------
def compute_final_matches_from_data(
    results: Dict[str, Any],
    manual_matches: Optional[List[str]] = None,
    manual_non_matches: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Compute final matches from results dictionary returned by main.py.
    
    This function takes the results from run_all_categories() or run_all_categories_from_data()
    and computes final matching pairs, returning them as a list instead of saving to file.
    
    Args:
        results: Dictionary with category results from main.py. Expected structure:
            {
                "gender": {(mentee_id, mentor_id): {"gender_score": float}, ...},
                "academia": {(mentee_id, mentor_id): {"academic_score": float}, ...},
                "languages": {(mentee_id, mentor_id): {"score": float}, ...},
                "age_difference": {(mentee_id, mentor_id): {"birthday_score": float}, ...},
                "geographic_proximity": {(mentee_id, mentor_id): {"distance_score": float}, ...},
            }
            Note: Keys can be tuples (mentee_id, mentor_id) or strings "mentee_id-mentor_id"
        manual_matches: Optional list of pairs to force as matches (format: "mentor_id-mentee_id")
        manual_non_matches: Optional list of pairs to exclude (format: "mentor_id-mentee_id")
    
    Returns:
        List of final matched pairs, each as a dictionary with:
        {
            "mentor_id": int,
            "mentee_id": int,
            "total_score": float,
            "academic_score": float,
            "gender_score": float,
            "language_score": float,
            "distance_score": float,
            "age_difference_score": float,
        }
    """
    # Normalize keys to string format "mentee_id-mentor_id"
    def normalize_key(key):
        """Convert tuple key to string key."""
        if isinstance(key, tuple) and len(key) == 2:
            return f"{key[0]}-{key[1]}"
        return str(key)
    
    # Convert all results to use string keys
    normalized_results = {}
    for category, category_results in results.items():
        normalized_results[category] = {
            normalize_key(k): v for k, v in category_results.items()
        }
    
    gender = normalized_results.get("gender", {})
    languages = normalized_results.get("languages", {})
    academia = normalized_results.get("academia", {})
    age_difference = normalized_results.get("age_difference", {})
    geo = normalized_results.get("geographic_proximity", {})
    
    # Get all pairs that exist in all categories
    all_pairs = set(gender.keys()) & set(languages.keys()) & set(academia.keys()) & set(geo.keys())
    if age_difference:
        all_pairs = all_pairs & set(age_difference.keys())
    
    # Combine scores for each pair
    combined = {}
    for pair in all_pairs:
        # Extract scores (handle different key names in different categories)
        g_data = gender.get(pair, {})
        l_data = languages.get(pair, {})
        a_data = academia.get(pair, {})
        d_data = geo.get(pair, {})
        age_data = age_difference.get(pair, {}) if age_difference else {}
        
        # Get scores - handle both dict values and direct values
        g = g_data.get("gender_score", g_data) if isinstance(g_data, dict) else g_data
        lang = l_data.get("score", l_data) if isinstance(l_data, dict) else l_data
        a = a_data.get("academic_score", a_data) if isinstance(a_data, dict) else a_data
        d = d_data.get("distance_score", d_data) if isinstance(d_data, dict) else d_data
        age = age_data.get("birthday_score", age_data) if isinstance(age_data, dict) else age_data
        
        # Convert to float, handle inf/-inf
        def to_float(val):
            if val is None:
                return 0.0
            if isinstance(val, str):
                if val.lower() in ('inf', 'infinity'):
                    return float('inf')
                if val.lower() in ('-inf', '-infinity'):
                    return float('-inf')
            try:
                return float(val) if val is not None else 0.0
            except (ValueError, TypeError):
                return 0.0
        
        g = to_float(g)
        lang = to_float(lang)
        a = to_float(a)
        d = to_float(d)
        age = to_float(age) if age_data else 0.0
        
        # Validate pair (hard constraints: gender > 0 and language > 0)
        valid = (g > 0 and lang > 0)
        
        # Calculate total score: 0.7 * academia + 0.3 * geographic (only for valid pairs)
        total_score = 0.7 * a + 0.3 * d if valid else 0.0
        
        # Handle manual matches/non-matches
        # Note: pair is in "mentee_id-mentor_id" format, but manual_matches/non_matches
        # come in "mentor_id-mentee_id" format from frontend, so we need to check both formats
        mentee_id_str, mentor_id_str = pair.split('-')
        pair_mentor_mentee_format = f"{mentor_id_str}-{mentee_id_str}"  # Convert to "mentor_id-mentee_id"
        
        if manual_matches:
            # Check both formats
            if pair in manual_matches or pair_mentor_mentee_format in manual_matches:
                total_score = float('inf')
                valid = True
        
        if manual_non_matches:
            # Check both formats
            if pair in manual_non_matches or pair_mentor_mentee_format in manual_non_matches:
                total_score = float('-inf')
                valid = False
        
        combined[pair] = {
            "total_score": round(float(total_score), 3),
            "academic_score": round(float(a), 3),
            "gender_score": round(float(g), 3),
            "language_score": round(float(lang), 3),
            "distance_score": round(float(d), 3),
            "age_difference_score": round(float(age), 3),
            "valid": valid,
        }
    
    print(f"📊 Total pairs combined: {len(combined)} (including invalid)")
    valid_count = sum(1 for v in combined.values() if v["valid"])
    print(f"✅ Valid pairs (gender>0 & language>0): {valid_count}")
    
    # Perform matching
    selected_pairs = perform_matching(combined)
    
    # Return ALL pairs (not just matched ones) so frontend can calculate recommendations
    # Each pair includes total_score and all category scores
    # This matches the structure in results_final.json: all pairs with total_score, valid, and is_matched flag
    all_pairs = []
    for pair_key, match_data in combined.items():
        mentee_id, mentor_id = map(int, pair_key.split('-'))
        pair_data = match_data.copy()
        pair_data["mentor_id"] = mentor_id
        pair_data["mentee_id"] = mentee_id
        pair_data["is_matched"] = pair_key in selected_pairs  # Flag to indicate if this is in final 1-to-1 matching
        all_pairs.append(pair_data)
    
    print(f"\n🎯 Returning {len(all_pairs)} total pairs (including {len(selected_pairs)} final matched pairs).")
    print(f"   Structure: Each pair has mentor_id, mentee_id, total_score, and all category scores")
    print(f"   Sample pair: {all_pairs[0] if all_pairs else 'None'}")
    return all_pairs


# -------------------------------------------------------------
# Main (file-based processing)
# -------------------------------------------------------------
def main():
    """Main function for file-based processing - calculates results_final and saves to JSON."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.join(base_dir, "..")  # JSON folder path
    output_path = os.path.join(base_dir, "..", "results_final.json")

    combined = combine_scores(results_dir)
    selected_pairs = perform_matching(combined)
    save_results(selected_pairs, combined, output_path)


if __name__ == "__main__":
    main()



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
