import json
import os
import numpy as np
from scipy.optimize import linear_sum_assignment


# -------------------------------------------------------------
# Utility
# -------------------------------------------------------------
def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# -------------------------------------------------------------
# Combine all partial results
# -------------------------------------------------------------
def combine_scores(results_dir):
    """Combine gender, language, academia, and geographic proximity into unified dict."""
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

    print(f"📊 Total pairs: {len(combined)} (valid={sum(v['valid'] for v in combined.values())})")
    return combined


# -------------------------------------------------------------
# Optimal 1–1 matching (Hungarian algorithm)
# -------------------------------------------------------------
def perform_matching(combined):
    """Find maximum-weight 1–1 matching using only valid (>0) pairs."""
    mentees = sorted({int(p.split('-')[0]) for p in combined})
    mentors = sorted({int(p.split('-')[1]) for p in combined})
    n = len(mentees)
    m = len(mentors)

    score_matrix = np.zeros((n, m))
    mentee_to_idx = {mentee: i for i, mentee in enumerate(mentees)}
    mentor_to_idx = {mentor: j for j, mentor in enumerate(mentors)}

    for pair, data in combined.items():
        mentee, mentor = map(int, pair.split('-'))
        i, j = mentee_to_idx[mentee], mentor_to_idx[mentor]
        if data["valid"] and data["total_score"] > 0:
            score_matrix[i, j] = data["total_score"]
        else:
            score_matrix[i, j] = 0  # invalid pairs disallowed

    cost_matrix = -score_matrix
    row_ind, col_ind = linear_sum_assignment(cost_matrix)

    selected_pairs = []
    for i, j in zip(row_ind, col_ind):
        score = score_matrix[i, j]
        if score > 0:  # only keep positive valid matches
            pair = f"{mentees[i]}-{mentors[j]}"
            selected_pairs.append(pair)

    print(f"\n🎯 Final 1–1 valid matches: {len(selected_pairs)} total")
    return selected_pairs


# -------------------------------------------------------------
# Save results
# -------------------------------------------------------------
def save_results(selected_pairs, combined, output_all, output_best):
    # Save all pairs (100)
    result_all = {}
    for pair, data in combined.items():
        result_all[pair] = {**data, "selected": pair in selected_pairs}

    with open(output_all, "w", encoding="utf-8") as f:
        json.dump(result_all, f, indent=2, ensure_ascii=False)

    # Save only best (selected) pairs
    result_best = {p: combined[p] for p in selected_pairs}
    with open(output_best, "w", encoding="utf-8") as f:
        json.dump(result_best, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Saved all pairs to {output_all}")
    print(f"💾 Saved best 1–1 matches to {output_best}\n")

    print("🏆 Final matches:")
    for p in selected_pairs:
        m, n = p.split('-')
        print(f"  Mentee {m} → Mentor {n} | Score: {combined[p]['total_score']:.3f}")


# -------------------------------------------------------------
# Main
# -------------------------------------------------------------
def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.join(base_dir, "..")
    output_all = os.path.join(base_dir, "..", "results_final.json")
    output_best = os.path.join(base_dir, "..", "best_matches.json")

    combined = combine_scores(results_dir)
    selected_pairs = perform_matching(combined)
    save_results(selected_pairs, combined, output_all, output_best)


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
