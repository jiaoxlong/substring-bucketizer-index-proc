import * as n3 from "n3"
import {BlankNode, DataFactory, Literal, Quad, NamedNode} from "n3";

import { RDF, SDS, TREE} from '@treecg/types';
import namedNode = DataFactory.namedNode;

import * as path from "path";
import * as fs from 'fs';
import * as fp from 'fs/promises'
import {QueryEngine} from "@comunica/query-sparql";
import {TreeRelation} from "./tree";
import PATH from "path";
import {Config, getConfig} from "./parseConfig";
import {RelationType} from "./types";
import literal = DataFactory.literal;
import blankNode = DataFactory.blankNode;
import quad = DataFactory.quad;


const lockfile = require("proper-lockfile");
const bluebirdPromise = require("bluebird");
const fse= require("fs-extra");

/**
 * counts the number of remaining items adheres to a substring relation
 * @param store an N3.Store instance
 * @param relation a tree:Relation instance
 */

export function remainingItemsCount(store:n3.Store, relation:BlankNode|NamedNode):number|undefined{
    let count = 0
    for (const sub_bucket of [...store.getObjects(relation, namedNode(SDS.relationBucket), null)]){
        let count_extra = [...store.getSubjects(namedNode(SDS.bucket), sub_bucket, null)].length
        count += count_extra;
        for (const sub_relation of [...store.getObjects(sub_bucket, namedNode(SDS.relation), null)]) {
            count += remainingItemsCount(store,<BlankNode|NamedNode>sub_relation) || 0
        }
    }
    return count
}

//https://stackoverflow.com/questions/11100821/javascript-regex-for-validating-filenames
export const WIN_REGEX= new RegExp('^(con|prn|aux|nul|com[0-9]|lpt[0-9])$|([<>:"\\/\\\\|?*])|(\\.|\\s)$/ig')
export const WIN_SYMBOL_REGEX = new RegExp('([<>:"\/\\|?*])|(\.|\s)$/g')
export const WIN_RESERVE_REGEX = new RegExp('^(con|prn|aux|nul|com[0-9]|lpt[0-9])$')

/**
 * validates a bucketbase if it contains any symbols or is named using a keyword reserved by Windows for naming files
 * @param bucket_base
 */
export function isInvalidWINFN(bucket_base: string):boolean{
    return !!(bucket_base.match(WIN_REGEX))
}

/**
 * validates a bucketbase if it is named using a keyword reserved by Windows for naming files
 * @param bucket_base
 */
export function invalidWINRes(bucket_base:string):boolean{
    return !!(bucket_base.match(WIN_RESERVE_REGEX))
}

/**
 * validates a bucketbase if it contains any symbols reserved by Windows for naming files
 * @param bucket_base
 */
export function invalidWINSYM(bucket_base:string):boolean{
    return !!(bucket_base.match(WIN_SYMBOL_REGEX))
}

/**
 * escapes by replacing a symbol with its unicode character when illegal symbols were found,
 * or by adding a '%' to the end of a bucketbase string when the bucketbase is named with reserved WIN keywords.
 * In addition to reserved symbols or keywords, /[\x00-\x20<>\\"\{\}\|\^\`]/ also needs to be taken care of for n3.
 * In the case of ERA, a rare OP name contains "`".
 * Caution: it will only escape the first symbol matched against a regex.
 * @param bucket_base
 */
export function winEscape(bucket_base:string):string{
    if (invalidWINRes(bucket_base)){
        return (bucket_base.concat('%'))
    }

    else{
        return bucket_base.replace(WIN_SYMBOL_REGEX, encodeURIComponent)
    }
}

export function n3Escape(str:string):string{
    return str.replace("`", "'").replace('"',"'" )
}

/**
 * unescape() is akin to the unescape() which is about to be deprecated.
 * @param escaped_bucket_base
 */

export function unescape(escaped_bucket_base:string):string{
    return decodeURIComponent(escaped_bucket_base)
}

/**
 * get first char index of a resource in a URI
 * @param s an URI instance
 * @returns resource substring index
 */
export function get_resource_index(s:string){
    if (s.includes('http')) {
        if (s.includes('#'))
            return s.lastIndexOf('#')+1
        else if (s.includes('/')){
            if (s.endsWith('/')){
                return s.slice(0, -1).lastIndexOf('/')+1

            }
            else{
                return s.lastIndexOf('/')+1;
            }
        }
        else
            throw new Error(`Unexpected IRI: ${s}`)
    }
    else if (s.includes(':')) {
        return s.indexOf(':')+1;
    }
    else
        return 0;
}

/**
 * extract resource name from a URI
 * @param s string
 * @returns resource name
 */
export function extract_resource_from_uri(s:string){
    const s_index = get_resource_index(s)
    if (s.includes('http'))
        return s.substring(s_index, s.length)
    else if (s.includes(':')){
        return s.substring(s_index, s.length)
    }
    else
        return s
}

export async function writerToFile(content: any, location: string) {
    try {
        await fp.writeFile(location, content)
    } catch (err) {
        console.log(err)
    }
}

