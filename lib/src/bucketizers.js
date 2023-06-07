"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.doTheBucketization = void 0;
const bucketizers_1 = require("@treecg/bucketizers");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const n3_1 = require("n3");
const N3 = __importStar(require("n3"));
const core_1 = require("./core");
const types_1 = require("@treecg/types");
const { namedNode, quad } = n3_1.DataFactory;
function readState(path) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const str = yield (0, promises_1.readFile)(path, { "encoding": "utf-8" });
            return JSON.parse(str);
        }
        catch (e) {
            return;
        }
    });
}
function writeState(path, content) {
    return __awaiter(this, void 0, void 0, function* () {
        if (path) {
            const str = JSON.stringify(content);
            (0, fs_1.writeFileSync)(path, str, { encoding: "utf-8" });
        }
    });
}
function addProcess(id, store, strategyId, bucketizeConfig) {
    const newId = store.createBlankNode();
    const time = new Date().getTime();
    store.addQuad(newId, types_1.RDF.terms.type, types_1.PPLAN.terms.Activity);
    store.addQuad(newId, types_1.RDF.terms.type, types_1.LDES.terms.Bucketization);
    store.addQuads(bucketizeConfig);
    store.addQuad(newId, types_1.PROV.terms.startedAtTime, (0, core_1.literal)(time));
    store.addQuad(newId, types_1.PROV.terms.used, strategyId);
    if (id)
        store.addQuad(newId, types_1.PROV.terms.used, id);
    return newId;
}
function parseQuads(quads) {
    //console.log("Parsing quads!");
    const parser = new N3.Parser();
    return parser.parse(quads);
}
function doTheBucketization(dataReader, metadataReader, dataWriter, metadataWriter, location, savePath, sourceStream, resultingStream) {
    return __awaiter(this, void 0, void 0, function* () {
        dataReader.on("end", () => dataWriter.disconnect());
        metadataReader.on("end", () => metadataWriter.disconnect());
        const sr = { metadata: metadataReader, data: dataReader };
        const sw = { metadata: metadataWriter, data: dataWriter };
        const content = yield (0, promises_1.readFile)(location, { encoding: "utf-8" });
        const quads = new n3_1.Parser().parse(content);
        const quadMemberId = quads.find(quad => quad.predicate.equals(types_1.RDF.terms.type) && quad.object.equals(types_1.LDES.terms.BucketizeStrategy)).subject;
        //console.log("Do bucketization", quadMemberId);
        const f = (0, core_1.transformMetadata)(namedNode(resultingStream), sourceStream ? namedNode(sourceStream) : undefined, "sds:Member", (x, y) => addProcess(x, y, quadMemberId, quads));
        sr.metadata.data(quads => sw.metadata.push(f(parseQuads(quads))));
        if (sr.metadata.lastElement) {
            sw.metadata.push(f(parseQuads(sr.metadata.lastElement)));
        }
        sr.metadata.on('end', () => {
            sw.metadata.disconnect();
        });
        const state = yield readState(savePath);
        const bucketizer = bucketizers_1.FACTORY.buildLD(quads, quadMemberId, state);
        if (state)
            bucketizer.importState(state);
        // Cleanup(async () => {
        //     const state = bucketizer.exportState()
        //     await writeState(savePath, state);
        // })
        sr.data.data((data) => __awaiter(this, void 0, void 0, function* () {
            const t = new n3_1.Parser().parse(data);
            //console.log("Bucketizing member")
            if (!t.length)
                return;
            const members = [...new Set(t.filter(q => q.predicate.equals(types_1.SDS.terms.custom("payload"))).map(q => q.object))];
            if (members.length > 1) {
                //console.error("Detected more members ids than expected");
            }
            if (members.length === 0)
                return;
            const sub = members[0].value;
            const extras = bucketizer.bucketize(t, sub);
            const recordId = extras.find(q => q.predicate.equals(types_1.SDS.terms.payload)).subject;
            const extraStr = new N3.Writer().quadsToString(extras);
            //console.log("Extras \n", extraStr);
            t.push(...extras);
            t.push(quad(recordId, types_1.SDS.terms.stream, namedNode(resultingStream)));
            t.push(quad(recordId, types_1.RDF.terms.type, types_1.SDS.terms.Member));
            //console.log("Pushing thing bucketized!")
            yield sw.data.push(t);
        }));
        sr.data.on('end', () => {
            sw.data.disconnect();
        });
    });
}
exports.doTheBucketization = doTheBucketization;
