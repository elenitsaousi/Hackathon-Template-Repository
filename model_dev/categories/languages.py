from typing import Any, Dict, Tuple
import pandas as pd
import re


# ------------------------------
#  Convert CEFR level (A1–C2) → numeric score
# ------------------------------
def _level_to_score(level: str) -> float:
    if not isinstance(level, str):
        return 0.0
    level = level.upper()
    mapping = {"A1": 0.2, "A2": 0.4, "B1": 0.6, "B2": 0.75, "C1": 0.9, "C2": 1.0}
    for k, v in mapping.items():
        if k in level:
            return v
    if "NATIVE" in level or "MUTTERSPRACHE" in level:
        return 1.0
    return 0.0


# ------------------------------
#  Detect shared “Other” language (e.g. both list Spanish)
# ------------------------------
def _shared_other_language(text1: str, text2: str) -> str | None:
    if not text1 or not text2:
        return None
    set1 = set(re.findall(r"[A-Za-zÀ-ÿ]+", text1.lower()))
    set2 = set(re.findall(r"[A-Za-zÀ-ÿ]+", text2.lower()))
    common = set1.intersection(set2)
    if len(common) > 0:
        return list(common)[0].capitalize()
    return None


# ------------------------------
#  Main function
# ------------------------------
def languages_results(
    mentees_df: pd.DataFrame,
    mentors_df: pd.DataFrame,
    importance_modifier: float = 1.0,
) -> Dict[Tuple[int, int], Dict[str, Any]]:
    """
    Language compatibility based on B1+ mutual threshold (≥0.6).
    Chooses language with best combined communicative score.
    """

    results = {}
    summary = {"German": 0, "English": 0, "Other": 0, "No common language": 0}

    for _, mentee in mentees_df.iterrows():
        mentee_id = mentee["Mentee Number"]

        mentee_german = _level_to_score(mentee.get("German", ""))
        mentee_english = _level_to_score(mentee.get("English", ""))
        mentee_other = str(mentee.get("Further language skills", "")).lower()

        for _, mentor in mentors_df.iterrows():
            mentor_id = mentor["Mentor Number"]

            mentor_german = _level_to_score(
                mentor.get("Sprachkenntnisse Deutsch / Language skills German", "")
            )
            mentor_english = _level_to_score(
                mentor.get("Sprachkenntnisse Englisch / Language skills English ", "")
            )
            mentor_other = str(mentor.get("Weitere Sprachkenntnisse / Other language skills ", "")).lower()

            shared_other = _shared_other_language(mentee_other, mentor_other)

            # Each must have at least B1 (0.6) to communicate in that language
            german_ok = mentee_german >= 0.6 and mentor_german >= 0.6
            english_ok = mentee_english >= 0.6 and mentor_english >= 0.6

            german_eff = (mentee_german + mentor_german) / 2 if german_ok else 0.0
            english_eff = (mentee_english + mentor_english) / 2 if english_ok else 0.0
            other_eff = 0.8 if shared_other else 0.0  # only if explicit overlap

            langs = {
                "German": german_eff,
                "English": english_eff,
            }
            if shared_other:
                langs[shared_other] = other_eff

            best_lang, best_score = max(langs.items(), key=lambda x: x[1])

            # Weighted total emphasizes bilingual flexibility
            weighted_total = (
                0.45 * german_eff + 0.45 * english_eff + (0.10 if shared_other else 0)
            ) * importance_modifier

            # No sufficient language if best_score < 0.6 (below B1 level)
            if best_score < 0.6:
                best_lang = "No common language"

            results[(mentee_id, mentor_id)] = {
                "score": round(weighted_total, 3),
                "common_language": best_lang,
            }

            summary[best_lang] = summary.get(best_lang, 0) + 1

    total_pairs = len(results)
    communicative_pairs = total_pairs - summary["No common language"]
    print(" Language compatibility computed (B1+ threshold, combined score model)")
    print(f" {communicative_pairs}/{total_pairs} pairs can communicate effectively")
    print(f" Breakdown: {summary}")

    return results


# From Mentees:
# German                              → "German"
# English                             → "English"
# Further language skills             → "Further language skills" (includes other spoken languages)
# 4. What language do you want/plan to study in? (interview) → indicates study language preference

# From Mentors:
# Sprachkenntnisse Deutsch / Language skills German
# Sprachkenntnisse Englisch / Language skills English
# Weitere Sprachkenntnisse / Other language skills


# | Component                     | Compared Fields                                          | Weight   | Description |
# | ----------------------------- | -------------------------------------------------------- | -------- | ------------ |
# | **German Proficiency Match**  | mentee.German ↔ mentor.German                            | **0.45** | Evaluates mutual ability in German (min level ≥ B1 for both) |
# | **English Proficiency Match** | mentee.English ↔ mentor.English                          | **0.45** | Evaluates mutual ability in English (min level ≥ B1 for both) |
# | **Shared Other Language**     | mentee.Further languages ↔ mentor.Other languages        | **0.10** | Adds small bonus if they both list the same third language |
# | **Communication Threshold**   | —                                                       | —        | Requires both ≥ B1 (≥ 0.6) in at least one language to count as communicative |
# | **Best Common Language**      | German / English / Other                                 | —        | Chosen as the language with the highest combined score (average of both levels) |

# Calculation model:
# - CEFR levels converted to numeric scale: A1=0.2, A2=0.4, B1=0.6, B2=0.75, C1=0.9, C2/NATIVE=1.0
# - Each pair must have at least B1 (≥0.6) on both sides to qualify.
# - If multiple languages ≥ B1, the one with the highest combined score is selected as "common_language".
# - Final score = (0.45 * German_eff + 0.45 * English_eff + 0.10 * Other_eff) × importance_modifier
# - If no shared language ≥ B1 → "No common language"
