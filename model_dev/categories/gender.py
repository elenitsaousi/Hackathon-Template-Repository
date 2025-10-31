from typing import Any, Dict
import pandas as pd

def _normalize_gender(value: Any) -> str:
    text = str(value).strip().lower() if value is not None else "unknown"
    if any(tok in text for tok in ["weiblich / female", "identify as female", "female"]):
        return "female"
    if any(tok in text for tok in ["männlich / male", "identify as male", "male"]):
        return "male"
    if any(tok in text for tok in ["doesn't matter", "any", "egal"]):
        return "any"
    return "unknown"


def gender_results(
    mentees_df: pd.DataFrame,
    mentors_df: pd.DataFrame,
    importance_modifier: float = 1.0,
) -> Dict[str, Dict[str, Any]]:
    """
    Return detailed results for all mentee–mentor pairs including genders and scores.
    """
    mentee_id_col = "Mentee Number"
    mentor_id_col = "Mentor Number"
    mentee_gender_col = "Gender"
    mentee_pref_col = "Desired gender of mentor"
    mentor_gender_col = "Geschlecht / Gender"

    detailed_results: Dict[str, Dict[str, Any]] = {}

    for _, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row[mentee_id_col]
        mentee_gender = _normalize_gender(mentee_row.get(mentee_gender_col, None))
        mentee_pref = _normalize_gender(mentee_row.get(mentee_pref_col, None))

        for _, mentor_row in mentors_df.iterrows():
            mentor_id = mentor_row[mentor_id_col]
            mentor_gender = _normalize_gender(mentor_row.get(mentor_gender_col, None))

            score = 0.0
            if mentee_pref in ["male", "female"]:
                if mentee_pref == mentor_gender:
                    score = 1.0
            elif mentee_pref == "any":
                score = 0.75

            final_score = score * importance_modifier

            detailed_results[f"{mentee_id}-{mentor_id}"] = {
                "gender_score": final_score,
                "mentee_gender": mentee_gender,
                "mentee_pref_gender": mentee_pref,
                "mentor_gender": mentor_gender,
            }

            print(
                f"Mentee {mentee_id} ({mentee_gender}, wants {mentee_pref}) ↔ "
                f"Mentor {mentor_id} ({mentor_gender}) → Score: {final_score}"
            )

    return detailed_results
