from typing import Any, Dict, Tuple

import pandas as pd


def _normalize_gender(value: Any) -> str:
    text = str(value).strip().lower() if value is not None else "unknown"
    if any(tok in text for tok in ["weiblich / female", "identify as female", "female"]):
        return "female"
    if any(tok in text for tok in ["männlich / male", "identify as male", "male"]):
        return "male"
    if any(tok in text for tok in ["doesn't matter", "doesn't matter", "any", "egal"]):
        return "any"
    return "unknown"

def gender_results(
    mentees_df: pd.DataFrame,
    mentors_df: pd.DataFrame,
    importance_modifier: float = 1.0,
) -> Dict[Tuple[int, int], float]:
    """
    Compute weighted pairing scores between mentees and mentors based on gender.

    Scoring rules:
    - 1.0 when mentee's desired gender exactly matches mentor's gender
    - 0.5 when desired gender is "any" and mentor gender is known (male/female)
    - 0.0 when either side is unknown or no rule applies
    - -inf for explicit mismatch: desired male with female mentor, or desired female with male mentor
    """
    mentee_id_col = "Mentee Number"
    mentor_id_col = "Mentor Number"
    mentor_gender_col = "Geschlecht / Gender"
    mentor_desired_gender_col = "Desired gender of mentor"

    # Normalize genders for all mentors for fast lookup
    mentor_gender_lookup: Dict[int, str] = {}
    for _, mentor_row in mentors_df.iterrows():
        mentor_id = mentor_row.get(mentor_id_col)
        mentor_gender = _normalize_gender(mentor_row.get(mentor_gender_col))
        mentor_gender_lookup[mentor_id] = mentor_gender

    # Normalize desired gender for all mentees for fast lookup
    mentee_desired_gender_lookup: Dict[int, str] = {}
    for _, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row.get(mentee_id_col)
        desired_gender = _normalize_gender(mentee_row.get(mentor_desired_gender_col))
        mentee_desired_gender_lookup[mentee_id] = desired_gender

    result: Dict[Tuple[int, int], float] = {}

    # Compute scores for all mentee-mentor pairs directly
    for _, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row.get(mentee_id_col)
        desired = mentee_desired_gender_lookup.get(mentee_id, "unknown")

        for _, mentor_row in mentors_df.iterrows():
            mentor_id = mentor_row.get(mentor_id_col)
            mentor_gender = mentor_gender_lookup.get(mentor_id, "unknown")
            
            print(f"Mentee {mentee_id} desired {desired} mentor {mentor_id} gender {mentor_gender}")

            if desired == "unknown" or mentor_gender == "unknown":
                score = 0.0
            elif desired == "any":
                score = 0.5 if mentor_gender in ("male", "female") else 0.0
            elif desired == mentor_gender:
                score = 1.0
            elif (desired == "male" and mentor_gender == "female") or (
                desired == "female" and mentor_gender == "male"
            ):
                score = float("-inf")
            else:
                score = 0.0

            result[(mentee_id, mentor_id)] = score * importance_modifier

    return result