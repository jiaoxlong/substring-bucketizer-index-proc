import {QueryEngine} from "@comunica/query-sparql";
import {Config} from "./parseConfig";
import * as n3 from "n3";
import {SubstringBucketizer} from "@treecg/substring-bucketizer";
import {BlankNode, Literal, NamedNode, Quad, Store} from "@rdfjs/types";
import {exists, extract_resource_from_uri, remainingItemsCount, writerToFile, escape} from "./utils";
import type { AsyncIterator } from 'asynciterator';
import * as fs from "fs";
import {Partial} from "@treecg/bucketizer-core";
import {BucketizerCoreExtOptions} from "@treecg/types";
import {DataFactory, Term} from "n3";
import namedNode = DataFactory.namedNode;
import {TREE, SDS, XSD, RDFS, RDF, SHACL, VOID} from "@treecg/types"
import blankNode = DataFactory.blankNode;
import {TreeCollection, TreeMember, TreeNode, TreeRelation, TreeResource, TreeShape} from "./tree";
import {RelationType, ResourceType} from "./types";
import rdfParser from "rdf-parse";
import {storeStream} from "rdf-store-stream";

const queryEngine = new QueryEngine();

/**
 * a process fetches query result from a SPRAQL endpoint defined in a Bucketizer index config file.
 * @param config a bucketizer index configuration instance that includes info of a SPARQL endpoint and a SPARQL query
 */
export async function query_sparql(config:Config):Promise<AsyncIterator<Quad>> {
    return await queryEngine.queryQuads(config.sparqlQuery, {sources: [config.sparqlEndpoint]})
}


/**
 * arrayify a quad stream to an array of quads
 * @param quad_stream A quad stream
 */

async function quadStreamToArray(quad_stream:AsyncIterator<Quad>):Promise<{[key: string]: Quad[] }>{
    const quads = await quad_stream.toArray()
    let triple_map: { [key: string]: Quad[] } = {}
    for (const quad of quads) {
        if (!triple_map.hasOwnProperty(quad.subject.value)) {
            triple_map[quad.subject.value] = []
            triple_map[quad.subject.value].push(<Quad> quad);
        } else {
            triple_map[quad.subject.value].push(<Quad> quad)
        }
    }
    return triple_map
}

/**
 * creates N3.Store instance with the bucketized quads
 * @param bucketizerOptions
 * @param triple_map an array of bucketized quads
 * @param writeTo when defined, it writes quads into a file with the value (path) assigned to writeTo
 */
async function substringBucketize(bucketizerOptions:Partial<BucketizerCoreExtOptions>,
                                  triple_map:Promise<{[key: string]: Quad[]}>, writeTo?:string):Promise<Store<any> | void>{

    let rdf:any = [];
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    for (const [subject, quads] of Object.entries(triple_map)){
        rdf.push(bucketizer.bucketize(quads, subject))
        rdf.push(quads)
    }
    if (typeof writeTo !== 'undefined'){
        return new n3.Store(rdf.flat(2))
    }
    else{
        writeStateFile(writeTo!, rdf)
    }
}

/**
 * load bucketized quads from a bucketizer state file into a n3 Store.
 * @param location: absolute file path
 */
export async function readStateStore(location:string): Promise<Store<any> | undefined>{
    try {
        const quadStream = rdfParser.parse(fs.createReadStream(location), { contentType: 'text/turtle' });
        const store = await storeStream(quadStream)
        return store
    }
    catch(error) {
        console.error('readStateStore Stream ended with error: ', error)
    }
}

/**
 * write quads in a file
 * @param location: absolute path
 * @param quads: an array of quads
 */
export function writeStateFile(location:string, quads:Quad[]):void{
    const writer = new n3.Writer();
    writer.addQuads(quads)
    writer.end((error:any, result:any) => {
        fs.writeFile(location, result, (err:any) => {
            if (err) throw err;
        })
    });
}

/**
 * tree_collection() returns a TreeCollection instance with serialiazed quads for the latter streaming pipeline.
 * For the time being, this class is designed for the purpose of serializing quads only for substring bucktizer.
 * Thus, it is not a generic class to be extended for other implementations. However, it is in the to-do list.

 * bucketizer
 * @param config a bucketizer index configuration instance that includes bucketizerOps of Substring
 * @param store a n3.Store instance populated with bucketized quads.
 */

