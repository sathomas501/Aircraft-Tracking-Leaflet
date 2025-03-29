// components/shared/ui/DraggablePanel.tsx
import React, { useRef, useState, useEffect } from 'react';

export interface DraggablePanelProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  initialPosition?: { x: number; y: number };
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  zIndex?: number;
  maxWidth?: string;
  maxHeight?: string;
  children: React.ReactNode;
}

const DraggablePanel: React.FC<DraggablePanelProps> = ({
  isOpen,
  onClose,
  title,
  initialPosition = { x: 20, y: 20 },
  className = '',
  headerClassName = '',
  bodyClassName = '',
  zIndex = 1000,
  maxWidth = '320px',
  maxHeight = 'calc(100vh - 40px)',
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Initialize position on mount
  useEffect(() => {
    if (isOpen && initialPosition) {
      setPosition(initialPosition);
    }
  }, [isOpen, initialPosition]);

  // Handle mouse movement for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const maxX =
          window.innerWidth - (containerRef.current?.offsetWidth || 0);
        const maxY =
          window.innerHeight - (containerRef.current?.offsetHeight || 0);

        setPosition({
          x: Math.max(0, Math.min(maxX, e.clientX - dragOffset.x)),
          y: Math.max(0, Math.min(maxY, e.clientY - dragOffset.y)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, dragOffset]);

  // Start dragging
  const startDragging = (e: React.MouseEvent) => {
    if (
      e.target === containerRef.current ||
      (e.target as HTMLElement).closest('.drag-handle')
    ) {
      e.preventDefault();
      setIsDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex,
        maxWidth,
        maxHeight,
        overflow: 'auto',
      }}
      className={`bg-white rounded-lg shadow-lg p-4 ${className}`}
    >
      {/* Header with title and close button - made draggable */}
      <div
        className={`flex justify-between items-center mb-3 drag-handle cursor-grab ${headerClassName}`}
        onMouseDown={startDragging}
      >
        <div className="flex-grow text-center">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
        </div>
        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent drag trigger
              onClose();
            }}
            className="p-1 hover:bg-gray-100 rounded-full flex-shrink-0 ml-2"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Panel body */}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
};

export default DraggablePanel;
