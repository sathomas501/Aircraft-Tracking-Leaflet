"use strict";
exports.__esModule = true;
var react_1 = require("react");
var api_1 = require("@react-google-maps/api");
var AircraftInfo_1 = require("@/components/AircraftInfo");
var LoadingSpinner_1 = require("@/components/LoadingSpinner");
var GOOGLE_MAPS_LIBRARIES = ['places'];
var MapComponent = function (_a) {
    var aircraft = _a.aircraft, selectedAircraft = _a.selectedAircraft, trails = _a.trails, onSelect = _a.onSelect, onDeselect = _a.onDeselect, onMapReady = _a.onMapReady, _b = _a.isLoading, isLoading = _b === void 0 ? false : _b, _c = _a.isInitialLoad, isInitialLoad = _c === void 0 ? false : _c;
    var _d = api_1.useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: GOOGLE_MAPS_LIBRARIES
    }), isLoaded = _d.isLoaded, loadError = _d.loadError;
    var _e = react_1["default"].useState(null), infoWindow = _e[0], setInfoWindow = _e[1];
    var _f = react_1["default"].useState(null), mapInstance = _f[0], setMapInstance = _f[1];
    var mapOptions = react_1.useMemo(function () { return ({
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        minZoom: 3,
        maxZoom: 18,
        gestureHandling: 'cooperative'
    }); }, []);
    var handleMarkerClick = react_1.useCallback(function (aircraft) {
        var position = {
            lat: Number(aircraft.latitude),
            lng: Number(aircraft.longitude)
        };
        setInfoWindow({ aircraft: aircraft, position: position });
        onSelect(aircraft);
    }, [onSelect]);
    var handleInfoWindowClose = react_1.useCallback(function () {
        setInfoWindow(null);
        onDeselect();
    }, [onDeselect]);
    var handleMapLoad = react_1.useCallback(function (map) {
        setMapInstance(map);
        console.log('Map instance loaded');
        if (onMapReady)
            onMapReady();
    }, [onMapReady]);
    if (loadError) {
        return (react_1["default"].createElement("div", { className: "flex items-center justify-center h-96 bg-gray-100 rounded-lg" },
            react_1["default"].createElement("div", { className: "text-center" },
                react_1["default"].createElement("p", { className: "text-red-500 mb-2" }, "Failed to load Google Maps"),
                react_1["default"].createElement("p", { className: "text-sm text-gray-600" }, "Please check your API key and try again"))));
    }
    if (!isLoaded) {
        return (react_1["default"].createElement("div", { className: "flex items-center justify-center h-96 bg-gray-100 rounded-lg" },
            react_1["default"].createElement(LoadingSpinner_1["default"], { size: "lg", message: "Loading map..." })));
    }
    return (react_1["default"].createElement("div", { className: "relative w-full h-[800px] bg-gray-100 rounded-lg overflow-hidden" },
        isLoading && !isInitialLoad && (react_1["default"].createElement("div", { className: "absolute inset-0 bg-white/80 flex items-center justify-center z-20" },
            react_1["default"].createElement(LoadingSpinner_1["default"], { size: "lg", message: "Loading aircraft data..." }))),
        react_1["default"].createElement(api_1.GoogleMap, { mapContainerClassName: "w-full h-full", center: { lat: 39.8283, lng: -98.5795 }, zoom: 4, options: mapOptions, onLoad: handleMapLoad },
            aircraft.map(function (plane) { return (react_1["default"].createElement(api_1.Marker, { key: plane.icao24, position: {
                    lat: Number(plane.latitude),
                    lng: Number(plane.longitude)
                }, onClick: function () { return handleMarkerClick(plane); }, icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 6,
                    fillColor: (selectedAircraft === null || selectedAircraft === void 0 ? void 0 : selectedAircraft.icao24) === plane.icao24 ? '#2563eb' : '#4b5563',
                    fillOpacity: 1,
                    strokeWeight: 1,
                    rotation: plane.heading || 0
                } })); }),
            infoWindow && (react_1["default"].createElement(api_1.InfoWindow, { position: infoWindow.position, onCloseClick: handleInfoWindowClose, options: { maxWidth: 300 } },
                react_1["default"].createElement("div", { className: "min-w-[300px]" },
                    react_1["default"].createElement(AircraftInfo_1.AircraftInfo, { aircraft: infoWindow.aircraft, compact: true })))))));
};
exports["default"] = react_1["default"].memo(MapComponent);
