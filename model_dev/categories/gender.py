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
    Binary gender matching:
    - 1.0 when mentee's desired gender exactly matches mentor's gender
    - 0.0 otherwise (including 'doesn't matter' or mismatch)
    """

    mentee_id_col = "Mentee Number"
    mentor_id_col = "Mentor Number"
    mentor_gender_col = "Geschlecht / Gender"
    mentee_pref_col = "Desired gender of mentor"

    results: Dict[Tuple[int, int], float] = {}

    for _, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row[mentee_id_col]
        mentee_pref = _normalize_gender(mentee_row.get(mentee_pref_col, None))

        for _, mentor_row in mentors_df.iterrows():
            mentor_id = mentor_row[mentor_id_col]
            mentor_gender = _normalize_gender(mentor_row.get(mentor_gender_col, None))

            # Default: no match
            score = 0.0

            # Explicit gender preference
            if mentee_pref in ["male", "female"]:
                if mentee_pref == mentor_gender:
                    score = 1.0

            # If mentee says “doesn't matter / any / egal” → give medium weight (0.75)
            elif mentee_pref == "any":
                score = 0.75

            # Else (unknown or mismatch) stays 0.0

            results[(mentee_id, mentor_id)] = score * importance_modifier

    return results