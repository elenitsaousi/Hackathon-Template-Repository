import json
import os


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
        l = languages[pair]["score"]
        a = academia[pair]["academic_score"]
        d = geo[pair]["distance_score"]

        # even if invalid, keep pair but mark it
        valid = (g > 0 and l > 0)
        total_score = 0.7 * a + 0.3 * d if valid else 0.0

        combined[pair] = {
            "total_score": round(float(total_score), 3),
            "academic_score": round(float(a), 3),
            "gender_score": round(float(g), 3),
            "language_score": round(float(l), 3),
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
# Main
# -------------------------------------------------------------
def main():
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
