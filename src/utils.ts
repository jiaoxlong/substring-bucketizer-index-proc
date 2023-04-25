import * as n3 from "n3"
import {BlankNode, DataFactory, NamedNode, Term} from "n3";
import {BucketizerCoreExtOptions, BucketizerCoreOptions, RDF, RDFS, SDS, SHACL, TREE} from '@treecg/types';
import namedNode = DataFactory.namedNode;

import * as path from "path";
import { Transform, TransformCallback, TransformOptions } from 'stream'

import * as fs from 'fs';
import * as fp from 'fs/promises'
import {QueryEngine} from "@comunica/query-sparql";
import {TreeCollection} from "./tree";
/**
 * counts the number of remaining items adheres to a substring relation
 * @param store an N3.Store instance
 * @param relation a tree:Relation instance
 */

export function remainingItemsCount(store:n3.Store, relation:Term):number|undefined{
    let count = 0
    for (const sub_bucket of [...store.getObjects(relation, namedNode(SDS.relationBucket), null)]){
        let count_extra = [...store.getSubjects(namedNode(SDS.bucket), sub_bucket, null)].length
        count += count_extra;
        for (const sub_relation of [...store.getObjects(sub_bucket, namedNode(SDS.relation), null)]) {
            count += remainingItemsCount(store,sub_relation) || 0
        }
    }
    return count
}

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
 * Caution: it will only escape the first symbol matched against a regex.
 * @param bucket_base
 */
export function escape(bucket_base:string):string{
    if (invalidWINRes(bucket_base)){
        return (bucket_base.concat('%'))
    }
    else{
        return bucket_base.replace(WIN_SYMBOL_REGEX, encodeURIComponent)

    }
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
    let s_index:number;
    if (s.includes('http')) {
        let s_index: number;
        if (s.includes('#'))
            s_index = s.lastIndexOf('#');
        else
            s_index = s.lastIndexOf('/');
        return s_index+1;
    }
    else if (s.includes(':')) {
        s_index = s.indexOf(':');
        return s_index+1;
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
        await fp.writeFile(path.join(__dirname,location), content)
    } catch (err) {
        console.log(err)
    }
}


export function exists(path_ins:string) {
    try {
        return fs.statSync(path.join(__dirname,path_ins)).isFile()
    }
    catch(error) {
        throw new Error(path_ins + ' does not exist in the system ')
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


//https://stackoverflow.com/questions/11100821/javascript-regex-for-validating-filenames
export const WIN_REGEX= new RegExp('^(con|prn|aux|nul|com[0-9]|lpt[0-9])$|([<>:"\\/\\\\|?*])|(\\.|\\s)$/ig')
export const WIN_SYMBOL_REGEX = new RegExp('([<>:"\/\\|?*])|(\.|\s)$/g')
export const WIN_RESERVE_REGEX = new RegExp('^(con|prn|aux|nul|com[0-9]|lpt[0-9])$')


