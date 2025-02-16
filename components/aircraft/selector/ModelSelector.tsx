import React, { useEffect } from 'react';

interface Model {
  model: string;
  label: string;
  activeCount?: number;
  count?: number;
}

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: Model[];
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
  // 🔍 Debugging logs to verify component updates
  useEffect(() => {
    console.log(`[ModelSelector] Component mounted. Available models:`, models);
  }, []);

  useEffect(() => {
    console.log(
      `[ModelSelector] State updated - selectedModel:`,
      selectedModel
    );
  }, [selectedModel]);

  return (
    <div className="mt-2">
      <label
        htmlFor="model-select"
        className="block text-gray-700 text-sm font-bold mb-2"
      >
        Model
      </label>
      <select
        id="model-select"
        className="w-full p-2 border rounded-md bg-white shadow-sm"
        value={selectedModel}
        onChange={(e) => {
          const selected = e.target.value;
          console.log(`[ModelSelector] Model selected:`, selected);

          setSelectedModel(selected);
          onModelUpdate(selected);
        }}
      >
        {/* Default Option */}
        <option value="">All Models ({totalActive} active)</option>

        {/* List Models */}
        {models.map((m, index) => (
          <option key={index} value={m.model}>
            {m.label} ({m.model})
          </option>
        ))}
      </select>
    </div>
  );
};

export default React.memo(ModelSelector);
