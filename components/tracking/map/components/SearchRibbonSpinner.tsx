// components/tracking/map/components/SearchRibbonSpinner.tsx
import React from 'react';
import styles from '../../../../styles/SearchRibbonSpinner.module.css';

interface SearchRibbonSpinnerProps {
  isLoading: any;
  loadingText?: string; // Add the loadingText prop
}

const SearchRibbonSpinner: React.FC<SearchRibbonSpinnerProps> = ({
  isLoading,
  loadingText = 'Searching for aircraft...',
}) => {
  if (!isLoading) return null;

  return (
    <div className={styles.searchRibbonContainer}>
      <div className={styles.searchRibbon}>
        <div className={styles.aircraftContainer}>
          <div className={styles.aircraft}>✈️</div>
          <div className={`${styles.aircraft} ${styles.aircraft2}`}>✈️</div>
          <div className={`${styles.aircraft} ${styles.aircraft3}`}>✈️</div>
        </div>
        <div className={styles.loadingText}>{loadingText}</div>
      </div>
    </div>
  );
};

export default SearchRibbonSpinner;
