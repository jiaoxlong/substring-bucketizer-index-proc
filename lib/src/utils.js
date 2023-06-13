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
exports.delay = exports.serialize_quads = exports.safeAppendFile = exports.getRelationQuads = exports.getMemberQuads = exports.ensure = exports.n3_escape = exports.addExtra = exports.addPrefix = exports.replPredicate = exports.SDSToTree = exports.addBucketBase = exports.createTreeRelation = exports.getValueByKeyForStringEnum = exports.treeNodeID = exports.treeCollectionID = exports.isTreeCollection = exports.createDir = exports.isValidURL = exports.sparql_query = exports.isSPARQLEndpoint = exports.sparql_ask_query = exports.exists = exports.writerToFile = exports.extract_resource_from_uri = exports.get_resource_index = exports.unescape = exports.n3Escape = exports.winEscape = exports.invalidWINSYM = exports.invalidWINRes = exports.isInvalidWINFN = exports.WIN_RESERVE_REGEX = exports.WIN_SYMBOL_REGEX = exports.WIN_REGEX = exports.remainingItemsQuads = exports.remainingItemsCountStream = exports.remainingItemsCountStore = void 0;
const n3 = __importStar(require("n3"));
const n3_1 = require("n3");
const types_1 = require("@treecg/types");
var namedNode = n3_1.DataFactory.namedNode;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const fp = __importStar(require("fs/promises"));
const query_sparql_1 = require("@comunica/query-sparql");
const tree_1 = require("./tree");
const path_1 = __importDefault(require("path"));
const types_2 = require("./types");
var literal = n3_1.DataFactory.literal;
var blankNode = n3_1.DataFactory.blankNode;
var quad = n3_1.DataFactory.quad;
const lockfile = require("proper-lockfile");
const bluebirdPromise = require("bluebird");
const fse = require("fs-extra");
/**
 * counts the number of remaining items adheres to a substring relation
 * @param store an N3.Store instance
 * @param relation a tree:Relation instance
 */
function remainingItemsCountStore(store, relation) {
    let count = 0;
    for (const sub_bucket of [...store.getObjects(relation, namedNode(types_1.SDS.relationBucket), null)]) {
        let count_extra = [...store.getSubjects(namedNode(types_1.SDS.bucket), sub_bucket, null)].length;
        count += count_extra;
        for (const sub_relation of [...store.getObjects(sub_bucket, namedNode(types_1.SDS.relation), null)]) {
            count += remainingItemsCountStore(store, sub_relation) || 0;
        }
    }
    return count;
}
exports.remainingItemsCountStore = remainingItemsCountStore;
function remainingItemsCountStream(bucket, counter, counter_index) {
    let count = 0;
    if (counter_index[bucket] === undefined) {
        return 0;
    }
    else {
        for (const rel in counter_index[bucket]) {
            count += counter[counter_index[bucket][rel]];
            count += remainingItemsCountStream(counter_index[bucket][rel], counter, counter_index);
        }
    }
    return count;
}
exports.remainingItemsCountStream = remainingItemsCountStream;
function remainingItemsQuads(bucket, counter, counter_index) {
    const quads = [];
    for (const rel in counter_index[bucket]) {
        quads.push(quad(blankNode(rel), types_1.TREE.terms.remainingItems, literal(remainingItemsCountStream(counter_index[bucket][rel], counter, counter_index))));
    }
    return quads;
}
exports.remainingItemsQuads = remainingItemsQuads;
//https://stackoverflow.com/questions/11100821/javascript-regex-for-validating-filenames
exports.WIN_REGEX = new RegExp('^(con|prn|aux|nul|com[0-9]|lpt[0-9])$|([<>:"\\/\\\\|?*])|(\\.|\\s)$/ig');
exports.WIN_SYMBOL_REGEX = new RegExp('([<>:"\/\\|?*])|(\.|\s)$/g');
exports.WIN_RESERVE_REGEX = new RegExp('^(con|prn|aux|nul|com[0-9]|lpt[0-9])$');
/**
 * validates a bucketbase if it contains any symbols or is named using a keyword reserved by Windows for naming files
 * @param bucket_base
 */