export function exists(path_ins:string) {
    try {
        return fs.statSync(path_ins).isFile()
    }
    catch(error) {
        return false
    }
}


export const sparql_ask_query = `ASK {?s ?p ?o}`
export async function isSPARQLEndpoint (sparql_endpoint:string, sparql_query:string){
    const queryEngine = new QueryEngine();
    return await queryEngine.queryBoolean(sparql_query,
        {sources:[sparql_endpoint]})
}
export async function sparql_query(sparql_endpoint:string, sparql_query:string){
    const queryEngine = new QueryEngine();
    return await queryEngine.queryQuads(sparql_query,
        {sources:[sparql_endpoint]})
}

export function isValidURL(s:string) {
    //https://www.freecodecamp.org/news/check-if-a-javascript-string-is-a-url/
    const urlPattern = new RegExp('^(https?:\\/\\/)?' + // validate protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // validate domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // validate OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // validate port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // validate query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // validate fragment locator
    return !!urlPattern.test(s)
}

export function createDir(dir_name:string):string{
    if(!fs.existsSync(PATH.resolve(dir_name)))
        fs.mkdirSync(PATH.resolve(dir_name), {recursive: true})
    return path.resolve(dir_name)
}

export function isTreeCollection(quadString: string):boolean{
    return (quadString.match(tree_collection_regex) ===null) ? false : true
}

export function treeCollectionID(quadString:string):string{
    return tree_collection_regex.exec(quadString)![1]
}

export function treeNodeID(quadString:string):string{
    //console.log(quadString)
    return tree_node_regex.exec(quadString)![1]
}

const tree_collection_regex = new RegExp("(.+)\\s{1,4}a\\s{1,4}(?:tree:|.+\\#)Collection")
const tree_node_regex = new RegExp("(.+)\\s{1,4}rdf:type")



export function getValueByKeyForStringEnum(obj:Object, value: string) {
    return Object.entries(obj).find(([key, val]) => key === value)?.[1];
}

export function createTreeRelation(relation:NamedNode|BlankNode, config:Config,store:n3.Store ){
    const prop_path = (typeof config.propertyPath === 'string') ?
        config.propertyPath : config.propertyPath[0]
    const test = [...store.getQuads(null, SDS.terms.relation, null,null)]
    //console.log(test)
    const rel_bucket = [...store.getObjects(relation, SDS.terms.relationBucket, null)]
    //console.log(rel_bucket)
    if (rel_bucket.length !==1){
        console.log("ERROR: each relation instance should have one relation bucket!", relation, rel_bucket)
    }
    const rel_bucket_value = [...store.getObjects(relation, SDS.terms.relationValue, null)]
    return new TreeRelation(<NamedNode|BlankNode>relation,
            getValueByKeyForStringEnum(RelationType, config.relationType),
            addBucketBase(config,namedNode(n3Escape(rel_bucket[0].value))),
            <Literal[]>rel_bucket_value.map(v=>literal(n3Escape(v.value))),
            namedNode(prop_path)
    )
}
export function addBucketBase(config:Config, nn:NamedNode|Literal){
    return namedNode(config.bucketizerOptions.bucketBase + nn.value)
}

//  [SDS.Relation]: Tree.Relation
//  [SDS.Bucket]: TREE.Node
export const SDSToTree:{[key:string]:string} = {
    [SDS.relation]: TREE.relation,
    [SDS.relationBucket]: TREE.node,
    [SDS.relationPath]: TREE.path,
    [SDS.relationValue]: TREE.value,
    [SDS.relationType]: RDF.type,
}

export function replPredicate(q: Quad, mapping:{[key:string]:string}){
    return q.predicate.value in mapping ? quad(q.subject, namedNode(mapping[q.predicate.value]), q.object) : q
}

//subject
// appear only on root bucket
const subj_conditions = [SDS.terms.custom("isRoot").value, TREE.terms.relation.value]

//object
// sds:Relation sds:relationBucket ?sds:Bucket .
// sds:Recode sds:bucket ?sds:Bucket .
const obj_conditions = [TREE.terms.node.value, SDS.terms.bucket.value]



export function addPrefix(config:Config, q:Quad){
    if (subj_conditions.includes(q.predicate.value)){
        return quad(addBucketBase(config, <NamedNode>q.subject), q.predicate, q.object)
    }
    else if (obj_conditions.includes(q.predicate.value)){
        return quad(q.subject, q.predicate, addBucketBase(config, <NamedNode>q.object))
    }
    else
        return q
}

export function addExtra(config:Config, q:Quad):Quad[]{
    let store = new n3.Store()
    let quads:Quad[] = []
    if (subj_conditions.includes(q.predicate.value))
        quads.push(quad(q.subject, RDF.terms.type, TREE.terms.Node))
    if (obj_conditions.includes(q.predicate.value))
        quads.push(quad(<NamedNode>q.object, RDF.terms.type, TREE.terms.Node))

    if(q.predicate.equals(TREE.terms.relation))
        if (typeof config.propertyPath === 'string')
            quads.push(quad(<BlankNode>q.object, TREE.terms.path, namedNode(config.propertyPath)))
        else if (config.propertyPath instanceof Array)
            for (const prop_path of config.propertyPath) {
                quads.push(quad(<BlankNode>q.object, TREE.terms.path, namedNode(prop_path)))
        }
    return [...new Set(quads)]
}


export function n3_escape(q:Quad|undefined){
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
                return quad(namedNode(n3Escape(q.subject.value)), q.predicate, literal(n3Escape(q.object.value)))
            }
            else if (q.object.termType === 'NamedNode') {
                return quad(namedNode(n3Escape(q.subject.value)), q.predicate, namedNode(n3Escape(q.object.value)))
            }
            else if (q.object.termType === 'BlankNode') {
                return quad(namedNode(n3Escape(q.subject.value)), q.predicate, q.object)
            }
            else{
                return q
            }
        }

        else if (q.subject.termType === 'BlankNode') {
            if (q.object.termType === 'Literal') {
                return quad(q.subject, q.predicate, literal(n3Escape(q.object.value)))
            }
            else if (q.object.termType === 'NamedNode') {
                return quad(q.subject, q.predicate, namedNode(n3Escape(q.object.value)))
            }
            else {
                return q
            }
        }
        else {
            return q
        }
    }
    else{
        throw new Error("Undefined Quad!")
    }
}