function tree_collection( config:Config, store:n3.Store):TreeCollection{
    const tree_collection_node = namedNode(config.namespaceIRI)
    /**
     * Resource
     */
    const resource_ins: TreeResource|TreeResource[] =
        new TreeResource(tree_collection_node, ResourceType['subset'], tree_collection_node)
    /**
     * Members are not shown as default.
     * To be implemented: index on relations
     */
    const relations_ins:TreeRelation[] = []
    /**
     * Relations
     * populates all relation instances associated directly with root bucket
     */
    const bucket_root = (config.bucketizerOptions.root === '') ? config.bucketizerOptions.bucketBase + 'root' :
        config.bucketizerOptions.bucketBase + config.bucketizerOptions.root
    for (const relation of [...store.getObjects(namedNode(bucket_root), namedNode(SDS.relation), null)]) {
        /**
         * as the mapping ratio between a tree:Relation instance and tree:Node/sds:Bucket through sds:relationBucket
         * is 1 to 1, we only expect the following loop iterates once.
         */
        for (const bucket of [...store.getObjects(relation, namedNode(SDS.relationBucket), null)]) {
            const prop_path_ins = namedNode((typeof config.bucketizerOptions.propertyPath === 'string') ?
                config.bucketizerOptions.propertyPath : config.bucketizerOptions.propertyPath[0])
            const relation_ins =
                new TreeRelation(<BlankNode>relation,
                    RelationType['Substring'],
                    <NamedNode>bucket,
                    <Literal[]>[...store.getObjects(<BlankNode>relation, namedNode(SDS.relationValue), null)],
                    prop_path_ins,
                    <number>remainingItemsCount(store, <Term>relation))
            relations_ins.push(relation_ins)
        }
    }
    const shape_blank_node = blankNode()
    const shape_ins = new TreeShape(shape_blank_node, config.bucketizerOptions.propertyPath.map(namedNode))

    const tree_collection_ins = new TreeCollection(
        tree_collection_node,
        false,
        false,
        config.prefixes!,
        resource_ins,
        [],
        relations_ins,
        shape_ins)
    return tree_collection_ins
}

/**
 * tree_nodes() creates TreeNode (tree:Node) instances enables Treemunica to traverse over.
 * Note that both TreeCollection and TreeNodes are derived from bucketized quads of Substring bucketizer
 * one bad record: DE0KFKB/2024-01-01_2024-12-31

 * @param config a bucketizer index configuration instance which includes bucketizerOps of Substring
 * @param store a n3.Store instance populated with bucketized quads.
 */
function tree_nodes(config:Config, store:n3.Store):TreeNode[] {
    let tree_nodes:TreeNode[] = []
    // supports only one property path as the value of tree:path
    const prop_path = (typeof config.bucketizerOptions.propertyPath === 'string') ?
        config.bucketizerOptions.propertyPath : config.bucketizerOptions.propertyPath[0]
    let tree_members: TreeMember[] = []
    for (const tree_node of [...store.getObjects(null, namedNode(SDS.bucket), null)]) {


        for (const record of [...store.getSubjects(namedNode(SDS.bucket), tree_node, null)]) {
            for (const member of [...store.getObjects(record, namedNode(SDS.payload), null)]){
                // list members adheres to a bucket instance
                tree_members.push(new TreeMember(namedNode(member.id), [...store.match(member, null, null)] ))
            }
        }

        /** visits quads associated with a bucket
         * Caution: a leaf bucket (node) has no relations
         */
        const relations = [...store.getObjects(tree_node, namedNode(SDS.relation), null)]
        let tree_node_relations: TreeRelation[] = []
        if (relations.length !== 0) {

            for (const relation of relations) {
                for (const sub_bucket of [...store.getObjects(<BlankNode>relation, namedNode(SDS.relationBucket), null)]) {
                    const resource_bucket = extract_resource_from_uri(sub_bucket.value)
                    for (const rel_value of [...store.getObjects(<BlankNode>relation, namedNode(SDS.relationValue), null)]) {
                        tree_node_relations.push(new TreeRelation(
                            <BlankNode>relation,
                            RelationType.Substring,
                            namedNode(sub_bucket.value.replace(resource_bucket, escape(resource_bucket))),
                            <Literal>rel_value,
                            prop_path,
                            remainingItemsCount(store, <Term>relation) ))
                    }
                }
            }
        }
        tree_nodes.push(new TreeNode(
            <NamedNode>tree_node,
            false,
            true,
            config.prefixes!,
            tree_members,
            tree_node_relations
            ))
    }
    return tree_nodes
}



