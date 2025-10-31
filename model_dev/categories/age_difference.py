<<<<<<< HEAD
=======
"""
Scoring logic for Age Difference

This module computes an age-difference-based compatibility score for each mentee-mentor pair, where the main principle is that smaller absolute age differences are preferable.

Implementation details:
- For each mentee and mentor, ages are calculated by parsing birth years from various data formats; invalid or missing data are handled gracefully.
- The absolute difference in ages (in years) between each mentee and mentor is computed.
- The score for each pair is calculated using a simple decay formula:
    - score = max(0, 1 - (abs(mentee_age - mentor_age) / 30.0))
    - This gives a score of 1 if ages are identical, and decreases linearly down to 0 as the age gap approaches or exceeds 30 years.
    - If the absolute age difference exceeds the allowed maximum (age_max_difference), the score is set to -inf.
- Scores are always in the range [0, 1], or -inf for disallowed pairs. If input ages are invalid or missing, the score is set to 0 for that pair.
- The final score is scaled by `importance_modifier` if provided.
- The result is a dictionary mapping (mentee_id, mentor_id) pairs to float scores in [0, 1] or -inf.

This setup prioritizes mentor-mentee pairs with age gaps under ~15 years (score ≥ 0.5) while not rewarding large age differences.
"""


>>>>>>> 12a0c3059d45c3556a79138f2cda3caf8ee6e6c8
from datetime import datetime
from typing import Any, Dict, Iterable, Optional, Tuple
import pandas as pd


# -------------------------------
# Helper functions
# -------------------------------
def _as_year(value: Any) -> Optional[int]:
    """Try to extract a valid 4-digit birth year from string or numeric input."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    # Numeric year
    if isinstance(value, (int, float)) and not pd.isna(value):
        year = int(value)
        return year if 1800 <= year <= 2100 else None

    # String year or date
    text = str(value).strip()
    if not text:
        return None

    # Exact 4-digit year
    if text.isdigit() and len(text) == 4:
        year = int(text)
        return year if 1800 <= year <= 2100 else None

    # Try to parse general date and extract year
    ts = pd.to_datetime(text, errors="coerce", dayfirst=False, utc=False)
    if pd.isna(ts):
        ts = pd.to_datetime(text, errors="coerce", dayfirst=True, utc=False)
    if pd.isna(ts):
        return None
    if isinstance(ts, pd.DatetimeIndex):
        ts = ts[0]
    return int(ts.year)


def _series_to_age_years(series: pd.Series, reference_year: int) -> Iterable[Optional[float]]:
    """Convert birth year series into numeric ages relative to a given reference year."""
    ages = []
    for v in series.tolist():
        year = _as_year(v)
        if year is None:
            ages.append(None)
        else:
            age = reference_year - year
            ages.append(float(age) if age >= 0 else None)
    return ages


# -------------------------------
# Main computation
# -------------------------------
def age_difference_results(
    mentees_df: pd.DataFrame,
    mentors_df: pd.DataFrame,
    importance_modifier: float = 1.0,
    reference_date: Optional[pd.Timestamp] = None,
<<<<<<< HEAD
) -> Dict[Tuple[int, int], Dict[str, Any]]:
    """
    Compute compatibility score based on absolute age difference and return structured info.
=======
    age_max_difference: Optional[int] = 30,
) -> Dict[Tuple[int, int], float]:
    """
    Normalized minimize score based on absolute age difference where:
    - 1.0 when ages are equal (difference == 0)
    - 0.0 when difference equals the range (max_age - min_age) across both datasets
    - -inf when abs(mentee_age - mentor_age) > age_max_difference

    If either value is missing/unparseable, score is 0.0.
>>>>>>> 12a0c3059d45c3556a79138f2cda3caf8ee6e6c8
    """
    mentee_id_col = "Mentee Number"
    mentor_id_col = "Mentor Number"
    mentor_dob_col = "Geburtsdatum / Date of birth"
    mentee_dob_col = "Birthday"

    ref = reference_date or pd.Timestamp(datetime.utcnow().date())
    reference_year = int(ref.year)

    # --- Birth year and age extraction ---
    mentee_birth_years = [_as_year(v) for v in mentees_df[mentee_dob_col]]
    mentor_birth_years = [_as_year(v) for v in mentors_df[mentor_dob_col]]

    mentee_ages = [
        (reference_year - y) if y is not None else None for y in mentee_birth_years
    ]
    mentor_ages = [
        (reference_year - y) if y is not None else None for y in mentor_birth_years
    ]

    all_ages = [a for a in mentee_ages + mentor_ages if a is not None]
    if not all_ages:
        print(" No valid birth years found.")
        return {}

    min_age = min(all_ages)
    max_age = max(all_ages)
    age_range = max_age - min_age if max_age > min_age else 1.0

    results: Dict[Tuple[int, int], Dict[str, Any]] = {}

    for mentee_idx, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row[mentee_id_col]
        mentee_year = mentee_birth_years[mentee_idx]
        mentee_age = mentee_ages[mentee_idx]

        for mentor_idx, mentor_row in mentors_df.iterrows():
            mentor_id = mentor_row[mentor_id_col]
            mentor_year = mentor_birth_years[mentor_idx]
            mentor_age = mentor_ages[mentor_idx]

            score = 0.0
            diff_years = None
            if mentee_age is not None and mentor_age is not None:
<<<<<<< HEAD
                diff_years = abs(mentee_age - mentor_age)
                score = max(0.0, 1.0 - (diff_years / 30.0))  # Decay formula

            results[(mentee_id, mentor_id)] = {
                "birthday_score": round(score * importance_modifier, 3),
                "mentee_birthday": str(mentee_year) if mentee_year else "unknown",
                "mentor_birthday": str(mentor_year) if mentor_year else "unknown",
                "difference_in_years": int(diff_years) if diff_years is not None else "unknown",
            }
=======
                diff = abs(mentee_age - mentor_age)
                if age_max_difference is not None and diff > age_max_difference:
                    score = float('-inf')
                else:
                    if age_range > 0:
                        score = max(0.0, 1.0 - (diff / age_range))
                    else:
                        score = 1.0

            results[(mentee_id, mentor_id)] = score * importance_modifier if score != float('-inf') else float('-inf')
>>>>>>> 12a0c3059d45c3556a79138f2cda3caf8ee6e6c8

    print(f" Age difference computed for {len(results)} mentor–mentee pairs.")
    return results
<<<<<<< HEAD
=======

>>>>>>> 12a0c3059d45c3556a79138f2cda3caf8ee6e6c8
