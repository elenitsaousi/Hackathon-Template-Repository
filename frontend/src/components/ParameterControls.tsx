import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import type { MatchingParameters } from '../types';

interface ParameterControlsProps {
  parameters: MatchingParameters;
  onChange: (params: Partial<MatchingParameters>) => void;
}

export function ParameterControls({ parameters, onChange }: ParameterControlsProps) {
  const handleWeightChange = (key: keyof MatchingParameters, value: number[]) => {
    onChange({ [key]: value[0] });
  };

  const handleMaxAgeChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0) {
      onChange({ maxAgeDifference: numValue });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-gray-900 mb-3 text-sm font-medium">Category Weights</h3>
        <div className="grid grid-cols-5 gap-4">
          <WeightControl
            label="Gender"
            value={parameters.genderWeight}
            onChange={(value) => handleWeightChange('genderWeight', value)}
          />
          <WeightControl
            label="Academia"
            value={parameters.academiaWeight}
            onChange={(value) => handleWeightChange('academiaWeight', value)}
          />
          <WeightControl
            label="Languages"
            value={parameters.languagesWeight}
            onChange={(value) => handleWeightChange('languagesWeight', value)}
          />
          <WeightControl
            label="Age"
            value={parameters.ageDifferenceWeight}
            onChange={(value) => handleWeightChange('ageDifferenceWeight', value)}
          />
          <WeightControl
            label="Location"
            value={parameters.geographicProximityWeight}
            onChange={(value) => handleWeightChange('geographicProximityWeight', value)}
          />
        </div>
      </div>

      <div className="pt-4 border-t">
        <h3 className="text-gray-900 mb-3 text-sm font-medium">Thresholds</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxAge" className="text-sm">Max Age Difference (years)</Label>
            <Input
              id="maxAge"
              type="number"
              min="0"
              value={parameters.maxAgeDifference}
              onChange={(e) => handleMaxAgeChange(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxDistance" className="text-sm">Max Geographic Distance (km)</Label>
            <Input
              id="maxDistance"
              type="number"
              min="0"
              value={parameters.maxDistance || 200}
              onChange={(e) => {
                const numValue = parseInt(e.target.value);
                if (!isNaN(numValue) && numValue > 0) {
                  onChange({ maxDistance: numValue });
                }
              }}
              className="h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-700">{label}</Label>
        <span className="text-xs text-gray-600 font-medium">{value.toFixed(1)}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={onChange}
        min={0}
        max={2}
        step={0.1}
        className="w-full"
      />
    </div>
  );
}
