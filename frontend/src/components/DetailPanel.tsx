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
  const columnOrder = mentor.rawDataColumnOrder;
  
  // Collect all fields from rawData (merged CSV columns)
  const allFields: Array<{ label: string; value: string }> = [];
  
  // Display columns in order: application CSV first, then interview CSV
  if (columnOrder) {
    // First, display application CSV columns
    for (const key of columnOrder.application) {
      const value = raw[key];
      if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
        allFields.push({ 
          label: key, 
          value: String(value) 
        });
      }
    }
    
    // Then, display interview CSV columns (only those not in application)
    for (const key of columnOrder.interview) {
      const value = raw[key];
      if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
        allFields.push({ 
          label: key, 
          value: String(value) 
        });
      }
    }
  } else {
    // Fallback: if column order is not available, use original behavior
    const sortedKeys = Object.keys(raw).sort((a, b) => {
      if (a.toLowerCase().includes('mentor number') || a === 'Mentor Number') return -1;
      if (b.toLowerCase().includes('mentor number') || b === 'Mentor Number') return 1;
      return a.localeCompare(b);
    });
    
    for (const key of sortedKeys) {
      const value = raw[key];
      if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
        allFields.push({ 
          label: key, 
          value: String(value) 
        });
      }
    }
  }
  
  // Display all fields
  return (
    <>
      {allFields.length > 0 ? (
        allFields.map((field, index) => (
          <DetailItem key={`mentor-field-${index}`} label={field.label} value={field.value} />
        ))
      ) : (
        <DetailItem label="No data available" value="No CSV data was loaded for this mentor." />
      )}
    </>
  );
}

function MenteeDetails({ mentee }: { mentee: Mentee }) {
  const raw = mentee.rawData || {};
  const columnOrder = mentee.rawDataColumnOrder;
  
  // Collect all fields from rawData (merged CSV columns)
  const allFields: Array<{ label: string; value: string }> = [];
  
  // Display columns in order: application CSV first, then interview CSV
  if (columnOrder) {
    // First, display application CSV columns
    for (const key of columnOrder.application) {
      const value = raw[key];
      if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
        allFields.push({ 
          label: key, 
          value: String(value) 
        });
      }
    }
    
    // Then, display interview CSV columns (only those not in application)
    for (const key of columnOrder.interview) {
      const value = raw[key];
      if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
        allFields.push({ 
          label: key, 
          value: String(value) 
        });
      }
    }
  } else {
    // Fallback: if column order is not available, use original behavior
    const sortedKeys = Object.keys(raw).sort((a, b) => {
      if (a.toLowerCase().includes('mentee number') || a === 'Mentee Number') return -1;
      if (b.toLowerCase().includes('mentee number') || b === 'Mentee Number') return 1;
      return a.localeCompare(b);
    });
    
    for (const key of sortedKeys) {
      const value = raw[key];
      if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
        allFields.push({ 
          label: key, 
          value: String(value) 
        });
      }
    }
  }
  
  // Display all fields
  return (
    <>
      {allFields.length > 0 ? (
        allFields.map((field, index) => (
          <DetailItem key={`mentee-field-${index}`} label={field.label} value={field.value} />
        ))
      ) : (
        <DetailItem label="No data available" value="No CSV data was loaded for this mentee." />
      )}
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

