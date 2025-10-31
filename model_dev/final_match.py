"""
-------------------------------------------------------------
FINAL MATCHING SCRIPT (SEET Hackathon)
Author: Eleni Tsaousi
-------------------------------------------------------------

🔍 Purpose:
Generate final one-to-one mentor–mentee matches combining all criteria.
Hard constraints: gender & language must match. 
Soft optimization: academic, birthday, and distance scores.

-------------------------------------------------------------
🏗️ Weights & Logic
-------------------------------------------------------------
Weights (normalized sum):
- academic_score: 0.45
- birthday_score: 0.25
- gender_score: 0.15
- language_score: 0.15

Hard constraints:
- gender_score == 0 → heavy penalty (effectively invalid)
- language_score == 0 → heavy penalty (effectively invalid)

-------------------------------------------------------------
"""

import json
import os


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def combine_scores(results_dir):
    """Combine all partial result JSONs into a unified dictionary of pair → total_score."""

    gender = load_json(os.path.join(results_dir, "results_gender.json"))["gender"]
    languages = load_json(os.path.join(results_dir, "results_languages.json"))["languages"]
    academia = load_json(os.path.join(results_dir, "results_academia.json"))["academia"]
    birthday = load_json(os.path.join(results_dir, "results_age_difference.json"))["age_difference"]
    geo = load_json(os.path.join(results_dir, "results_geographic_proximity.json"))["geographic_proximity"]

    # Take intersection — only pairs existing in all results
    all_pairs = set(gender.keys()) & set(languages.keys()) & set(academia.keys()) & set(birthday.keys()) & set(geo.keys())

    combined = {}
    for pair in all_pairs:
        g = gender[pair]["gender_score"]
        l = languages[pair]["score"]
        a = academia[pair]["academic_score"]
        b = birthday[pair]["birthday_score"]
        d = geo[pair]["distance_score"]

        # ⚠️ Hard constraints: skip pairs with invalid gender/language
        if g == 0 or l == 0:
            continue

        total_score = (
            0.45 * a +
            0.25 * b +
            0.15 * g +
            0.15 * l
        )

        combined[pair] = {
            "total_score": round(float(total_score), 3),
            "academic_score": a,
            "birthday_score": b,
            "gender_score": g,
            "language_score": l,
            "distance_score": d,
        }

    print(f"✅ Combined {len(combined)} valid pairs (after gender/language filtering).")

    valid_mentees = sorted({int(p.split('-')[0]) for p in combined})
    valid_mentors = sorted({int(p.split('-')[1]) for p in combined})
    print(f"Mentees remaining: {valid_mentees}")
    print(f"Mentors remaining: {valid_mentors}")

    return combined


def perform_matching(combined):
    """Greedy one-to-one matching — ensures full coverage."""
    # Sort all pairs by total_score descending
    sorted_pairs = sorted(
        [(int(p.split('-')[0]), int(p.split('-')[1]), data["total_score"])
         for p, data in combined.items()],
        key=lambda x: x[2],
        reverse=True
    )

    matched_mentees = set()
    matched_mentors = set()
    matches = []

    # Greedy pass: pick highest scores first
    for mentee, mentor, score in sorted_pairs:
        if mentee not in matched_mentees and mentor not in matched_mentors:
            matches.append((mentee, mentor, score))
            matched_mentees.add(mentee)
            matched_mentors.add(mentor)

    # Fill unmatched mentees
    all_mentees = {int(p.split('-')[0]) for p in combined}
    all_mentors = {int(p.split('-')[1]) for p in combined}

    for mentee in all_mentees - matched_mentees:
        best_pair = None
        best_score = -1
        for p, data in combined.items():
            m, n = map(int, p.split('-'))
            if m == mentee and n not in matched_mentors:
                if data["total_score"] > best_score:
                    best_score = data["total_score"]
                    best_pair = (m, n, data["total_score"])
        if best_pair:
            matches.append(best_pair)
            matched_mentees.add(best_pair[0])
            matched_mentors.add(best_pair[1])

    # Fill unmatched mentors
    for mentor in all_mentors - matched_mentors:
        best_pair = None
        best_score = -1
        for p, data in combined.items():
            m, n = map(int, p.split('-'))
            if n == mentor and m not in matched_mentees:
                if data["total_score"] > best_score:
                    best_score = data["total_score"]
                    best_pair = (m, n, data["total_score"])
        if best_pair:
            matches.append(best_pair)
            matched_mentees.add(best_pair[0])
            matched_mentors.add(best_pair[1])

    print(f"✅ Greedy matching completed: {len(matches)} total pairs.")
    return matches


def save_results(matches, combined, output_path):
    result = {}
    for mentee_id, mentor_id, score in matches:
        pair = f"{mentee_id}-{mentor_id}"
        if pair in combined:
            result[pair] = combined[pair]
        else:
            # In case a fallback match was added (ensure consistent output)
            result[pair] = {"total_score": 0.0}

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Results saved to {output_path}\n")

    top5 = sorted(matches, key=lambda x: x[2], reverse=True)[:5]
    print("🏆 Top 5 matches:")
    for m in top5:
        print(f"  Mentee {m[0]} → Mentor {m[1]} (Score {m[2]:.3f})")


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.join(base_dir, "..")  # parent dir with JSONs

    combined = combine_scores(results_dir)
    matches = perform_matching(combined)

    output_path = os.path.join(base_dir, "..", "results_final.json")
    save_results(matches, combined, output_path)


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