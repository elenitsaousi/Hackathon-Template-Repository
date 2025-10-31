from typing import Any, Dict, Tuple
import pandas as pd
import re


# ------------------------------
# Convert CEFR level (A1–C2, Native) → numeric score
# ------------------------------
def _level_to_score(level: str) -> float:
    if not isinstance(level, str):
        return 0.0
    level = level.upper().strip()
    mapping = {"A1": 0.2, "A2": 0.4, "B1": 0.6, "B2": 0.75, "C1": 0.9, "C2": 1.0}
    for k, v in mapping.items():
        if k in level:
            return v
    if "NATIVE" in level or "MUTTERSPRACHE" in level:
        return 1.0
    return 0.0


def _score_to_label(value: float) -> str:
    """Convert numeric score back to readable CEFR label."""
    if value >= 0.95:
        return "Native"
    elif value >= 0.9:
        return "C1"
    elif value >= 0.75:
        return "B2"
    elif value >= 0.6:
        return "B1"
    elif value >= 0.4:
        return "A2"
    elif value >= 0.2:
        return "A1"
    else:
        return "Below A1"


def _shared_other_language(text1: str, text2: str) -> str | None:
    if not text1 or not text2:
        return None
    set1 = set(re.findall(r"[A-Za-zÀ-ÿ]+", text1.lower()))
    set2 = set(re.findall(r"[A-Za-zÀ-ÿ]+", text2.lower()))
    common = set1.intersection(set2)
    if len(common) > 0:
        return list(common)[0].capitalize()
    return None


def languages_results(
    mentees_df: pd.DataFrame,
    mentors_df: pd.DataFrame,
    importance_modifier: float = 1.0,
) -> Dict[Tuple[int, int], Dict[str, Any]]:
    """
    Language compatibility with CEFR levels and readable outputs.
    """
    results = {}
    summary = {"German": 0, "English": 0, "Other": 0, "No common language": 0}

    for _, mentee in mentees_df.iterrows():
        mentee_id = mentee["Mentee Number"]

        # --- Mentee language fields ---
        mentee_german_str = str(mentee.get("German", ""))
        mentee_english_str = str(mentee.get("English", ""))
        mentee_other_str = str(mentee.get("Further language skills", ""))

        mentee_german = _level_to_score(mentee_german_str)
        mentee_english = _level_to_score(mentee_english_str)

        for _, mentor in mentors_df.iterrows():
            mentor_id = mentor["Mentor Number"]

            # --- Mentor language fields ---
            mentor_german_str = str(
                mentor.get("Sprachkenntnisse Deutsch / Language skills German", "")
            )
            mentor_english_str = str(
                mentor.get("Sprachkenntnisse Englisch / Language skills English ", "")
            )
            mentor_other_str = str(
                mentor.get("Weitere Sprachkenntnisse / Other language skills ", "")
            )

            mentor_german = _level_to_score(mentor_german_str)
            mentor_english = _level_to_score(mentor_english_str)

            # --- Find shared other language ---
            shared_other = _shared_other_language(mentee_other_str, mentor_other_str)

            # --- Compute mutual language compatibility ---
            german_ok = mentee_german >= 0.6 and mentor_german >= 0.6
            english_ok = mentee_english >= 0.6 and mentor_english >= 0.6

            german_eff = (mentee_german + mentor_german) / 2 if german_ok else 0.0
            english_eff = (mentee_english + mentor_english) / 2 if english_ok else 0.0
            other_eff = 0.8 if shared_other else 0.0

            langs = {"German": german_eff, "English": english_eff}
            if shared_other:
                langs[shared_other] = other_eff

            best_lang, best_score = max(langs.items(), key=lambda x: x[1])

            # --- Weighted bilingual flexibility ---
            weighted_total = (
                0.45 * german_eff + 0.45 * english_eff + (0.10 if shared_other else 0)
            ) * importance_modifier

            if best_score < 0.6:
                best_lang = "No common language"

            results[(mentee_id, mentor_id)] = {
                "score": round(weighted_total, 3),
                "common_language": best_lang,
                "mentee_languages": {
                    "German": f"{mentee_german_str or '—'} ({_score_to_label(mentee_german)})",
                    "English": f"{mentee_english_str or '—'} ({_score_to_label(mentee_english)})",
                    "Other": mentee_other_str or "—",
                },
                "mentor_languages": {
                    "German": f"{mentor_german_str or '—'} ({_score_to_label(mentor_german)})",
                    "English": f"{mentor_english_str or '—'} ({_score_to_label(mentor_english)})",
                    "Other": mentor_other_str or "—",
                },
            }

            summary[best_lang] = summary.get(best_lang, 0) + 1

    total_pairs = len(results)
    communicative_pairs = total_pairs - summary["No common language"]
    print(" Language compatibility computed (B1+ threshold, combined score model)")
    print(f" {communicative_pairs}/{total_pairs} pairs can communicate effectively")
    print(f" Breakdown: {summary}")

    return results
