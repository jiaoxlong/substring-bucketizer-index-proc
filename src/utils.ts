import * as n3 from "n3"
import {BlankNode, DataFactory, NamedNode, Term} from "n3";
import {BucketizerCoreExtOptions, BucketizerCoreOptions, RDF, RDFS, SDS, SHACL, TREE} from '@treecg/types';
import namedNode = DataFactory.namedNode;
import {WIN_REGEX, WIN_RESERVE_REGEX, WIN_SYMBOL_REGEX} from "../lib/REGEX";
import quad = DataFactory.quad;
import literal = DataFactory.literal;
//import {prefix} from "../lib/Prefix";
import * as path from "path";

import * as fs from 'fs';
import * as fp from 'fs/promises'
import type { Partial } from '@treecg/bucketizer-core';
import {Config} from "../lib/parseConfig";
import {QueryEngine} from "@comunica/query-sparql";
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

// export function tree_collection(store:n3.Store, tree_writer:n3.Writer, namespace_iri:string, bucket_base:string, query_path:string){
//     /**
//      * 1. First fetch all relation instances associated with root
//      */
//     for (const relation of [...store.getObjects(namedNode(bucket_base), namedNode(SDS.relation), null)]) {
//         /**
//          * as the mapping ratio between a tree:Relation instance and tree:Node/sds:Bucket through sds:relationBucket
//          * is 1 to 1, we only expect the following loop iterates once.
//          */
//         for (const bucket of [...store.getSubjects(null, namedNode(SDS.relationBucket), relation)]) {
//             tree_writer.addQuad(
//                 quad(
//                     namedNode(namespace_iri),
//                     namedNode(TREE.relation),
//                     relation
//                 )
//             )
//             // tree:Relation rdf:type tree:SubstringRelation .
//             tree_writer.addQuad(
//                 quad(
//                     <BlankNode>relation,
//                     namedNode(RDF.type),
//                     namedNode(TREE.SubstringRelation)
//                 )
//             )
//             //tree:Relation tree:node SDS:Bucket .
//             tree_writer.addQuad(
//                 quad(
//                     <BlankNode>relation,
//                     namedNode(TREE.node),
//                     bucket
//                 )
//             )
//             // tree:Relation tree:value Literal .
//             for (const rel_value of [...store.getObjects(<BlankNode>relation, namedNode(SDS.relationValue), null)]) {
//                 tree_writer.addQuad(
//                     quad(
//                         <BlankNode>relation,
//                         namedNode(TREE.value),
//                         rel_value
//                     )
//                 )
//             }
//             // tree:Relation tree:path rdfs:label . or era:opName?
//             tree_writer.addQuad(
//                 quad(
//                     <BlankNode>relation,
//                     namedNode(TREE.path),
//                     namedNode(query_path)
//                 )
//             )
//             // tree:Relation sh:pattern "[\\p{L}\\p{N}]+" .
//             tree_writer.addQuad(quad(<BlankNode>relation, namedNode(SHACL.pattern), literal('[\\\\p{L}\\\\p{N}]+')))
//             // tree:Relation sh:flags "i"
//             tree_writer.addQuad(quad(<BlankNode>relation, namedNode(SHACL.flags), literal('i')))
//             // tree:Relation tree:remainingItems xsd:int .
//             tree_writer.addQuad(quad(<BlankNode>relation, namedNode(TREE.remainingItems),
//                 literal(<number>remainingItemsCount(store, <Term>relation))))
//
//             //one writer instance per bucket
//             const writer = new n3.Writer(prefix);
//
//             /** sds:Record sds:bucket sds:Bucket.
//              * todo: a use case when this is needed in the index?
//              */
//
//             for (const record of [...store.getSubjects(namedNode(SDS.bucket), bucket, null)]) {
//                 for (const member of [...store.getObjects(record, namedNode(SDS.payload), null)]){
//                     // Tree:Collection tree:member tree:Member.
//                     tree_writer.addQuad(
//                         quad(
//                             namedNode(namespace_iri),
//                             namedNode(TREE.member),
//                             member
//                         )
//                     )
//                     // list members adheres to a bucket instance
//                     writer.addQuads([...store.match(member, namedNode(query_path), null)])
//                 }
//             }
//             /** visits quads associated with a bucket
//              * Caution: a leaf bucket (node) has no relations
//              */
//
//             const relations = [...store.getObjects(bucket, namedNode(SDS.relation), null)]
//             if (relations.length !== 0) {
//
//                 for (const relation of relations) {
//                     /** tree:Node tree:relation/sds:relation tree:Relation .
//                      *  or sds:Bucket sds:relation tree:Relation .
//                      */
//                     writer.addQuad(quad(<NamedNode>bucket, namedNode(TREE.relation), relation))
//                     // tree:Relation sh:pattern "[\\p{L}\\p{N}]+" .
//                     writer.addQuad(quad(<BlankNode>relation, namedNode('http://www.w3.org/ns/shacl#pattern'), literal('[\\\\p{L}\\\\p{N}]+')))
//                     // tree:Relation sh:flags "i"
//                     writer.addQuad(quad(<BlankNode>relation, namedNode('http://www.w3.org/ns/shacl#flags'), literal('i')))
//                     // tree:Relation tree:path rdfs:label . or era:opName?
//                     writer.addQuad(quad(<BlankNode>relation, namedNode(TREE.path), namedNode(RDFS.label)))
//                     // tree:Relation rdf:type tree:SubstringRelation
//                     writer.addQuad(quad(<BlankNode>relation, namedNode(RDF.type), namedNode(TREE.SubstringRelation)))
//                     // tree:Relation tree:remainingItems xsd:int .
//                     let count = remainingItemsCount(store, <Term>relation)
//                     writer.addQuad(quad(<BlankNode>relation, namedNode(TREE.remainingItems), literal(<number>count)))
//
//
//                     for (const rel_value of [...store.getObjects(<BlankNode>relation, namedNode(SDS.relationValue), null)]) {
//                         writer.addQuad(quad(<BlankNode>relation, namedNode(TREE.value), rel_value))
//                     }
//
//                     for (const sub_bucket of [...store.getObjects(<BlankNode>relation, namedNode(SDS.relationBucket), null)]) {
//                         // tree:Relation tree:node tree:Node/sds:Bucket .
//                         const resource_bucket = extract_resource_from_uri(sub_bucket.value)
//                         writer.addQuad(quad(<BlankNode>relation, namedNode(TREE.node), namedNode(sub_bucket.value.replace(
//                             resource_bucket, escape(resource_bucket)))))
//                     }
//                 }
//             }
//             writer.end(async (error, result) => {
//                 await writerToFile(result, path.join('data', escape(extract_resource_from_uri(bucket.value))));
//             })
//         }
//     }
// }

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