export function ensure<T>(argument: T | undefined | null, message:string='saftgaurd type'){
    if (argument === undefined || argument === null){
        throw new TypeError(message)
    }
    return argument
}

function getMemberIDs(config:Config, quads:Quad[]):string[]{
    /** Note that array map() also brings the prior filter condition(s) to the return value*/
    if (typeof config.propertyPath === 'string'){
        return quads.filter(ids => ids.predicate.equals(namedNode(<string>config.propertyPath))).map(ids=><string>ids.subject.value)
    }
    else{
        return [...new Set(quads.filter(ids=>config.propertyPath.includes(ids.predicate.value))
            .map(ids=><string>ids.subject.value))]
    }

}

export function getMemberQuads(config:Config, quads:Quad[]):Quad[]{
    const member_ids = getMemberIDs(config, quads)
    return quads.filter(q=>member_ids.includes(q.subject.value))
    //return quads.filter(q => member_ids.some(x => x.equals(q)))
}

function getRelationBNs(config:Config, quads:Quad[]):string[]{
    return [...new Set(quads.filter(q => q.predicate.equals(TREE.terms.relation)).map(q=><string>q.object.value))]
}

function getNodeRelQuad(config:Config, quads:Quad[]):Quad[]{
    return quads.filter(q=>q.predicate.equals(TREE.terms.relation))
}

export function getRelationQuads(config:Config, quads:Quad[], nodes:NamedNode[], counter:{[key:string]: any}):Quad[]{
    /** update counter */
    const parent_node = getNodeRelQuad(config, quads).map(q=><string>q.subject.value)[0]
    // structure: {"node":{"sub_node":count,... }}
    for (const n of nodes){
        if (parent_node in counter){
            if (n.value in counter[parent_node])
                counter[parent_node][n.value] += 1
            else
                counter[parent_node][n.value] = 1
        }
        else{
            let sub_dic: {[key:string]: number}= {}
            sub_dic[n.value] = 1
            counter[parent_node]=sub_dic
        }
    }
    // tree:Relation rdf:type tree:SubstringRelation;
    //  tree:node tree:Node;
    //  tree:path <IRI>;
    //  tree:value xsd:string;
    const rel_bns = getRelationBNs(config, quads)

    // tree:Node tree:relation tree:Relation.
    const node_rel_quad = getNodeRelQuad(config, quads)
    return [...new Set([...quads.filter(q => rel_bns.includes(<string>q.subject.value)), ...node_rel_quad])]
}

export function safeAppendFile(out:string, quadString:string){
    const retryOptions = {
        retries: {
            retries: 5,
            factor: 3,
            minTimeout: 1 * 1000,
            maxTimeout: 60 * 1000,
            randomize: true,
        }
    };
    let cleanup: () => any;
    bluebirdPromise.try(() => {
        return fse.ensureFile(out); // fs-extra creates file if needed
    }).then(() => {
        return lockfile.lock(out, retryOptions);
    }).then((release: () => any) => {
        cleanup = release;
        let stream = fs.createWriteStream(out, {flags: 'a'});
        stream.write(quadString);
        stream.end();

        return new Promise<void>(function (resolve, reject) {
            stream.on('finish', () => resolve());
            stream.on('error', (err) => reject(err));
        });
    }).then(() => {
        console.log('Finished!');
    }).catch((err: any) => {
        console.error(err);
    }).finally(() => {
        cleanup && cleanup();
    });
}

export function serialize_quads(quads: Quad[]): string {
    return new n3.Writer().quadsToString(quads);
}

/**
 * delay() introduce a promise-based delay
 * @param ms millisecond
 */
export function delay(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
