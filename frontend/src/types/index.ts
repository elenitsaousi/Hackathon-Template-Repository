export interface Mentor {
  id: string;
  name: string;
  degree: string;
  currentlyStudying: string;
  evaluation: string;
  birthYear: number;
  gender: string;
  motivation: string;
  nationality: string;
  location: string;
  languages: string[];
  languageLevels: { [key: string]: string };
  availability: string;
  additionalInfo: string;
  rawData?: {
    studyLevel?: string;
    studyCourse?: string;
    dateOfBirth?: string;
    gender?: string;
    postalAddress?: string;
    germanLanguage?: string;
    englishLanguage?: string;
    otherLanguages?: string;
  };
}

export interface Mentee {
  id: string;
  name: string;
  background: string;
  availability: string;
  studyPlan: string;
  threeYearPlan: string;
  studyLanguage: string;
  languageLevel: string;
  supportNeeds: string[];
  mentorSupport: string;
  seetKnowledge: string;
  conflictResolution: string;
  eventInterest: string;
  additionalInfo: string;
  age?: number;
  gender?: string;
  location?: string;
  languages: string[];
  degree?: string;
  rawData?: {
    birthday?: string;
    desiredStudies?: string;
    desiredGender?: string;
    english?: string;
    furtherLanguageSkills?: string;
    gender?: string;
    german?: string;
    residenceCity?: string;
    studyReason?: string;
    previousStudies?: string;
    degreeNameCountry?: string;
  };
}

export interface Match {
  mentorId: string;
  menteeId: string;
  globalScore: number;
  scores: {
    gender: number;
    academia: number;
    languages: number;
    ageDifference: number;
    geographicProximity: number;
  };
  isImmutableNonMatch?: boolean;
}

export interface MatchingParameters {
  genderWeight: number;
  academiaWeight: number;
  languagesWeight: number;
  ageDifferenceWeight: number;
  geographicProximityWeight: number;
  maxAgeDifference: number;
  maxDistance?: number;
}
