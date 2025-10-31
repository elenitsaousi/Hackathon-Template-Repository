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
    <Card className="border-2 border-blue-500 h-[600px] w-full max-w-full flex flex-col overflow-hidden">
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
  
  return (
    <>
      <DetailItem label="Mentor Number" value={mentor.id} />
      <DetailItem 
        label="Aktuelle oder zuletzt abgeschlossene Studienstufe / Current or most recently completed level of study" 
        value={raw.studyLevel || mentor.currentlyStudying || 'N/A'} 
      />
      <DetailItem 
        label="Aktueller oder zuletzt abgeschlossener Studiengang / Current or most recently completed course of study" 
        value={raw.studyCourse || mentor.degree || 'N/A'} 
      />
      <DetailItem 
        label="Geburtsdatum / Date of birth" 
        value={raw.dateOfBirth || 'N/A'} 
      />
      <DetailItem 
        label="Geschlecht / Gender" 
        value={raw.gender || mentor.gender || 'N/A'} 
      />
      <DetailItem 
        label="Postadresse / Postal address" 
        value={raw.postalAddress || mentor.location || 'N/A'} 
      />
      <DetailItem 
        label="Sprachkenntnisse Deutsch / Language skills German" 
        value={raw.germanLanguage || 'N/A'} 
      />
      <DetailItem 
        label="Sprachkenntnisse Englisch / Language skills English" 
        value={raw.englishLanguage || 'N/A'} 
      />
      <DetailItem 
        label="Weitere Sprachkenntnisse / Other language skills" 
        value={raw.otherLanguages || 'N/A'} 
      />
    </>
  );
}

function MenteeDetails({ mentee }: { mentee: Mentee }) {
  const raw = mentee.rawData || {};
  
  return (
    <>
      <DetailItem label="Mentee Number" value={mentee.id} />
      <DetailItem label="Birthday" value={raw.birthday || 'N/A'} />
      <DetailItem label="Desired Studies" value={raw.desiredStudies || 'N/A'} />
      <DetailItem label="Desired gender of mentor" value={raw.desiredGender || 'N/A'} />
      <DetailItem label="English" value={raw.english || 'N/A'} />
      <DetailItem label="Further language skills" value={raw.furtherLanguageSkills || 'N/A'} />
      <DetailItem label="Gender" value={raw.gender || mentee.gender || 'N/A'} />
      <DetailItem label="German" value={raw.german || 'N/A'} />
      <DetailItem label="Residence (city)" value={raw.residenceCity || mentee.location || 'N/A'} />
      <DetailItem 
        label="Do you know if you want to study, and if yes, why? Do you know what you want to study, and if yes, what and why?" 
        value={raw.studyReason || 'N/A'} 
      />
      <DetailItem label="Previous studies (level)" value={raw.previousStudies || mentee.degree || 'N/A'} />
      <DetailItem label="Name and country of last degree" value={raw.degreeNameCountry || 'N/A'} />
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

