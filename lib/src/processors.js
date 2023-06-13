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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingest = exports.sds_to_tree = exports.querySparql = void 0;
const query_sparql_1 = require("@comunica/query-sparql");
const parseConfig_1 = require("./parseConfig");
const n3 = __importStar(require("n3"));
const types_1 = require("@treecg/types");
const n3_1 = require("n3");
var namedNode = n3_1.DataFactory.namedNode;
const tree_1 = require("./tree");
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
const fs = __importStar(require("fs/promises"));
const queryEngine = new query_sparql_1.QueryEngine();
/**
 * The query_sparql processor fetches query result from a SPRAQL endpoint
 * @param configPath PATH to a config file. For example, ./config.json
 * @param writer a stream writer instance
 */
function querySparql(configPath, writer) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = (0, parseConfig_1.getConfig)(configPath);
        yield config.setup();
        doQuery(config, writer);
    });
}
exports.querySparql = querySparql;
function doQuery(config, writer) {
    return __awaiter(this, void 0, void 0, function* () {
        yield new Promise(res => setTimeout(res, 3000));
        const quadStream = yield queryEngine.queryQuads(config.sparqlQuery, { sources: [config.sparqlEndpoint] });
        const quads = yield quadStream.toArray();
        yield writer.push((0, utils_1.serialize_quads)(quads.map(q => q)));
        yield quadStream.close();
        yield writer.end().then(() => { console.log('querySparql: writer stream is closed'); });
    });
}
/**
 * The sds_to_tree processor transforms SDS bucktized data, streamed from a prior bucketization process into TREE data
 * @param configPath PATH to a config file. For example, ./config.json
 * @param reader Readable stream
 * @param meta_reader Readable stream
 * @param treeMemberOutputStream Writeable stream
 */
function sds_to_tree(configPath, reader, meta_reader, treeMemberOutputStream) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = (0, parseConfig_1.getConfig)(configPath);
        // reader.on('end',()=>{
        //     treeMemberOutputStream.disconnect()
        // })
        const treeify = (quads) => __awaiter(this, void 0, void 0, function* () {
            /** escape n3js issued symbols /[\x00-\x20<>\\"\{\}\|\^\`]/ */
            let t = (0, utils_1.ensure)(quads.map(q => (0, utils_1.n3_escape)(q)));
            /** convert vocabulary */
            t = (0, utils_1.ensure)(t.map(q => (0, utils_1.replPredicate)(q, utils_1.SDSToTree)));
            /** add bucketBase and add extra type quads */
            t = t.map(q => (0, utils_1.addPrefix)(config, q));
            /** add extra quads */
            // <node> rdf:type tree:Node.
            let tree_quads = t;
            for (const q of t) {
                tree_quads = [...tree_quads, ...(0, utils_1.addExtra)(config, q)];
            }
            yield treeMemberOutputStream.push((0, utils_1.serialize_quads)(tree_quads));
        });
        reader.data(treeify);
        reader.on('end', () => {
            console.log("sds_to_tree: data is closed");
            treeMemberOutputStream.end();
        });
    });
}
exports.sds_to_tree = sds_to_tree;
/**+
 * The ingest processor materialize quads of TREE to files
 * @param configPath PATH to a config file. For example, ./config.json
 * @param treeMemberInputStream readable stream
 */
function ingest(configPath, treeMemberInputStream) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = (0, parseConfig_1.getConfig)(configPath);
        const out_dir = (0, utils_1.createDir)(path_1.default.resolve('out'));
        let counter = {};
        let counter_index = {};
        const tree_collection = new tree_1.TreeCollection(namedNode(config.namespaceIRI), configPath, new n3.Store());
        const tree_collection_out = path_1.default.join(out_dir, 'tree_collection.ttl');
        /** write tree collection meta quads */
        if (!(0, utils_1.exists)(tree_collection_out)) {
            yield fs.appendFile(tree_collection_out, new n3.Writer().quadsToString(tree_collection.serialize_metadata()));
        }
        treeMemberInputStream.on('data', (quadString) => __awaiter(this, void 0, void 0, function* () {
            const quads = [...new Set(new n3.Parser().parse(quadString))];
            /** member node(s)
             * each chunk of quads is expected to have at least one treeNode
             */
            const buckets = [...new Set(quads.filter(q => q.predicate.equals(types_1.SDS.terms.bucket)).map(q => q.object))];
            /** member quads */
            const member_quads = (0, utils_1.getMemberQuads)(config, quads);
            /** write member quads */
            for (const b of buckets) {
                const out = path_1.default.join(out_dir, (0, utils_1.winEscape)((0, utils_1.extract_resource_from_uri)(b.value)) + '.ttl');
                yield fs.appendFile(out, new n3.Writer().quadsToString(member_quads));
                /** update counter */
                if (b.value in counter) {
                    counter[b.value] += 1;
                }
                else {
                    counter[b.value] = 1;
                }
                /** relation quads */
                const parent_buckets = [...new Set(quads.filter(q => q.predicate.equals(types_1.TREE.terms.relation)).map(q => q.subject.value))];
                if (parent_buckets.length !== 0) {
                    // only one parent bucket is expected; update counter_index
                    const parent_bucket = parent_buckets[0];
                    const rel_quads = (0, utils_1.getRelationQuads)(config, parent_bucket, quads, b.value, counter_index);
                    const rel_out = path_1.default.join(out_dir, (0, utils_1.winEscape)((0, utils_1.extract_resource_from_uri)(parent_bucket)) + '.ttl');
                    if ((0, utils_1.exists)(rel_out)) {
                        yield fs.appendFile(rel_out, new n3.Writer().quadsToString(rel_quads));
                    }
                    else {
                        yield fs.appendFile(rel_out, new n3.Writer().quadsToString(rel_quads));
                    }
                    /** write relation quads to tree collection */
                    yield fs.appendFile(tree_collection_out, new n3.Writer().quadsToString(rel_quads));
                }
            }
        }));
        treeMemberInputStream.on('end', () => __awaiter(this, void 0, void 0, function* () {
            for (const b in counter) {
                /** write remainingItems quads */
                const path = path_1.default.join(out_dir, (0, utils_1.winEscape)((0, utils_1.extract_resource_from_uri)(b)) + '.ttl');
                yield fs.appendFile(path, new n3.Writer().quadsToString((0, utils_1.remainingItemsQuads)(b, counter, counter_index)));
            }
            console.log('ingest: successfully wrote files.');
        }));
    });
}
exports.ingest = ingest;
