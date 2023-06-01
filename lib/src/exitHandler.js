"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cleanup = void 0;
function noOp() { }
;
function Cleanup(callback) {
    // attach user callback to the process event emitter
    // if no callback, it will still exit gracefully on Ctrl-C
    callback = callback || noOp;
    // do app specific cleaning before exiting
    process.on('exit', callback);
    const fn = function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield callback();
            process.exit(2);
        });
    };
    // catch ctrl+c event and exit normally
    process.on('SIGINT', fn);
    // process.on("SIGKILL", fn)
    // process.on("SIGSTOP", fn)
    process.on("SIGQUIT", fn);
    // process.on("SIG", fn)
    //catch uncaught exceptions, trace, then exit normally
    process.on('uncaughtException', function (e) {
        return __awaiter(this, void 0, void 0, function* () {
            yield callback();
            process.exit(99);
        });
    });
}
exports.Cleanup = Cleanup;
;
