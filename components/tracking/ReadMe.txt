# Aircraft Tracking Filter System Refactoring

This document outlines the refactoring of the aircraft tracking filter system from a monolithic Ribbon component to a more modular, maintainable architecture.

## File Structure

```
/components
  /tracking
    /filters
      FilterDropdown.tsx      # Main filter type selector
      ManufacturerFilter.tsx  # Manufacturer filter dropdown
      ModelFilter.tsx         # Aircraft model filter dropdown
      GeofenceFilter.tsx      # Location-based filter
      OwnerFilter.tsx         # Owner type filter
      RegionFilter.tsx        # Geographic region filter
      index.ts                # Barrel file for easy imports
    /hooks
      useFilterLogic.ts       # Custom hook for filter logic
    /types
      filters.ts              # TypeScript interfaces for filter components
    Ribbon.tsx                # Main Ribbon component (refactored)
```

## Components Overview

### FilterDropdown
Enhanced filter type selector with modern UI that allows users to choose which filtering method to use (manufacturer, geofence, region, owner, or combined).

### ManufacturerFilter
Handles aircraft manufacturer selection with searchable dropdown and clear selection functionality.

### ModelFilter
Displays models for the selected manufacturer with alphabetical grouping and highlights for popular models.

### GeofenceFilter
Provides location-based filtering with search, current location detection, and radius adjustment.

### OwnerFilter
Allows filtering by aircraft owner types with multi-select capabilities.

### RegionFilter
Enables filtering by geographic regions with visual region display on the map.

## Implementation Guide

### 1. Custom Hook: useFilterLogic

The `useFilterLogic` hook encapsulates all filter-related state and logic:

```typescript
import { useFilterLogic } from '../hooks/useFilterLogic';

// In your component:
const filterLogic = useFilterLogic();
const { 
  filterMode, 
  activeDropdown, 
  toggleFilterMode, 
  // ...other state and methods 
} = filterLogic;
```

### 2. Type Definitions

Create TypeScript interfaces for component props in `filters.ts`:

```typescript
// Example interface
export interface FilterDropdownProps {
  toggleFilterMode: (mode: FilterMode) => void;
  selectedManufacturer: string | null;
  isGeofenceActive: boolean;
  filterMode: FilterMode | null;
  // ...other props
}
```

### 3. Main Ribbon Component

The refactored Ribbon component composes the individual filter components:

```tsx
const RibbonAircraftSelector: React.FC<RibbonProps> = ({ manufacturers }) => {
  const filterLogic = useFilterLogic();
  
  return (
    <div className="w-full sticky top-0 z-[100] bg-white">
      <div className="flex items-center h-12">
        {/* Logo/Title */}
        
        {/* Filter components */}
        <FilterDropdown 
          toggleFilterMode={filterLogic.toggleFilterMode}
          selectedManufacturer={filterLogic.selectedManufacturer}
          isGeofenceActive={filterLogic.isGeofenceActive}
          filterMode={filterLogic.filterMode}
          activeDropdown={filterLogic.activeDropdown}
          toggleDropdown={filterLogic.toggleDropdown}
        />
        
        {/* Other filter components */}
        
        {/* Stats and action buttons */}
      </div>
    </div>
  );
};
```

## Benefits of the Refactoring

1. **Modular Design**: Each filter is a self-contained component
2. **Separation of Concerns**: Logic is separated from presentation
3. **Improved Maintainability**: Easier to update individual filters
4. **Type Safety**: Comprehensive TypeScript interfaces
5. **Enhanced UI**: Consistent styling and improved user experience
6. **Reusability**: Components can be used in other parts of the application
7. **Testability**: Components can be tested in isolation

## UI Improvements

- Rounded corners and consistent border styling
- Better visual indication of active filters
- Improved hover and active states
- Modern dropdown menus with enhanced usability
- Consistent spacing and typography
- Responsive loading indicators

## Implementation Steps

1. Create the directory structure
2. Add the type definitions
3. Implement the useFilterLogic hook
4. Create the individual filter components
5. Refactor the Ribbon component to use the new components
6. Create a barrel file for easy imports

## Additional Considerations

- Error handling is consistent across all filter types
- Rate limiting is handled gracefully
- All filter interactions maintain proper state
- Map interactions are synchronized with filter changes

This modular architecture makes future enhancements and bug fixes much easier to implement and maintain.