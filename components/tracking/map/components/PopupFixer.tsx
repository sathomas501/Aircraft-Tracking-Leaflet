// components/tracking/map/components/PopupFixer.tsx
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L, { Layer } from 'leaflet';

const PopupFixer = () => {
  const map = useMap();

  // Type guards for popup/tooltip support
  const hasPopup = (layer: any): layer is Layer & { _popup: L.Popup } =>
    '_popup' in layer && layer._popup instanceof L.Popup;

  const hasTooltip = (layer: any): layer is Layer & { _tooltip: L.Tooltip } =>
    '_tooltip' in layer && layer._tooltip instanceof L.Tooltip;

  const hasFeatureGroup = (
    layer: any
  ): layer is Layer & { _featureGroup: L.FeatureGroup } =>
    '_featureGroup' in layer && layer._featureGroup instanceof L.FeatureGroup;

  useEffect(() => {
    if (!map) return;

    const updatePopupsAndTooltips = () => {
      map.eachLayer((layer: Layer) => {
        // Update popups
        if (hasPopup(layer) && layer._popup.isOpen()) {
          layer._popup.update();
        }

        // Update tooltips
        if (hasTooltip(layer) && layer._tooltip.isOpen()) {
          layer._tooltip.update();
        }

        // If it's a cluster group with sublayers
        if (hasFeatureGroup(layer)) {
          layer._featureGroup.eachLayer((subLayer: any) => {
            if (hasPopup(subLayer) && subLayer._popup.isOpen()) {
              subLayer._popup.update();
            }
            if (hasTooltip(subLayer) && subLayer._tooltip.isOpen()) {
              subLayer._tooltip.update();
            }
          });
        }
      });
    };

    map.on('zoomend', updatePopupsAndTooltips);
    map.on('moveend', updatePopupsAndTooltips);

    return () => {
      map.off('zoomend', updatePopupsAndTooltips);
      map.off('moveend', updatePopupsAndTooltips);
    };
  }, [map]);

  return null;
};

export default PopupFixer;