function isInvalidWINFN(bucket_base) {
    return !!(bucket_base.match(exports.WIN_REGEX));
}
exports.isInvalidWINFN = isInvalidWINFN;
/**
 * validates a bucketbase if it is named using a keyword reserved by Windows for naming files
 * @param bucket_base
 */
function invalidWINRes(bucket_base) {
    return !!(bucket_base.match(exports.WIN_RESERVE_REGEX));
}
exports.invalidWINRes = invalidWINRes;
/**
 * validates a bucketbase if it contains any symbols reserved by Windows for naming files
 * @param bucket_base
 */
function invalidWINSYM(bucket_base) {
    return !!(bucket_base.match(exports.WIN_SYMBOL_REGEX));
}
exports.invalidWINSYM = invalidWINSYM;
/**
 * escapes by replacing a symbol with its unicode character when illegal symbols were found,
 * or by adding a '%' to the end of a bucketbase string when the bucketbase is named with reserved WIN keywords.
 * In addition to reserved symbols or keywords, /[\x00-\x20<>\\"\{\}\|\^\`]/ also needs to be taken care of for n3.
 * In the case of ERA, a rare OP name contains "`".
 * Caution: it will only escape the first symbol matched against a regex.
 * @param bucket_base
 */
function winEscape(bucket_base) {
    if (invalidWINRes(bucket_base)) {
        return (bucket_base.concat('%'));
    }
    else {
        return bucket_base.replace(exports.WIN_SYMBOL_REGEX, encodeURIComponent);
    }
}
exports.winEscape = winEscape;
function n3Escape(str) {
    return str.replace("`", "'").replace('"', "'");
}
exports.n3Escape = n3Escape;
/**
 * unescape() is akin to the unescape() which is about to be deprecated.
 * @param escaped_bucket_base
 */
function unescape(escaped_bucket_base) {
    return decodeURIComponent(escaped_bucket_base);
}
exports.unescape = unescape;
/**
 * get first char index of a resource in a URI
 * @param s an URI instance
 * @returns resource substring index
 */
function get_resource_index(s) {
    if (s.includes('http')) {
        if (s.includes('#'))
            return s.lastIndexOf('#') + 1;
        else if (s.includes('/')) {
            if (s.endsWith('/')) {
                return s.slice(0, -1).lastIndexOf('/') + 1;
            }
            else {
                return s.lastIndexOf('/') + 1;
            }
        }
        else
            throw new Error(`Unexpected IRI: ${s}`);
    }
    else if (s.includes(':')) {
        return s.indexOf(':') + 1;
    }
    else
        return 0;
}
exports.get_resource_index = get_resource_index;
/**
 * extract resource name from a URI
 * @param s string
 * @returns resource name
 */
