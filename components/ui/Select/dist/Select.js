"use strict";
exports.__esModule = true;
exports.Select = void 0;
var react_1 = require("react");
exports.Select = function (_a) {
    var label = _a.label, value = _a.value, onChange = _a.onChange, _b = _a.options, options = _b === void 0 ? [] : _b, _c = _a.placeholder, placeholder = _c === void 0 ? 'Select...' : _c, _d = _a.disabled, disabled = _d === void 0 ? false : _d, error = _a.error, _e = _a.isLoading, isLoading = _e === void 0 ? false : _e, _f = _a.isInitialLoad, isInitialLoad = _f === void 0 ? false : _f;
    var selectId = react_1["default"].useId();
    var handleChange = function (e) {
        onChange(e.target.value);
    };
    return (react_1["default"].createElement("div", { className: "flex flex-col gap-1", role: "group", "aria-labelledby": selectId + "-label" },
        react_1["default"].createElement("label", { id: selectId + "-label", htmlFor: selectId, className: "text-sm font-medium text-gray-700" }, label),
        react_1["default"].createElement("select", { id: selectId, name: label.toLowerCase().replace(/\s+/g, '-'), value: value, onChange: handleChange, disabled: disabled || isLoading, "aria-label": label, className: "w-full px-4 py-2 border rounded-md bg-white disabled:bg-gray-100\n                   focus:outline-none focus:ring-2 focus:ring-blue-500\n                   " + (error ? 'border-red-500' : 'border-gray-300') + "\n                   " + ((disabled || isLoading) ? 'cursor-not-allowed' : 'cursor-pointer') },
            react_1["default"].createElement("option", { value: "" }, isLoading ? "Loading..." : isInitialLoad ? "Loading initial data..." : placeholder),
            Array.isArray(options) && options.map(function (option) { return (react_1["default"].createElement("option", { key: option.value, value: option.value }, option.label)); })),
        error && (react_1["default"].createElement("p", { className: "mt-1 text-sm text-red-600", role: "alert" }, error))));
};
exports["default"] = exports.Select;
