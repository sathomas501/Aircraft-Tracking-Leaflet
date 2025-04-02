'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while (_)
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                    ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
exports.__esModule = true;
var sqlite3_1 = require('sqlite3');
var path_1 = require('path');
function handler(req, res) {
  return __awaiter(this, void 0, void 0, function () {
    var MANUFACTURER,
      MODEL,
      page,
      pageSize,
      offset,
      dbPath,
      db,
      baseQuery,
      baseQuery_1,
      countQuery_1,
      params_1,
      queryParams_1,
      results,
      totalCount,
      error_1;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          MANUFACTURER = req.query.MANUFACTURER;
          MODEL = req.query.MODEL;
          page = parseInt(req.query.page) || 1;
          pageSize = parseInt(req.query.pageSize) || 50;
          offset = (page - 1) * pageSize;
          console.log('API Request:', {
            MANUFACTURER: MANUFACTURER,
            MODEL: MODEL,
            page: page,
            pageSize: pageSize,
            offset: offset,
          });
          if (!MANUFACTURER) {
            return [
              2 /*return*/,
              res.status(200).json({
                data: [],
                pagination: {
                  total: 0,
                  page: page,
                  pageSize: pageSize,
                  totalPages: 0,
                },
              }),
            ];
          }
          dbPath = path_1['default'].join(process.cwd(), 'lib', 'static.db');
          baseQuery =
            '\n  SELECT a.ICAO24, a.MANUFACTURER, a.MODEL, a.owner, a.name, a.city, a.state, a.manufacturer_icao\n  FROM aircraft a\n  WHERE a.MANUFACTURER = ?\n  ' +
            (MODEL ? 'AND a.MODEL = ?' : '') +
            '\n  LIMIT ? OFFSET ?\n';
          _a.label = 1;
        case 1:
          _a.trys.push([1, 4, 5, 6]);
          db = new sqlite3_1['default'].Database(
            dbPath,
            sqlite3_1['default'].OPEN_READONLY
          );
          baseQuery_1 =
            '\n      SELECT * FROM aircraft a\n      WHERE a.MANUFACTURER = ?\n    ';
          countQuery_1 =
            'SELECT COUNT(*) as total FROM aircraft a WHERE a.MANUFACTURER = ?';
          params_1 = [MANUFACTURER];
          if (MODEL) {
            baseQuery_1 += ' AND a.MODEL = ?';
            countQuery_1 += ' AND a.MODEL = ?';
            params_1.push(MODEL);
          }
          baseQuery_1 += ' LIMIT ? OFFSET ?';
          queryParams_1 = MODEL
            ? [MANUFACTURER, MODEL, pageSize.toString(), offset.toString()]
            : [MANUFACTURER, pageSize.toString(), offset.toString()];
          console.log('SQL Query:', {
            query: baseQuery_1,
            params: queryParams_1,
          });
          return [
            4 /*yield*/,
            new Promise(function (resolve, reject) {
              db.all(baseQuery_1, queryParams_1, function (err, rows) {
                if (err) reject(err);
                else resolve(rows || []);
              });
            }),
          ];
        case 2:
          results = _a.sent();
          return [
            4 /*yield*/,
            new Promise(function (resolve, reject) {
              db.get(countQuery_1, params_1, function (err, row) {
                if (err) reject(err);
                else
                  resolve(
                    (row === null || row === void 0 ? void 0 : row.total) || 0
                  );
              });
            }),
          ];
        case 3:
          totalCount = _a.sent();
          return [
            2 /*return*/,
            res.status(200).json({
              data: results,
              pagination: {
                total: totalCount,
                page: page,
                pageSize: pageSize,
                totalPages: Math.ceil(totalCount / pageSize),
              },
            }),
          ];
        case 4:
          error_1 = _a.sent();
          console.error('API Error:', error_1);
          return [
            2 /*return*/,
            res.status(500).json({
              message: 'Failed to fetch aircraft data',
              error:
                error_1 instanceof Error ? error_1.message : 'Unknown error',
            }),
          ];
        case 5:
          if (db) db.close();
          return [7 /*endfinally*/];
        case 6:
          return [2 /*return*/];
      }
    });
  });
}
exports['default'] = handler;
