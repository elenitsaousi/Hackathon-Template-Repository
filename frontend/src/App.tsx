import { useState } from 'react';
import { MatchingDashboard } from './components/MatchingDashboard';
import { Upload } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';

export default function App() {
  const [dataUploaded, setDataUploaded] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState({
    mentorApplication: null as File | null,
    mentorInterview: null as File | null,
    menteeApplication: null as File | null,
    menteeInterview: null as File | null,
  });

  const handleFileUpload = (type: keyof typeof uploadedFiles, file: File | null) => {
    setUploadedFiles(prev => ({ ...prev, [type]: file }));
  };

  const allFilesUploaded = Object.values(uploadedFiles).every(file => file !== null);

  const handleProceed = () => {
    if (allFilesUploaded) {
      setDataUploaded(true);
    }
  };

  if (dataUploaded) {
    return <MatchingDashboard uploadedFiles={uploadedFiles} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-gray-900 mb-2">Mentor-Mentee Matching Dashboard</h1>
          <p className="text-gray-600">Upload CSV files to begin the matching process</p>
          <div className="mt-4 space-y-3">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Backend API:</strong> The system will send data to your FastAPI backend at{' '}
                <code className="bg-blue-100 px-1 rounded">http://localhost:8000/matching</code> to calculate category scores.
              </p>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900 mb-2">
                <strong>CSV Format:</strong> Files can be comma or tab-separated. Check browser console for parsing details.
              </p>
              <details className="text-xs text-amber-800 mt-2">
                <summary className="cursor-pointer font-medium mb-1">Expected CSV Structure</summary>
                <ul className="space-y-1 ml-4 list-disc mt-2">
                  <li><strong>Mentor Application:</strong> ID, Name, Degree, Currently Studying, Evaluation, Birth Year, Gender, Motivation, Nationality, Location, Languages, Language Levels, Availability, Additional Info</li>
                  <li><strong>Mentor Interview:</strong> Additional structured interview data</li>
                  <li><strong>Mentee Application:</strong> Application form responses</li>
                  <li><strong>Mentee Interview:</strong> ID, Background, Availability, Study Plan, Three Year Plan, Study Language, Language Level, Support Needs, Mentor Support, SEET Knowledge, Conflict Resolution, Event Interest, Additional Info</li>
                </ul>
              </details>
            </div>
          </div>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <FileUploadSection
              title="Mentor Application Data"
              description="Upload the CSV file containing mentor application information"
              file={uploadedFiles.mentorApplication}
              onFileChange={(file) => handleFileUpload('mentorApplication', file)}
            />

            <FileUploadSection
              title="Mentor Interview Data"
              description="Upload the CSV file containing mentor interview responses"
              file={uploadedFiles.mentorInterview}
              onFileChange={(file) => handleFileUpload('mentorInterview', file)}
            />

            <FileUploadSection
              title="Mentee Application Data"
              description="Upload the CSV file containing mentee application information"
              file={uploadedFiles.menteeApplication}
              onFileChange={(file) => handleFileUpload('menteeApplication', file)}
            />

            <FileUploadSection
              title="Mentee Interview Data"
              description="Upload the CSV file containing mentee interview responses"
              file={uploadedFiles.menteeInterview}
              onFileChange={(file) => handleFileUpload('menteeInterview', file)}
            />

            <div className="pt-4 border-t flex gap-3">
              <Button
                onClick={handleProceed}
                disabled={!allFilesUploaded}
                className="flex-1"
              >
                Proceed with Uploaded Files
              </Button>
              <Button
                onClick={() => setDataUploaded(true)}
                variant="outline"
                className="flex-1"
              >
                Use Data from Data Directory
              </Button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              Upload CSV files or click "Use Data from Data Directory" to load from the backend data folder
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FileUploadSection({
  title,
  description,
  file,
  onFileChange,
}: {
  title: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="mb-3">
        <h3 className="text-gray-900 mb-1">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex-1">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] || null;
              onFileChange(selectedFile);
            }}
          />
          <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors">
            {file ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Upload className="w-4 h-4" />
                <span className="text-sm">{file.name}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Click to upload CSV</span>
              </div>
            )}
          </div>
        </label>

        {file && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFileChange(null)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
