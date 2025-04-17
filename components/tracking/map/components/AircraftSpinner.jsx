// components/tracking/map/components/AircraftSpinner.jsx
import React, { useEffect } from 'react';
import styles from '../../../../styles/AircraftSpinner.module.css';

const AircraftSpinner = ({ isLoading }) => {
  // Use body class for hiding/showing the overlay
  useEffect(() => {
    if (isLoading) {
      document.body.classList.remove(styles.loaded);
    } else {
      document.body.classList.add(styles.loaded);
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.add(styles.loaded);
    };
  }, [isLoading]);

  // Don't render anything if not loading
  if (!isLoading) return null;

  return (
    <div className={styles.loadingOverlay}>
      <div className={styles.loadingContainer}>
        <div className={styles.aircraft}>✈️</div>
        <div className={`${styles.aircraft} ${styles.aircraft2}`}>✈️</div>
        <div className={`${styles.aircraft} ${styles.aircraft3}`}>✈️</div>
        <div className={`${styles.aircraft} ${styles.aircraft4}`}>✈️</div>
      </div>
    </div>
  );
};

export default AircraftSpinner;
