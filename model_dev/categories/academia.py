from typing import Any, Dict, Tuple
import pandas as pd
from sentence_transformers import SentenceTransformer, util
import torch


# -------------------------------
# Helper: Extract study level
# -------------------------------
LEVEL_MAP = {
    "high school": 0,
    "gymnasium": 0,
    "other": 0.5,
    "bachelor": 1.0,
    "undergraduate": 1.0,
    "master": 2.0,
    "msc": 2.0,
    "phd": 3.0,
    "doctorate": 3.0,
    "doctoral": 3.0,
    "professor": 4.0,
}


def extract_study_level(text: str) -> float:
    """Map study level text to numeric scale."""
    if not isinstance(text, str):
        return 0.0
    t = text.lower()
    for k, v in LEVEL_MAP.items():
        if k in t:
            return v
    return 0.0


# -------------------------------
# Swiss guidance score (mentor)
# -------------------------------
def swiss_guidance_score(text: str) -> float:
    """Estimate how experienced a mentor is with the Swiss university system."""
    if not isinstance(text, str):
        return 0.0
    t = text.lower()
    if any(k in t for k in ["very experienced", "eth", "uzh", "confident", "familiar", "studying myself"]):
        return 1.0
    if any(k in t for k in ["understands", "knows", "worked in academia"]):
        return 0.7
    if any(k in t for k in ["not sure", "limited", "have to find out"]):
        return 0.4
    return 0.0


# -------------------------------
# Mentee guidance need
# -------------------------------
def mentee_guidance_need(text: str) -> float:
    """Estimate how uncertain a mentee is about what or where to study."""
    if not isinstance(text, str):
        return 0.0
    t = text.lower()
    if any(k in t for k in ["not sure", "don't know", "open", "maybe", "decide", "explore", "unsure"]):
        return 1.0
    return 0.0


# -------------------------------
# Build textual profiles (clean fields)
# -------------------------------
def build_mentee_desired(row: pd.Series) -> str:
    """Main desired field profile."""
    fields = [
        row.get("Desired Studies", ""),
        row.get(
            "Do you know if you want to study, and if yes, why? Do you know what you want to study, and if yes, what and why?",
            "",
        ),
    ]
    return " ".join([str(f) for f in fields if pd.notna(f)]).strip()


def build_mentee_background(row: pd.Series) -> str:
    """Background (previous studies / degree info)."""
    fields = [
        row.get("Previous studies (level)", ""),
        row.get("Name and country of last degree", ""),
    ]
    return " ".join([str(f) for f in fields if pd.notna(f)]).strip()


def build_mentor_field(row: pd.Series) -> str:
    """Mentor’s study field only."""
    return str(
        row.get("Aktueller oder zuletzt abgeschlossener Studiengang / Current or most recently completed course of study", "")
    ).strip()


# -------------------------------
# Main similarity function
# -------------------------------
def academia_results(
    mentees_df: pd.DataFrame,
    mentors_df: pd.DataFrame,
    importance_modifier: float = 1.0,
) -> Dict[Tuple[int, int], float]:
    """
    Compute academic field alignment between mentees and mentors:
    55% desired field similarity
    15% background similarity
    25% level match
    5% guidance potential
    """

    model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

    mentee_desired = [build_mentee_desired(row) for _, row in mentees_df.iterrows()]
    mentee_background = [build_mentee_background(row) for _, row in mentees_df.iterrows()]
    mentor_fields = [build_mentor_field(row) for _, row in mentors_df.iterrows()]

    # Encode all text fields
    mentor_emb = model.encode(mentor_fields, convert_to_tensor=True, normalize_embeddings=True)
    mentee_desired_emb = model.encode(mentee_desired, convert_to_tensor=True, normalize_embeddings=True)
    mentee_background_emb = model.encode(mentee_background, convert_to_tensor=True, normalize_embeddings=True)

    # Compute similarities
    sim_desired = util.cos_sim(mentee_desired_emb, mentor_emb)
    sim_background = util.cos_sim(mentee_background_emb, mentor_emb)

    results = {}

    for i, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row["Mentee Number"]
        mentee_level = extract_study_level(
            str(mentee_row.get("Previous studies (level)", "")) + " " + str(mentee_row.get("Desired Studies", ""))
        )
        mentee_need = mentee_guidance_need(
            str(
                mentee_row.get(
                    "Do you know if you want to study, and if yes, why? Do you know what you want to study, and if yes, what and why?",
                    "",
                )
            )
        )

        for j, mentor_row in mentors_df.iterrows():
            mentor_id = mentor_row["Mentor Number"]
            mentor_level = extract_study_level(
                str(
                    mentor_row.get(
                        "Aktuelle oder zuletzt abgeschlossene Studienstufe / Current or most recently completed level of study",
                        "",
                    )
                )
            )
            mentor_guidance = swiss_guidance_score(
                mentor_row.get("Do you feel confident in navigating the Swiss university system?", "")
            )

            # Base scores
            desired_score = float(sim_desired[i][j].item())
            background_score = float(sim_background[i][j].item())

            # Level alignment
            if mentor_level >= mentee_level:
                level_score = 1.0
                penalty = 0.0
            elif mentee_level > 0:
                level_score = mentor_level / mentee_level
                penalty = (mentee_level - mentor_level) * 0.1
            else:
                level_score = 0.0
                penalty = 0.0

            # Guidance bonus
            guidance_bonus = 0.2 * mentee_need * mentor_guidance

            # Weighted combination
            final_score = (
                0.55 * desired_score
                + 0.15 * background_score
                + 0.25 * level_score
                - penalty
                + guidance_bonus
            )

            final_score = max(0.0, min(1.0, final_score * importance_modifier))
            results[(mentee_id, mentor_id)] = round(final_score, 3)

    print(" Academic alignment computed successfully (weighted desired vs background)")
    return results


# From Mentees:
# Desired Studies
# Do you know if you want to study... → motivation & target field
# Previous studies (level)
# Name and country of last degree

# From Mentors:
# Aktueller oder zuletzt abgeschlossener Studiengang / Current or most recently completed course of study
# Aktuelle oder zuletzt abgeschlossene Studienstufe / Current or most recently completed level of study
# Do you feel confident in navigating the Swiss university system?


# | Component                       | Compared Fields                                          | Weight   | Description                    |
# | ------------------------------- | -------------------------------------------------------- | -------- | ------------------------------ |
# |    **Desired Field Similarity** | mentee’s desired studies ↔ mentor’s current study course | **0.55** | Main semantic match            |
# |    **Background Similarity**    | mentee’s previous degree ↔ mentor’s study course         | **0.15** | Secondary academic alignment   |
# |    **Study Level Match**        | mentee desired/previous level ↔ mentor level             | **0.25** | Penalizes lower mentor level   |
# |    **Guidance Bonus**           | mentee uncertainty × mentor Swiss experience             | **0.05** | Adds small mentoring advantage |

# Embedding model: paraphrase-multilingual-MiniLM-L12-v2