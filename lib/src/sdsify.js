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
exports.sdsify = void 0;
const types_1 = require("@treecg/types");
const core_1 = require("./core");
const n3_1 = require("n3");
class Tracker {
    constructor(max) {
        this.at = 0;
        this.logged = 0;
        this.max = max;
    }
    inc() {
        this.at += 1;
        let at = Math.round(this.at * 100 / this.max);
        if (at > this.logged) {
            console.log(at, "%");
            this.logged = at;
        }
    }
}
function maybe_parse(data) {
    if (typeof data === 'string' || data instanceof String) {
        const parse = new n3_1.Parser();
        return parse.parse(data);
    }
    else {
        return data;
    }
}
function extractMember(store, subject) {
    const subGraph = [];
    // Extract forward relations recursively
    // TODO: deal with backwards relations
    // TODO: deal with cycles
    for (const quad of store.getQuads(subject, null, null, null)) {
        if (quad.object.termType === "NamedNode") {
            subGraph.push(...extractMember(store, quad.object.id));
        }
        subGraph.push(quad);
    }
    return subGraph;
}
function sdsify(input, output, stream, type) {
    return __awaiter(this, void 0, void 0, function* () {
        const streamNode = (0, core_1.namedNode)(stream);
        input.data((input) => __awaiter(this, void 0, void 0, function* () {
            const quads = maybe_parse(input);
            console.log("sdsify: Got input", quads.length, "quads");
            const members = {};
            if (type) {
                // Group quads based on given member type
                const store = new n3_1.Store(quads);
                for (const quad of store.getQuads(null, types_1.RDF.terms.type, type, null)) {
                    members[quad.subject.value] = extractMember(store, quad.subject.value);
                }
            }
            else {
                // Group quads based on Subject IRI
                for (let quad of quads) {
                    if (!members[quad.subject.value]) {
                        members[quad.subject.value] = [];
                    }
                    members[quad.subject.value].push(quad);
                }
            }
            let membersCount = 0;
            let first = true;
            for (let key of Object.keys(members)) {
                const quads = members[key];
                if (first) {
                    first = false;
                    console.log("predicates", quads.map(q => q.predicate.value));
                }
                const blank = (0, core_1.blankNode)();
                quads.push(n3_1.DataFactory.quad(blank, types_1.SDS.terms.payload, (0, core_1.namedNode)(key)), n3_1.DataFactory.quad(blank, types_1.SDS.terms.stream, streamNode));
                const str = new n3_1.Writer().quadsToString(quads);
                yield output.push(str);
                membersCount += 1;
            }
            console.log("sdsify: pushed ", membersCount, "members");
        }));
        input
            .on("end", () => __awaiter(this, void 0, void 0, function* () {
            console.log("All sdsify input have been read.");
            yield input.disconnect();
        }));
        yield output.disconnect();
    });
}
exports.sdsify = sdsify;
