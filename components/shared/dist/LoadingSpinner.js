"use strict";
exports.__esModule = true;
var react_1 = require("react");
var LoadingSpinner = react_1["default"].forwardRef(function LoadingSpinner(_a, ref) {
    var _b = _a.size, size = _b === void 0 ? 'md' : _b, message = _a.message;
    var sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16'
    };
    return (react_1["default"].createElement("div", { ref: ref, className: "flex flex-col items-center justify-center p-4" },
        react_1["default"].createElement("div", { className: "loading-spinner " + sizeClasses[size] }),
        message && (react_1["default"].createElement("p", { className: "mt-2 text-sm text-gray-600" }, message))));
});
LoadingSpinner.displayName = 'LoadingSpinner';
exports["default"] = LoadingSpinner;