function extract_resource_from_uri(s) {
    const s_index = get_resource_index(s);
    if (s.includes('http'))
        return s.substring(s_index, s.length);
    else if (s.includes(':')) {
        return s.substring(s_index, s.length);
    }
    else
        return s;
}
exports.extract_resource_from_uri = extract_resource_from_uri;
function writerToFile(content, location) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fp.writeFile(location, content);
        }
        catch (err) {
            console.log(err);
        }
    });
}
exports.writerToFile = writerToFile;
function exists(path_ins) {
    try {
        return fs.statSync(path_ins).isFile();
    }
    catch (error) {
        return false;
    }
}
exports.exists = exists;
exports.sparql_ask_query = `ASK {?s ?p ?o}`;
function isSPARQLEndpoint(sparql_endpoint, sparql_query) {
    return __awaiter(this, void 0, void 0, function* () {
        const queryEngine = new query_sparql_1.QueryEngine();
        return yield queryEngine.queryBoolean(sparql_query, { sources: [sparql_endpoint] });
    });
}
exports.isSPARQLEndpoint = isSPARQLEndpoint;
function sparql_query(sparql_endpoint, sparql_query) {
    return __awaiter(this, void 0, void 0, function* () {
        const queryEngine = new query_sparql_1.QueryEngine();
        return yield queryEngine.queryQuads(sparql_query, { sources: [sparql_endpoint] });
    });
}
exports.sparql_query = sparql_query;
function isValidURL(s) {
    //https://www.freecodecamp.org/news/check-if-a-javascript-string-is-a-url/
    const urlPattern = new RegExp('^(https?:\\/\\/)?' + // validate protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // validate domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // validate OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // validate port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // validate query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // validate fragment locator
    return !!urlPattern.test(s);
}
exports.isValidURL = isValidURL;
function createDir(dir_name) {
    if (!fs.existsSync(path_1.default.resolve(dir_name)))
        fs.mkdirSync(path_1.default.resolve(dir_name), { recursive: true });
    return path.resolve(dir_name);
}
exports.createDir = createDir;
function isTreeCollection(quadString) {
    return (quadString.match(tree_collection_regex) === null) ? false : true;
}
exports.isTreeCollection = isTreeCollection;
function treeCollectionID(quadString) {
    return tree_collection_regex.exec(quadString)[1];
}
exports.treeCollectionID = treeCollectionID;
function treeNodeID(quadString) {
    //console.log(quadString)
    return tree_node_regex.exec(quadString)[1];
}
exports.treeNodeID = treeNodeID;
const tree_collection_regex = new RegExp("(.+)\\s{1,4}a\\s{1,4}(?:tree:|.+\\#)Collection");
const tree_node_regex = new RegExp("(.+)\\s{1,4}rdf:type");
function getValueByKeyForStringEnum(obj, value) {
    var _a;
    return (_a = Object.entries(obj).find(([key, val]) => key === value)) === null || _a === void 0 ? void 0 : _a[1];
}
exports.getValueByKeyForStringEnum = getValueByKeyForStringEnum;
function createTreeRelation(relation, config, store) {
    const prop_path = (typeof config.propertyPath === 'string') ?
        config.propertyPath : config.propertyPath[0];
    const test = [...store.getQuads(null, types_1.SDS.terms.relation, null, null)];
    //console.log(test)
    const rel_bucket = [...store.getObjects(relation, types_1.SDS.terms.relationBucket, null)];
    //console.log(rel_bucket)
    if (rel_bucket.length !== 1) {
        console.log("ERROR: each relation instance should have one relation bucket!", relation, rel_bucket);
    }
    const rel_bucket_value = [...store.getObjects(relation, types_1.SDS.terms.relationValue, null)];
    return new tree_1.TreeRelation(relation, getValueByKeyForStringEnum(types_2.RelationType, config.relationType), addBucketBase(config, namedNode(n3Escape(rel_bucket[0].value))), rel_bucket_value.map(v => literal(n3Escape(v.value))), namedNode(prop_path));
}
exports.createTreeRelation = createTreeRelation;
function addBucketBase(config, nn) {
    return namedNode(config.bucketizerOptions.bucketBase + nn.value);
}
exports.addBucketBase = addBucketBase;
//  [SDS.Relation]: Tree.Relation
//  [SDS.Bucket]: TREE.Node
exports.SDSToTree = {
    [types_1.SDS.relation]: types_1.TREE.relation,
    [types_1.SDS.relationBucket]: types_1.TREE.node,
    [types_1.SDS.relationPath]: types_1.TREE.path,
    [types_1.SDS.relationValue]: types_1.TREE.value,
    [types_1.SDS.relationType]: types_1.RDF.type,
};
function replPredicate(q, mapping) {
    return q.predicate.value in mapping ? quad(q.subject, namedNode(mapping[q.predicate.value]), q.object) : q;
}
exports.replPredicate = replPredicate;
//subject
// appear only on root bucket
const subj_conditions = [types_1.SDS.terms.custom("isRoot").value, types_1.TREE.terms.relation.value];
//object
// sds:Relation sds:relationBucket ?sds:Bucket .
// sds:Recode sds:bucket ?sds:Bucket .
const obj_conditions = [types_1.TREE.terms.node.value, types_1.SDS.terms.bucket.value];
function addPrefix(config, q) {
    if (subj_conditions.includes(q.predicate.value)) {
        return quad(addBucketBase(config, q.subject), q.predicate, q.object);
    }
    else if (obj_conditions.includes(q.predicate.value)) {
        return quad(q.subject, q.predicate, addBucketBase(config, q.object));
    }
    else
        return q;
}
exports.addPrefix = addPrefix;
function addExtra(config, q) {
    let store = new n3.Store();
    let quads = [];
    if (subj_conditions.includes(q.predicate.value))
        quads.push(quad(q.subject, types_1.RDF.terms.type, types_1.TREE.terms.Node));
    if (obj_conditions.includes(q.predicate.value))
        quads.push(quad(q.object, types_1.RDF.terms.type, types_1.TREE.terms.Node));
    if (q.predicate.equals(types_1.TREE.terms.relation))
        if (typeof config.propertyPath === 'string')
            quads.push(quad(q.object, types_1.TREE.terms.path, namedNode(config.propertyPath)));
        else if (config.propertyPath instanceof Array)
            for (const prop_path of config.propertyPath) {
                quads.push(quad(q.object, types_1.TREE.terms.path, namedNode(prop_path)));
            }
    return [...new Set(quads)];
}
exports.addExtra = addExtra;
function n3_escape(q) {
    /** Quad[] may be populated with n3.Quad or other Quad inherited from rdfjs.Quad
     *  Thus, it is safe to set the condition to check if Term.termType === 'x' instead of using instanceof
     *
     *  Explanation:
     *
     *  The first one's structure is
     *  Quad {
     *     id: '',
     *     _subject: BlankNode { id: '_:b27501_n3-13749' },
     *     _predicate: NamedNode { id: 'https://w3id.org/sds#stream' },
     *     _object: NamedNode { id: 'https://w3id.org/sds#Stream' },
     *     _graph: DefaultGraph { id: '' }
     *   }
     *   Whereas the latter one's structure is
     *    Quad {
     *     termType: 'Quad',
     *     value: '',
     *     subject: BlankNode { termType: 'BlankNode', value: 'df_67_15097' },
     *     predicate: NamedNode {
     *       termType: 'NamedNode',
     *       value: 'https://w3id.org/sds#relationBucket'
     *     },
     *     object: NamedNode { termType: 'NamedNode', value: 'l`' },
     *     graph: DefaultGraph { termType: 'DefaultGraph', value: '' }
     *   }
     *
     */
    if (q !== undefined) {
        if (q.subject.termType === 'NamedNode') {
            if (q.object.termType === 'Literal') {
                return quad(namedNode(n3Escape(q.subject.value)), q.predicate, literal(n3Escape(q.object.value)));
            }
            else if (q.object.termType === 'NamedNode') {
                return quad(namedNode(n3Escape(q.subject.value)), q.predicate, namedNode(n3Escape(q.object.value)));
            }
            else if (q.object.termType === 'BlankNode') {
                return quad(namedNode(n3Escape(q.subject.value)), q.predicate, q.object);
            }
            else {
                return q;
            }
        }
        else if (q.subject.termType === 'BlankNode') {
            if (q.object.termType === 'Literal') {
                return quad(q.subject, q.predicate, literal(n3Escape(q.object.value)));
            }
            else if (q.object.termType === 'NamedNode') {
                return quad(q.subject, q.predicate, namedNode(n3Escape(q.object.value)));
            }
            else {
                return q;
            }
        }
        else {
            return q;
        }
    }
    else {
        throw new Error("Undefined Quad!");
    }
}
exports.n3_escape = n3_escape;
function ensure(argument, message = 'saftgaurd type') {
    if (argument === undefined || argument === null) {
        throw new TypeError(message);
    }
    return argument;
}
exports.ensure = ensure;
function getMemberIDs(config, quads) {
    /** Note that array map() also brings the prior filter condition(s) to the return value*/
    if (typeof config.propertyPath === 'string') {
        return quads.filter(ids => ids.predicate.equals(namedNode(config.propertyPath))).map(ids => ids.subject.value);
    }
    else {
        return [...new Set(quads.filter(ids => config.propertyPath.includes(ids.predicate.value))
                .map(ids => ids.subject.value))];
    }
}
function getMemberQuads(config, quads) {
    const member_ids = getMemberIDs(config, quads);
    return quads.filter(q => member_ids.includes(q.subject.value));
    //return quads.filter(q => member_ids.some(x => x.equals(q)))
}
exports.getMemberQuads = getMemberQuads;
function getRelationBNs(config, quads) {
    return [...new Set(quads.filter(q => q.predicate.equals(types_1.TREE.terms.relation)).map(q => q.object))];
}
function getNodeRelQuad(config, quads) {
    return quads.filter(q => q.predicate.equals(types_1.TREE.terms.relation));
}
function getRelationNode(config, quads, rel_bn) {
    return quads.filter(q => q.subject.equals(rel_bn) && q.predicate.equals(types_1.TREE.terms.node))
        .map(q => q.object.value)[0];
}
function getRelationQuads(config, parent_bucket, quads, bucket, counter_index) {
    const parent_buckets = [...new Set(quads.filter(q => q.predicate.equals(types_1.TREE.terms.relation)).map(q => q.subject.value))];
    if (parent_buckets.length !== 0) {
        // add relation quads
        const rel_blank_nodes = getRelationBNs(config, quads);
        for (const rel of rel_blank_nodes) {
            /** update counter_index
             *  counter_index: {bucket:{relation:sub-bucket}}
             */
            const tree_node = getRelationNode(config, quads, rel);
            if (parent_bucket in counter_index) {
                if (counter_index[parent_bucket][rel.value] === undefined) {
                    counter_index[parent_bucket][rel.value] = tree_node;
                }
            }
            else {
                let sub_dic = {};
                sub_dic[rel.value] = bucket;
                counter_index[parent_bucket] = sub_dic;
            }
        }
    }
    const rel_bns = [...new Set(getRelationBNs(config, quads))];
    // tree:Relation rdf:type tree:SubstringRelation;
    //  tree:node tree:Node;
    //  tree:path <IRI>;
    //  tree:value xsd:string;
    // tree:Node tree:relation tree:Relation.
    const node_rel_quad = getNodeRelQuad(config, quads);
    const rel_quads = quads.filter(q => rel_bns.some(x => x.equals(q.subject)));
    return [...new Set([...rel_quads, ...node_rel_quad])];
}
exports.getRelationQuads = getRelationQuads;
function safeAppendFile(out, quadString) {
    const retryOptions = {
        retries: {
            retries: 5,
            factor: 3,
            minTimeout: 1 * 1000,
            maxTimeout: 60 * 1000,
            randomize: true,
        }
    };
    let cleanup;
    bluebirdPromise.try(() => {
        return fse.ensureFile(out); // fs-extra creates file if needed
    }).then(() => {
        return lockfile.lock(out, retryOptions);
    }).then((release) => {
        cleanup = release;
        let stream = fs.createWriteStream(out, { flags: 'a' });
        stream.write(quadString);
        stream.end();
        return new Promise(function (resolve, reject) {
            stream.on('finish', () => resolve());
            stream.on('error', (err) => reject(err));
        });
    }).then(() => {
        console.log('Finished!');
    }).catch((err) => {
        console.error(err);
    }).finally(() => {
        cleanup && cleanup();
    });
}
exports.safeAppendFile = safeAppendFile;
function serialize_quads(quads) {
    return new n3.Writer().quadsToString(quads);
}
exports.serialize_quads = serialize_quads;
/**
 * delay() introduce a promise-based delay
 * @param ms millisecond
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.delay = delay;
