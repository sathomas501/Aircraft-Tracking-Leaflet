import React, { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Model {
  model: string;
  label: string;
  activeCount?: number;
  count?: number;
}

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: { model: string; label: string }[]; // ✅ Ensure correct type
  totalActive: number;
  onModelUpdate: (model: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  setSelectedModel,
  models,
  totalActive,
  onModelUpdate,
}) => {
  return (
    <div>
      <label htmlFor="model-select">Model</label>
      <select
        id="model-select"
        value={selectedModel}
        onChange={(e) => {
          const selected = e.target.value;
          setSelectedModel(selected);
          onModelUpdate(selected);
        }}
      >
        <option value="">All Models ({totalActive} active)</option>
        {models.map((m) => (
          <option key={m.model} value={m.model}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default React.memo(ModelSelector);
