import React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import type { Mentor, Mentee } from '../types';

interface DetailPanelProps {
  person: Mentor | Mentee;
  type: 'mentor' | 'mentee';
  onClose: () => void;
}

export function DetailPanel({
  person,
  type,
  onClose,
}: DetailPanelProps) {
  return (
    <Card className="border-2 border-blue-500 h-[600px] w-full flex flex-col overflow-hidden">
      <div className="p-6 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={type === 'mentor' ? 'default' : 'secondary'}>
                {type === 'mentor' ? 'Mentor' : 'Mentee'}
              </Badge>
              <h2 className="text-gray-900">
                {type === 'mentor' 
                  ? `Mentor ${person.id}` 
                  : `Mentee ${person.id}`}
              </h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
        <h3 className="text-gray-900 mb-3 flex-shrink-0">Details</h3>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-3">
            {type === 'mentor' ? (
              <MentorDetails mentor={person as Mentor} />
            ) : (
              <MenteeDetails mentee={person as Mentee} />
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}

function MentorDetails({ mentor }: { mentor: Mentor }) {
  const raw = mentor.rawData || {};
  
  // Log available data for debugging
  console.log('Mentor data available:', {
    id: mentor.id,
    name: mentor.name,
    hasRawData: !!mentor.rawData,
    rawDataKeys: mentor.rawData ? Object.keys(mentor.rawData) : [],
    allMentorKeys: Object.keys(mentor),
    fullMentor: mentor,
  });
  
  // Collect all fields from mentor object
  const allFields: Array<{ label: string; value: string }> = [];
  
  // Basic info
  if (mentor.id) allFields.push({ label: 'Mentor Number', value: mentor.id });
  if (mentor.name) allFields.push({ label: 'Name', value: mentor.name });
  
  // All direct properties
  if (mentor.degree) allFields.push({ label: 'Degree / Course of study', value: mentor.degree });
  if (mentor.currentlyStudying) allFields.push({ label: 'Current / Most recently completed level of study', value: mentor.currentlyStudying });
  if (mentor.evaluation) allFields.push({ label: 'Evaluation', value: mentor.evaluation });
  if (mentor.birthYear) allFields.push({ label: 'Birth Year', value: String(mentor.birthYear) });
  if (mentor.gender) allFields.push({ label: 'Gender', value: mentor.gender });
  if (mentor.motivation) allFields.push({ label: 'Motivation', value: mentor.motivation });
  if (mentor.nationality) allFields.push({ label: 'Nationality', value: mentor.nationality });
  if (mentor.location) allFields.push({ label: 'Location / Postal address', value: mentor.location });
  if (mentor.availability) allFields.push({ label: 'Availability', value: mentor.availability });
  if (mentor.additionalInfo) allFields.push({ label: 'Additional Info', value: mentor.additionalInfo });
  
  // Languages
  if (mentor.languages && mentor.languages.length > 0) {
    allFields.push({ label: 'Languages', value: mentor.languages.join(', ') });
  }
  if (mentor.languageLevels && Object.keys(mentor.languageLevels).length > 0) {
    const levels = Object.entries(mentor.languageLevels)
      .map(([lang, level]) => `${lang}: ${level}`)
      .join(', ');
    allFields.push({ label: 'Language Levels', value: levels });
  }
  
  // Swiss experience (if exists in mentor object)
  if ('swissExperience' in mentor && mentor.swissExperience) {
    allFields.push({ label: 'Swiss Experience', value: String(mentor.swissExperience) });
  }
  if ('background' in mentor && mentor.background) {
    allFields.push({ label: 'Background', value: String(mentor.background) });
  }
  
  // Raw data fields (from CSV application form)
  if (raw.studyLevel) allFields.push({ label: 'Study Level (from raw data)', value: raw.studyLevel });
  if (raw.studyCourse) allFields.push({ label: 'Study Course (from raw data)', value: raw.studyCourse });
  if (raw.dateOfBirth) allFields.push({ label: 'Date of Birth (from raw data)', value: raw.dateOfBirth });
  if (raw.gender) allFields.push({ label: 'Gender (from raw data)', value: raw.gender });
  if (raw.postalAddress) allFields.push({ label: 'Postal Address (from raw data)', value: raw.postalAddress });
  if (raw.germanLanguage) allFields.push({ label: 'German Language Skills (from raw data)', value: raw.germanLanguage });
  if (raw.englishLanguage) allFields.push({ label: 'English Language Skills (from raw data)', value: raw.englishLanguage });
  if (raw.otherLanguages) allFields.push({ label: 'Other Languages (from raw data)', value: raw.otherLanguages });
  
  // Display all fields
  return (
    <>
      {allFields.map((field, index) => (
        <DetailItem key={`mentor-field-${index}`} label={field.label} value={field.value} />
      ))}
    </>
  );
}

function MenteeDetails({ mentee }: { mentee: Mentee }) {
  const raw = mentee.rawData || {};
  
  // Log available data for debugging
  console.log('Mentee data available:', {
    id: mentee.id,
    name: mentee.name,
    hasRawData: !!mentee.rawData,
    rawDataKeys: mentee.rawData ? Object.keys(mentee.rawData) : [],
    allMenteeKeys: Object.keys(mentee),
    fullMentee: mentee,
  });
  
  // Collect all fields from mentee object
  const allFields: Array<{ label: string; value: string }> = [];
  
  // Basic info
  if (mentee.id) allFields.push({ label: 'Mentee Number', value: mentee.id });
  if (mentee.name) allFields.push({ label: 'Name', value: mentee.name });
  
  // All direct properties
  if (mentee.background) allFields.push({ label: 'Background', value: mentee.background });
  if (mentee.availability) allFields.push({ label: 'Availability', value: mentee.availability });
  if (mentee.studyPlan) allFields.push({ label: 'Study Plan', value: mentee.studyPlan });
  if (mentee.threeYearPlan) allFields.push({ label: '3-Year Plan', value: mentee.threeYearPlan });
  if (mentee.studyLanguage) allFields.push({ label: 'Study Language', value: mentee.studyLanguage });
  if (mentee.languageLevel) allFields.push({ label: 'Language Level', value: mentee.languageLevel });
  if (mentee.mentorSupport) allFields.push({ label: 'Mentor Support', value: mentee.mentorSupport });
  if (mentee.seetKnowledge) allFields.push({ label: 'SEET Knowledge', value: mentee.seetKnowledge });
  if (mentee.conflictResolution) allFields.push({ label: 'Conflict Resolution', value: mentee.conflictResolution });
  if (mentee.eventInterest) allFields.push({ label: 'Event Interest', value: mentee.eventInterest });
  if (mentee.additionalInfo) allFields.push({ label: 'Additional Info', value: mentee.additionalInfo });
  if (mentee.gender) allFields.push({ label: 'Gender', value: mentee.gender });
  if (mentee.location) allFields.push({ label: 'Location / Residence (city)', value: mentee.location });
  if (mentee.degree) allFields.push({ label: 'Previous studies (level)', value: mentee.degree });
  if (mentee.age) allFields.push({ label: 'Age', value: String(mentee.age) });
  
  // Languages
  if (mentee.languages && mentee.languages.length > 0) {
    allFields.push({ label: 'Languages', value: mentee.languages.join(', ') });
  }
  
  // Support needs
  if (mentee.supportNeeds && mentee.supportNeeds.length > 0) {
    allFields.push({ label: 'Support Needs', value: mentee.supportNeeds.join(', ') });
  }
  
  // Raw data fields (from CSV application form)
  if (raw.birthday) allFields.push({ label: 'Birthday (from raw data)', value: raw.birthday });
  if (raw.desiredStudies) allFields.push({ label: 'Desired Studies (from raw data)', value: raw.desiredStudies });
  if (raw.desiredGender) allFields.push({ label: 'Desired gender of mentor (from raw data)', value: raw.desiredGender });
  if (raw.english) allFields.push({ label: 'English (from raw data)', value: raw.english });
  if (raw.furtherLanguageSkills) allFields.push({ label: 'Further language skills (from raw data)', value: raw.furtherLanguageSkills });
  if (raw.gender) allFields.push({ label: 'Gender (from raw data)', value: raw.gender });
  if (raw.german) allFields.push({ label: 'German (from raw data)', value: raw.german });
  if (raw.residenceCity) allFields.push({ label: 'Residence (city) (from raw data)', value: raw.residenceCity });
  if (raw.studyReason) allFields.push({ label: 'Study reason (from raw data)', value: raw.studyReason });
  if (raw.previousStudies) allFields.push({ label: 'Previous studies (level) (from raw data)', value: raw.previousStudies });
  if (raw.degreeNameCountry) allFields.push({ label: 'Name and country of last degree (from raw data)', value: raw.degreeNameCountry });
  
  // Display all fields
  return (
    <>
      {allFields.map((field, index) => (
        <DetailItem key={`mentee-field-${index}`} label={field.label} value={field.value} />
      ))}
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full overflow-hidden">
      <p className="text-xs text-gray-500 mb-1 break-words">{label}</p>
      <p className="text-sm text-gray-900 break-words overflow-wrap-anywhere">{value || 'N/A'}</p>
    </div>
  );
}

