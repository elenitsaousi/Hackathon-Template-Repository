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
    Compute weighted pairing scores between mentees and mentors based on gender columns:
    - mentee's gender,
    - desired gender of mentor,
    - mentor's own gender.

    Scoring rules:
    - 1.0 when mentee's desired gender exactly matches mentor's gender
    - 0.5 when desired gender is "any" and mentor gender equivalent to mentee's gender
    - 0.0 when either side is unknown or no rule applies
    - -inf for explicit mismatch (desired male/female and mentor gender is not the same)
    """

    mentee_id_col = "Mentee Number"
    mentor_id_col = "Mentor Number"
    mentor_gender_col = "Geschlecht / Gender"
    mentor_desired_gender_col = "Desired gender of mentor"
    mentee_gender_col = "Gender"

    result = {}

    for mentee_idx, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row[mentee_id_col]
        mentee_gender = _normalize_gender(mentee_row.get(mentee_gender_col, None))
        mentee_desired_gender = _normalize_gender(mentee_row.get(mentor_desired_gender_col, None))

        for mentor_idx, mentor_row in mentors_df.iterrows():
            mentor_id = mentor_row[mentor_id_col]
            mentor_gender = _normalize_gender(mentor_row.get(mentor_gender_col, None))

            score = 0.0

            # Either side unknown, can't score; keep at 0.0
            if mentee_desired_gender == "unknown" or mentor_gender == "unknown":
                score = 0.0
            elif mentee_desired_gender in ["male", "female"]:
                if mentor_gender == mentee_desired_gender:
                    score = 1.0
                else:
                    score = float('-inf')
            elif mentee_desired_gender == "any":
                # Give half score if mentee and mentor have same gender (optionally)
                if mentee_gender != "unknown" and mentor_gender == mentee_gender:
                    score = 0.5
                else:
                    score = 0.0
            else:
                # No scoring rule applies
                score = 0.0

            result[(mentee_id, mentor_id)] = score * importance_modifier

    return result