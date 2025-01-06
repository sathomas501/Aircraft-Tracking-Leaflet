"use strict";
exports.__esModule = true;
exports.CardContent = exports.CardHeader = exports.Card = void 0;
var React = require("react");
var Card = function (_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? '' : _b;
    return (React.createElement("div", { className: "bg-white rounded-lg shadow-lg " + className }, children));
};
exports.Card = Card;
var CardHeader = function (_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? '' : _b;
    return (React.createElement("div", { className: "p-6 border-b " + className }, children));
};
exports.CardHeader = CardHeader;
var CardContent = function (_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? '' : _b;
    return (React.createElement("div", { className: "p-6 " + className }, children));
};
exports.CardContent = CardContent;
Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardContent.displayName = 'CardContent';
